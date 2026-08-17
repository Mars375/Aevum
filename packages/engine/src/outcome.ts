import type { FactionId, Outcome, WorldState } from "@abs/contracts";

/**
 * Decide whether the battle is over. Returns null while it should continue.
 * Tie-break at the turn limit: total remaining HP, then living squads, then draw.
 */
export function checkOutcome(state: WorldState, maxTurns: number): Outcome | null {
  const alive = new Map<FactionId, { hp: number; squads: number }>();
  for (const squad of state.squads) {
    const entry = alive.get(squad.factionId) ?? { hp: 0, squads: 0 };
    entry.hp += squad.hp;
    entry.squads += 1;
    alive.set(squad.factionId, entry);
  }

  if (alive.size === 0) {
    return {
      kind: "ANNIHILATION",
      winner: null,
      reason: "Toutes les factions ont été détruites au même tour.",
      finalTurn: state.turn,
    };
  }
  if (alive.size === 1) {
    const winner = [...alive.keys()][0]!;
    return {
      kind: "VICTORY",
      winner,
      reason: `${winner} est la dernière faction debout.`,
      finalTurn: state.turn,
    };
  }
  if (state.turn < maxTurns) return null;

  const ranked = [...alive.entries()].sort(
    (a, b) => b[1].hp - a[1].hp || b[1].squads - a[1].squads || a[0].localeCompare(b[0]),
  );
  const [first, second] = ranked as [[FactionId, { hp: number; squads: number }], [FactionId, { hp: number; squads: number }]];

  if (first[1].hp === second[1].hp && first[1].squads === second[1].squads) {
    return {
      kind: "DRAW",
      winner: null,
      reason: `Limite de ${maxTurns} tours atteinte, départage impossible : ${first[1].hp} PV et ${first[1].squads} escouades à égalité.`,
      finalTurn: state.turn,
    };
  }
  return {
    kind: "VICTORY",
    winner: first[0],
    reason: `Limite de ${maxTurns} tours atteinte ; ${first[0]} l'emporte avec ${first[1].hp} PV restants contre ${second[1].hp}.`,
    finalTurn: state.turn,
  };
}
