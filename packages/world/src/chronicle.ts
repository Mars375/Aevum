import { MAX_MEMORY_ENTRIES, type FactionId, type Identity } from "@abs/contracts";
import { applyRuling } from "./apply.js";
import type { Journal, Ruling } from "./journal.js";
import { tickWorld } from "./tick.js";
import { lifeEvent, type LifeEvent } from "./events.js";
import { census, doctrineFingerprint, type Civ, type World } from "./state.js";

/**
 * The years of a world, one entry each, ready to be read.
 *
 * The journal is deliberately tiny — an origin and a handful of decisions — so
 * anything that wants to *show* the world has to recompute it. That is cheap
 * (the engine is pure arithmetic) and it means the player recomputes the world
 * in the browser from the same code that lived it, rather than trusting a
 * separate rendering of what happened.
 */
export interface Year {
  tick: number;
  world: World;
  events: LifeEvent[];
  /** Decisions taken at the end of this year, after its events. */
  rulings: Ruling[];
}

export function chronicle(journal: Journal): Year[] {
  // Same rule as replay(): a ruling bites the year it was answered. See the
  // note in apply.ts for the world that contradicted its own journal.
  const byTick = new Map<number, Ruling[]>();
  for (const r of journal.rulings) {
    const effective = r.tick + r.deferredBy;
    byTick.set(effective, [...(byTick.get(effective) ?? []), r]);
  }

  // Like replay(), start from the board's canonical projection. Old journals
  // can carry the original uncensused constructor output.
  let world = census(journal.origin);
  const years: Year[] = [{ tick: world.tick, world, events: [], rulings: [] }];

  while (world.tick < journal.livedTo) {
    const stepped = tickWorld(world);
    world = stepped.world;
    const rulings = byTick.get(world.tick) ?? [];
    for (const ruling of rulings) world = applyRuling(world, ruling);
    const events = stepped.events.map(lifeEvent);
    years.push({ tick: world.tick, world, events, rulings });
  }
  return years;
}

/** Bounded memory of engine facts. Rulings are used to replay, never quoted as facts. */
export function memoryFor(
  journal: Journal,
  civ: FactionId,
  tick: number,
  maxEntries = MAX_MEMORY_ENTRIES,
): LifeEvent[] {
  const requested = Number.isFinite(maxEntries) ? Math.floor(maxEntries) : MAX_MEMORY_ENTRIES;
  const limit = Math.min(MAX_MEMORY_ENTRIES, Math.max(0, requested));
  if (limit === 0) return [];
  return chronicle(journal)
    .filter((year) => year.tick <= tick)
    .flatMap((year) => year.events)
    .filter((event) => event.civ === civ)
    .slice(-limit);
}

export interface HistoricalIdentity extends Identity {
  civId: FactionId;
  doctrineFingerprint: string;
  fellOnTick: number | null;
}

/** The latest recorded identity, including civilisations that have fallen. */
export function identityOf(civ: FactionId | Civ, history: readonly Year[]): HistoricalIdentity | null {
  const civId = typeof civ === "string" ? civ : civ.id;
  const latest = [...history]
    .sort((a, b) => b.tick - a.tick)
    .map((year) => year.world.civs.find((candidate) => candidate.id === civId))
    .find((candidate): candidate is Civ => candidate !== undefined) ?? (typeof civ === "string" ? null : civ);
  if (!latest) return null;
  return {
    civId,
    ...latest.identity,
    doctrineFingerprint: doctrineFingerprint(latest.doctrine),
    fellOnTick: latest.fellOnTick,
  };
}
