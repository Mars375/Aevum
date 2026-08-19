import { isAlive, type Civ, type World } from "./state.js";
import type { TickEvent } from "./tick.js";

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
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export interface DecisionPoint {
  tick: number;
  civ: Civ["id"];
  kind: DecisionKind;
  /** Higher wins when several fire at once — only one is asked per civ per tick. */
  urgency: number;
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

/** Above this, the world is not waiting politely: ask now regardless of the gap. */
export const URGENT = 90;

/** Ticks of food left at the current burn. Infinity when the civ is net positive. */
export function foodRunway(civ: Civ): number {
  const burn = civ.population * 0.8 + civ.soldiers * 1.5;
  if (burn <= 0) return Infinity;
  return civ.stock.food / burn;
}

function pointsFor(civ: Civ, tick: number, events: TickEvent[]): DecisionPoint[] {
  const mine = events.filter((e) => e.civ === civ.id);
  const out: DecisionPoint[] = [];
  const raise = (kind: DecisionKind, urgency: number, evidence: string[]) =>
    out.push({ tick, civ: civ.id, kind, urgency, evidence });

  const runway = foodRunway(civ);
  if (mine.some((e) => e.kind === "STARVED")) {
    raise("FAMINE", 100, [`famine en cours`, `${civ.population} habitants`, `greniers a ${civ.stock.food}`]);
  } else if (runway < 2.5) {
    // Warned before the deaths, not after: a ruler asked too late can only
    // choose which people to lose.
    raise("FAMINE", 80, [`${runway.toFixed(1)} tours de vivres restants`, `${civ.population} habitants`]);
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
    raise("SURPLUS", 40, [`vivres ${civ.stock.food}`, `tresor ${civ.stock.wealth}`, "rien n'en est fait"]);
  }

  if (mine.some((e) => e.kind === "CEDED")) {
    raise("INVADED", 85, ["une frontiere a cede sous la force", `${civ.territory} terres`, `${civ.soldiers} soldats`]);
  }

  if (mine.some((e) => e.kind === "LAND_FULL")) {
    raise("BORDER", 55, ["plus une terre libre dans le monde", `${civ.population} habitants pour ${civ.territory} terres`]);
  }

  if (mine.some((e) => e.kind === "LOST_LAND")) {
    raise("DECLINE", 50, [`frontiere reduite a ${civ.territory}`, `${civ.population} habitants`]);
  }

  if (civ.ticksSinceDecision >= DRIFT_TICKS) {
    raise("DRIFT", 10, [`${civ.ticksSinceDecision} tours sans decision`, `population ${civ.population}`]);
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
    if (civ.ticksSinceDecision < MIN_GAP_TICKS && best.urgency < URGENT) continue;
    out.push(best);
  }
  return out;
}
