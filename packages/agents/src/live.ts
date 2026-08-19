import type { GeneralConfig } from "@abs/contracts";
import {
  applyRuling,
  detectDecisions,
  isOver,
  tickWorld,
  type DecisionPoint,
  type Journal,
  type Ruling,
  type TickEvent,
  type World,
} from "@abs/world";
import { askRuler, type RulerProvider } from "./rule.js";

/**
 * Live a world forward, fairly.
 *
 * Extracted from the script that used to hold it, because the fairness rules
 * below are the load-bearing part of a continuous world and a rule that only
 * exists inside a CLI cannot be tested. Everything here is injectable: the
 * provider, the journal, and where the journal gets written.
 *
 * Two rules, both about the same thing — the quota is shared and unfair, and
 * the world must not inherit that unfairness:
 *
 *   - LOCKSTEP. Every civilisation lives the same year at the same time. All
 *     decisions raised in year N are attempted before year N+1 begins, so no
 *     civilisation runs ahead because its model happened to answer faster.
 *   - DEFERRED, NEVER DROPPED. A decision that cannot be served stays queued
 *     and is retried at the next opportunity. A rate-limited civilisation is
 *     governed late, not left ungoverned.
 */

export interface LiveNotice {
  kind: "event" | "ruled" | "deferred" | "unruled" | "era-closed";
  tick: number;
  civ?: string;
  text: string;
}

export interface LiveOptions {
  journal: Journal;
  generals: GeneralConfig[];
  /** Null lives the world with no model at all: the engine alone, doctrines frozen. */
  provider: RulerProvider | null;
  ticks: number;
  /** Called after every ruling so a caller can persist without losing years to a crash. */
  onRuling?: (journal: Journal) => void;
  notify?: (notice: LiveNotice) => void;
}

export interface LiveTally {
  asked: number;
  answered: number;
  deferred: number;
}

export interface LiveResult {
  world: World;
  lived: number;
  /** True when only one civilisation remains: the era is over. */
  closed: boolean;
  ledger: Map<string, LiveTally>;
}

/** Events worth telling a reader about. Growth every single year is not news. */
const NOTABLE: ReadonlySet<TickEvent["kind"]> = new Set(["COLLAPSED", "ADVANCE", "SEIZED", "RAIDED", "STARVED"]);

export async function liveWorld(from: World, opts: LiveOptions): Promise<LiveResult> {
  const { journal, generals, provider, ticks } = opts;
  const notify = opts.notify ?? (() => {});
  const generalOf = new Map(generals.map((g) => [String(g.factionId), g]));

  const ledger = new Map<string, LiveTally>(
    from.civs.map((c) => [c.id, { asked: 0, answered: 0, deferred: 0 }]),
  );

  /**
   * Decisions raised but not yet answered, at most one per civilisation: a
   * fresh question replaces a queued one, because a famine from ten years ago
   * is not what a ruler should be deciding today.
   */
  const pending = new Map<string, DecisionPoint>();

  let world = from;
  let lived = 0;
  let closed = false;

  for (let i = 0; i < ticks; i += 1) {
    const stepped = tickWorld(world);
    world = stepped.world;
    lived += 1;

    for (const event of stepped.events) {
      if (NOTABLE.has(event.kind)) {
        notify({ kind: "event", tick: event.tick, civ: event.civ, text: event.detail });
      }
    }

    for (const point of detectDecisions(world, stepped.events)) pending.set(point.civ, point);

    // The barrier. Sorted by id so the order never depends on a Map's insertion
    // history — the same discipline the engine applies to squads and civs.
    for (const [civId, point] of [...pending].sort((a, b) => a[0].localeCompare(b[0]))) {
      const civ = world.civs.find((c) => c.id === civId)!;
      const general = generalOf.get(civId);
      const tally = ledger.get(civId)!;

      if (!provider || !general) {
        // Nobody answers at all. The world carries on under the standing
        // doctrine — silence has to be survivable, or a continuous world stops.
        pending.delete(civId);
        world = { ...world, civs: world.civs.map((c) => (c.id === civId ? { ...c, ticksSinceDecision: 0 } : c)) };
        notify({ kind: "unruled", tick: point.tick, civ: civId, text: point.kind });
        continue;
      }

      tally.asked += 1;
      let rejection: string | null = null;
      const ruling: Ruling | null = await askRuler(provider, general, civ, point, (why, raw) => {
        rejection = `${why} | ${raw.slice(0, 120)}`;
      });

      if (ruling === null) {
        tally.deferred += 1;
        notify({
          kind: "deferred",
          tick: world.tick,
          civ: civId,
          text: `${point.kind} — ${rejection ?? "aucun modele joignable"}`,
        });
        continue;
      }

      tally.answered += 1;
      pending.delete(civId);
      ruling.deferredBy = world.tick - point.tick;
      journal.rulings.push(ruling);
      journal.livedTo = world.tick;
      world = applyRuling(world, ruling);
      opts.onRuling?.(journal);
      notify({
        kind: "ruled",
        tick: point.tick,
        civ: civId,
        text: `${point.kind}${ruling.deferredBy > 0 ? ` [+${ruling.deferredBy} ans d'attente]` : ""} — ${ruling.reason}`,
      });
    }

    if (isOver(world)) {
      closed = true;
      notify({ kind: "era-closed", tick: world.tick, text: "il ne reste qu'une civilisation" });
      break;
    }
  }

  journal.livedTo = world.tick;
  return { world, lived, closed, ledger };
}
