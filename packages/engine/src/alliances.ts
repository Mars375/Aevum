import {
  ALLIANCE_BREAK_DELAY_TURNS,
  MAX_DIPLOMACY_MESSAGE_CHARS,
  PROPOSAL_TTL_TURNS,
  type AllianceState,
  type BattleEvent,
  type Diplomacy,
  type FactionId,
} from "@abs/contracts";

/**
 * The v2 diplomacy state machine. Pure and versioned like everything else:
 * given the same state and the same actions it produces the same next state.
 *
 * The rule that gives an alliance weight is the delayed break — a betrayal
 * costs a turn during which the ally knows and can react (invariant I16).
 */

export interface Proposal {
  from: FactionId;
  to: FactionId;
  /** Turn after which the proposal lapses. */
  expiresTurn: number;
}

export interface PendingBreak {
  a: FactionId;
  b: FactionId;
  effectiveTurn: number;
}

export interface DiplomacyState {
  /** Canonical "a|b" with a < b, so an alliance is symmetric by construction (I15). */
  pairs: Set<string>;
  proposals: Proposal[];
  pendingBreaks: PendingBreak[];
  surrendered: Set<FactionId>;
}

export const emptyDiplomacy = (): DiplomacyState => ({
  pairs: new Set(),
  proposals: [],
  pendingBreaks: [],
  surrendered: new Set(),
});

/** A pair key cannot encode a one-way alliance. That is the point. */
export const pairKey = (a: FactionId, b: FactionId): string => [a, b].sort().join("|");

export const areAllied = (state: DiplomacyState, a: FactionId, b: FactionId): boolean =>
  a !== b && state.pairs.has(pairKey(a, b));

export const alliesOf = (state: DiplomacyState, faction: FactionId, all: readonly FactionId[]): FactionId[] =>
  all.filter((f) => areAllied(state, faction, f));

export const proposalsTo = (state: DiplomacyState, faction: FactionId): FactionId[] =>
  state.proposals.filter((p) => p.to === faction).map((p) => p.from);

export function snapshot(state: DiplomacyState): AllianceState {
  return { pairs: [...state.pairs].sort(), surrendered: [...state.surrendered].sort() };
}

export interface DiplomacyInput {
  factionId: FactionId;
  diplomacy: Diplomacy | null;
}

/**
 * Apply one turn of diplomacy. Returns a new state and the events it produced.
 *
 * Inputs are walked in canonical faction order, never in the order the generals
 * happened to answer, so diplomacy inherits the same permutation-invariance the
 * rest of the engine has.
 */
export function resolveDiplomacy(
  state: DiplomacyState,
  inputs: readonly DiplomacyInput[],
  turn: number,
  livingFactions: readonly FactionId[],
): { state: DiplomacyState; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  const next: DiplomacyState = {
    pairs: new Set(state.pairs),
    proposals: state.proposals.filter((p) => p.expiresTurn >= turn),
    pendingBreaks: [...state.pendingBreaks],
    surrendered: new Set(state.surrendered),
  };

  const seen = new Set<FactionId>();
  const living = new Set(livingFactions);

  for (const input of [...inputs].sort((x, y) => x.factionId.localeCompare(y.factionId))) {
    const { factionId, diplomacy } = input;
    if (!diplomacy) continue;

    // At most one diplomatic action per general per turn — the "bounded" part.
    if (seen.has(factionId)) {
      events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "DUPLICATE_DIPLOMACY" });
      continue;
    }
    seen.add(factionId);

    const message = (diplomacy.message ?? "").slice(0, MAX_DIPLOMACY_MESSAGE_CHARS);
    const target = diplomacy.target;

    if (diplomacy.action === "SURRENDER") {
      next.surrendered.add(factionId);
      events.push({ type: "FACTION_SURRENDERED", factionId, message });
      continue;
    }

    if (!target) {
      events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "MISSING_TARGET" });
      continue;
    }
    if (target === factionId) {
      events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "SELF_TARGETED" });
      continue;
    }
    if (!living.has(target) || next.surrendered.has(target)) {
      events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "DEAD_FACTION" });
      continue;
    }

    const allied = next.pairs.has(pairKey(factionId, target));

    if (diplomacy.action === "PROPOSE_ALLIANCE") {
      if (allied) {
        events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "ALREADY_ALLIED" });
        continue;
      }
      next.proposals = next.proposals.filter((p) => !(p.from === factionId && p.to === target));
      next.proposals.push({ from: factionId, to: target, expiresTurn: turn + PROPOSAL_TTL_TURNS });
      events.push({ type: "ALLIANCE_PROPOSED", from: factionId, to: target, message });
      continue;
    }

    if (diplomacy.action === "ACCEPT_ALLIANCE") {
      const offer = next.proposals.find((p) => p.from === target && p.to === factionId);
      if (!offer) {
        events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "NO_SUCH_PROPOSAL" });
        continue;
      }
      next.proposals = next.proposals.filter((p) => p !== offer);
      next.pairs.add(pairKey(factionId, target));
      // Accepting cancels any break that was queued between the two.
      next.pendingBreaks = next.pendingBreaks.filter((b) => pairKey(b.a, b.b) !== pairKey(factionId, target));
      const [a, b] = [factionId, target].sort() as [FactionId, FactionId];
      events.push({ type: "ALLIANCE_FORMED", a, b });
      continue;
    }

    if (diplomacy.action === "BREAK_ALLIANCE") {
      if (!allied) {
        events.push({ type: "DIPLOMACY_REJECTED", factionId, reason: "NOT_ALLIED" });
        continue;
      }
      const key = pairKey(factionId, target);
      if (next.pendingBreaks.some((b) => pairKey(b.a, b.b) === key)) continue; // already queued
      const effectiveTurn = turn + ALLIANCE_BREAK_DELAY_TURNS;
      next.pendingBreaks.push({ a: factionId, b: target, effectiveTurn });
      events.push({ type: "ALLIANCE_BREAK_DECLARED", from: factionId, to: target, effectiveTurn });
    }
  }

  // Breaks declared on an earlier turn now bite. Never in the turn they were
  // declared: that delay is what makes a betrayal cost something.
  const ripe = next.pendingBreaks.filter((b) => b.effectiveTurn <= turn);
  next.pendingBreaks = next.pendingBreaks.filter((b) => b.effectiveTurn > turn);
  for (const b of ripe.sort((x, y) => pairKey(x.a, x.b).localeCompare(pairKey(y.a, y.b)))) {
    const key = pairKey(b.a, b.b);
    if (!next.pairs.has(key)) continue;
    next.pairs.delete(key);
    const [a, bb] = [b.a, b.b].sort() as [FactionId, FactionId];
    events.push({ type: "ALLIANCE_BROKEN", a, b: bb });
  }

  // A faction that is gone cannot stay allied to anyone.
  for (const key of [...next.pairs]) {
    const [a, b] = key.split("|") as [FactionId, FactionId];
    if (!living.has(a) || !living.has(b) || next.surrendered.has(a) || next.surrendered.has(b)) next.pairs.delete(key);
  }

  return { state: next, events };
}
