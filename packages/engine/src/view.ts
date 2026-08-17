import { GRID_SIZE, type FactionId, type LocalView, type WorldState } from "@abs/contracts";

/**
 * Project the world down to what one general is shown. Visibility is total at
 * ruleset v1, so this only splits friend from foe — but keeping it a separate
 * projection is what lets phase 2 add fog of war here, without touching the
 * engine or the replay format.
 */
export function localViewFor(
  state: WorldState,
  you: FactionId,
  maxTurns: number,
  gridSize: number = GRID_SIZE,
): LocalView {
  return {
    turn: state.turn,
    maxTurns,
    gridSize,
    you,
    yourSquads: state.squads.filter((s) => s.factionId === you),
    enemySquads: state.squads.filter((s) => s.factionId !== you),
  };
}
