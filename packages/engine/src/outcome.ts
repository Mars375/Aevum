import type { FactionId, Outcome, WorldState } from "@abs/contracts";
import { areAllied, type DiplomacyState } from "./alliances.js";

interface Tally {
  hp: number;
  squads: number;
}

function tally(state: WorldState): Map<FactionId, Tally> {
  const alive = new Map<FactionId, Tally>();
  for (const squad of state.squads) {
    const entry = alive.get(squad.factionId) ?? { hp: 0, squads: 0 };
    entry.hp += squad.hp;
    entry.squads += 1;
    alive.set(squad.factionId, entry);
  }
  return alive;
}

function byTurnLimit(alive: Map<FactionId, Tally>, state: WorldState, maxTurns: number): Outcome {
  const ranked = [...alive.entries()].sort(
    (a, b) => b[1].hp - a[1].hp || b[1].squads - a[1].squads || a[0].localeCompare(b[0]),
  );
  const [first, second] = ranked as [[FactionId, Tally], [FactionId, Tally]];

  if (first[1].hp === second[1].hp && first[1].squads === second[1].squads) {
    return {
      kind: "DRAW",
      winner: null,
      winners: [],
      reason: `Limite de ${maxTurns} tours atteinte, départage impossible : ${first[1].hp} PV et ${first[1].squads} escouades à égalité.`,
      finalTurn: state.turn,
    };
  }
  return {
    kind: "VICTORY",
    winner: first[0],
    winners: [first[0]],
    reason: `Limite de ${maxTurns} tours atteinte ; ${first[0]} l'emporte avec ${first[1].hp} PV restants contre ${second[1].hp}.`,
    finalTurn: state.turn,
  };
}

/**
 * Decide whether the battle is over. Returns null while it should continue.
 * Tie-break at the turn limit: total remaining HP, then living squads, then draw.
 */
export function checkOutcome(state: WorldState, maxTurns: number): Outcome | null {
  const alive = tally(state);

  if (alive.size === 0) {
    return {
      kind: "ANNIHILATION",
      winner: null,
      winners: [],
      reason: "Toutes les factions ont été détruites au même tour.",
      finalTurn: state.turn,
    };
  }
  if (alive.size === 1) {
    const winner = [...alive.keys()][0]!;
    return {
      kind: "VICTORY",
      winner,
      winners: [winner],
      reason: `${winner} est la dernière faction debout.`,
      finalTurn: state.turn,
    };
  }
  if (state.turn < maxTurns) return null;
  return byTurnLimit(alive, state, maxTurns);
}

/**
 * v2 outcome. Adds the joint alliance win: when every surviving faction is
 * mutually allied, the battle stops and they win **together**, with no
 * tie-break. Ranking a shared victory would quietly re-introduce the
 * competition an alliance exists to suspend.
 */
export function checkOutcomeV2(state: WorldState, maxTurns: number, diplomacy: DiplomacyState): Outcome | null {
  const alive = tally(state);
  const factions = [...alive.keys()].sort();

  if (alive.size === 0 || alive.size === 1) return checkOutcome(state, maxTurns);

  const allMutuallyAllied = factions.every((a) => factions.every((b) => a === b || areAllied(diplomacy, a, b)));
  if (allMutuallyAllied) {
    return {
      kind: "ALLIANCE_VICTORY",
      winner: null,
      winners: factions,
      reason: `Victoire d'alliance : ${factions.join(", ")} sont les seules factions restantes et sont mutuellement alliées.`,
      finalTurn: state.turn,
    };
  }

  if (state.turn < maxTurns) return null;
  return byTurnLimit(alive, state, maxTurns);
}
