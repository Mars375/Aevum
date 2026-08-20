import { LAND_KINDS, isAlive, neighbours, type Civ, type World } from "./state.js";
import type { TickEvent } from "./events.js";

/**
 * When must a ruler be woken?
 *
 * This is the load-bearing part of a continuous world. Asking an LLM every tick
 * would burn a day's free quota in minutes and the world would stop; never
 * asking makes the civilisations mechanical wallpaper. So the engine ticks for
 * free and a decision point is raised only when the world has reached a state
 * a doctrine cannot answer on its own.
 *
 * Three rules keep this honest:
 *   W1 — a decision point is a function of state and events only. Same world,
 *        same points, always. No clock, no randomness.
 *   W2 — a dead civilisation is never consulted.
 *   W3 — every raised point carries the evidence that raised it, so the
 *        chronicle can show why a ruler was asked, and a reader can disagree.
 */

export const DECISION_KINDS = [
  /** Food is running out. Ignoring it kills people within a few ticks. */
  "FAMINE",
  /** Stores are piling up with nothing being done with them. */
  "SURPLUS",
  /** Soldiers cannot be paid. */
  "TREASURY",
  /** An advance was reached; what it unlocks is worth a choice. */
  "ADVANCE",
  /** Land is being lost tick after tick. Slow decline nobody noticed. */
  "DECLINE",
  /** Nothing has needed deciding for a long time. Boredom is itself a prompt. */
  "DRIFT",
  /** The world has no free land left. Growth is now someone else's loss. */
  "BORDER",
  /** A neighbour took land by force. */
  "INVADED",
  /** Bandits took what was not guarded. */
  "RAIDED",
  /** The doctrine asks for work the ground cannot carry. */
  "MISMATCH",
  /** Disaster struck. */
  "DISASTER",
  /** A promise a predecessor made no longer holds. */
  "VOW_BROKEN",
  /** The seat of the civilisation has been taken. */
  "CAPITAL",
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export interface DecisionPoint {
  tick: number;
  civ: Civ["id"];
  kind: DecisionKind;
  /** Higher wins when several fire at once — only one is asked per civ per tick. */
  urgency: number;
  /**
   * True when this describes a situation rather than an event.
   *
   * Marked where it is raised, because that is where the difference is known:
   * "people are dying this year" is news, "we have been short of food for a
   * century" is a condition. Conditions get the long gap.
   */
  standing: boolean;
  /** The facts that raised it. W3: a ruler is never asked without being told why. */
  evidence: string[];
}

/**
 * How long a civilisation may go without being consulted. Tuned so a healthy,
 * uneventful civilisation costs about one call per 40 ticks rather than 40.
 */
export const DRIFT_TICKS = 40;

/**
 * A ruler who has just decided is not asked again straight away.
 *
 * The first measurement made this necessary rather than nice: without it the
 * famine rule re-fired every single tick on a state its own ruler had already
 * answered, and 500 ticks cost 1576 calls instead of 44 — a 1.3x saving, which
 * is no saving at all. A question already put does not become a new question
 * because a tick passed.
 */
export const MIN_GAP_TICKS = 8;

/**
 * Some conditions are not events, they are situations.
 *
 * "There is no free land left" stays true for centuries, and re-asking every
 * eight ticks raised it fifty times in four hundred years — the same mistake as
 * the famine loop, wearing different clothes. A permanent condition is not
 * news; it gets the long gap, so a ruler revisits it occasionally rather than
 * constantly.
 */
export const STANDING_GAP_TICKS = 40;

/** Above this, the world is not waiting politely: ask now regardless of the gap. */
export const URGENT = 90;

/** Ticks of food left at the current burn. Infinity when the civ is net positive. */
export function foodRunway(civ: Civ): number {
  const burn = civ.population * 0.8 + civ.soldiers * 1.5;
  if (burn <= 0) return Infinity;
  return civ.stock.food / burn;
}

/**
 * What a civilisation can actually reach, and from whom.
 *
 * Since w4 this is the fact that decides whether a border question has an
 * answer: a ruler told "the world is full" while three neutral places sit
 * against its frontier would be told a lie.
 */
export function frontier(world: World, civ: Civ["id"]): { neutral: number; neighbours: string[] } {
  const neutral = new Set<number>();
  const others = new Set<string>();
  world.board.forEach((place, i) => {
    if (place.owner !== civ) return;
    for (const n of neighbours(world.size, i)) {
      const owner = world.board[n]!.owner;
      if (owner === null) neutral.add(n);
      else if (owner !== civ) others.add(owner);
    }
  });
  return { neutral: neutral.size, neighbours: [...others].sort() };
}

function pointsFor(civ: Civ, tick: number, events: TickEvent[]): DecisionPoint[] {
  const mine = events.filter((e) => e.civ === civ.id);
  const out: DecisionPoint[] = [];
  const raise = (kind: DecisionKind, urgency: number, evidence: string[], standing = false) =>
    out.push({ tick, civ: civ.id, kind, urgency, evidence, standing });

  const runway = foodRunway(civ);
  if (mine.some((e) => e.kind === "STARVED")) {
    raise("FAMINE", 100, [`famine en cours`, `${civ.population} habitants`, `greniers a ${civ.stock.food}`]);
  } else if (runway < 2.5) {
    // Warned before the deaths, not after: a ruler asked too late can only
    // choose which people to lose. But living permanently lean is a condition,
    // not an alarm — asking every eight ticks about a century-old shortage put
    // famine at 79% of all wake-ups.
    raise("FAMINE", 80, [`${runway.toFixed(1)} tours de vivres restants`, `${civ.population} habitants`], true);
  }

  const hard = mine.find((e) => e.kind === "HARD_YEAR");
  if (hard && runway < 3.5) {
    // A bad year only deserves a ruler's attention if this civilisation is
    // actually exposed to it. Full granaries make a bad harvest a footnote.
    raise("FAMINE", 75, [hard.detail, `${runway.toFixed(1)} tours de vivres`]);
  }

  if (mine.some((e) => e.kind === "SHORTAGE")) {
    raise("TREASURY", 70, ["solde impayee", `${civ.soldiers} soldats`, `tresor a ${civ.stock.wealth}`]);
  }

  const advance = mine.find((e) => e.kind === "ADVANCE");
  if (advance) raise("ADVANCE", 60, [advance.detail, `${civ.advances.length} progres acquis`]);

  if (mine.some((e) => e.kind === "SURPLUS")) {
    raise("SURPLUS", 40, [`vivres ${civ.stock.food}`, `tresor ${civ.stock.wealth}`, "rien n'en est fait"], true);
  }

  const seat = mine.find((e) => e.kind === "CAPITAL_LOST");
  if (seat) {
    // Above URGENT: a ruler whose seat has just fallen is not made to wait for
    // a gap the way a ruler with a slow harvest is.
    raise("CAPITAL", 95, [seat.detail, `${civ.territory} lieux restants`, `${civ.soldiers} soldats`]);
  }

  const struck = mine.find((e) => e.kind === "DISASTER");
  if (struck) raise("DISASTER", 78, [struck.detail, `${civ.population} habitants`, `vivres ${Math.round(civ.stock.food)}`]);

  const broken = mine.find((e) => e.kind === "VOW_BROKEN");
  if (broken) {
    // Worth waking a ruler for even in a calm year: a promise nobody is told
    // about breaking is a promise that was never binding.
    raise("VOW_BROKEN", 60, [broken.detail, "vos successeurs heriteront de ce manquement"]);
  }

  const raided = mine.find((e) => e.kind === "RAIDED");
  if (raided) {
    raise("RAIDED", 65, [raided.detail, `${civ.soldiers} soldats`, `posture ${civ.doctrine.posture}`]);
  }

  if (mine.some((e) => e.kind === "CEDED")) {
    raise("INVADED", 85, ["une frontiere a cede sous la force", `${civ.territory} terres`, `${civ.soldiers} soldats`]);
  }

  if (mine.some((e) => e.kind === "LAND_FULL")) {
    raise(
      "BORDER",
      55,
      [
        "plus un lieu libre a portee de nos frontieres",
        `${civ.population} habitants pour ${civ.territory} terres`,
        `vos terres : ${LAND_KINDS.map((k) => `${k} ${civ.lands[k]}`).join(", ")}`,
      ],
      true,
    );
  }

  // A civilisation working ground that cannot carry it is not in crisis, but it
  // is wasting people, and no other rule would ever tell its ruler.
  const s = civ.doctrine;
  const strain = [
    { share: s.farming, parcels: civ.lands.plain + civ.lands.river, what: "champs" },
    { share: s.forestry, parcels: civ.lands.forest, what: "forets" },
    { share: s.mining, parcels: civ.lands.hill, what: "collines" },
    { share: s.trade, parcels: civ.lands.river, what: "fleuves" },
  ].find((x) => x.share > 0.2 && x.parcels === 0);
  if (strain) {
    raise(
      "MISMATCH",
      45,
      [`des gens travaillent sans ${strain.what}`, `vos terres : ${LAND_KINDS.map((k) => `${k} ${civ.lands[k]}`).join(", ")}`],
      true,
    );
  }

  if (mine.some((e) => e.kind === "LOST_LAND")) {
    raise("DECLINE", 50, [`frontiere reduite a ${civ.territory}`, `${civ.population} habitants`], true);
  }

  if (civ.ticksSinceDecision >= DRIFT_TICKS) {
    raise("DRIFT", 10, [`${civ.ticksSinceDecision} tours sans decision`, `population ${civ.population}`], true);
  }

  return out;
}

/**
 * At most one decision per civilisation per tick — the most urgent one.
 *
 * A ruler who is handed four questions at once answers none of them well, and
 * four questions cost four calls. Urgency ordering, with kind as tie-break so
 * the result never depends on the order rules happen to be written in.
 */
export function detectDecisions(world: World, events: TickEvent[]): DecisionPoint[] {
  const out: DecisionPoint[] = [];
  for (const civ of [...world.civs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isAlive(civ)) continue; // W2
    const candidates = pointsFor(civ, world.tick, events);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.urgency - a.urgency || a.kind.localeCompare(b.kind));
    const best = candidates[0]!;
    // Silence, unless the world has got strictly worse than "handled".
    const gap = best.standing ? STANDING_GAP_TICKS : MIN_GAP_TICKS;
    if (civ.ticksSinceDecision < gap && best.urgency < URGENT) continue;
    out.push(best);
  }
  return out;
}
