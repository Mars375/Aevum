import { visibleSquadIds, type FactionId, type Replay, type Squad } from "@abs/contracts";

/**
 * What one general knows at a given turn: what it can see, and where it last
 * saw everything else.
 *
 * Rebuilt by walking the turns rather than stored in the replay — four factions
 * times twelve turns of projections would inflate the file for something
 * entirely derivable. It calls the engine's own `visibleSquadIds`, so the
 * player and the engine cannot disagree about who sees what.
 */
export interface Knowledge {
  visible: Set<string>;
  /** Enemies out of sight, at the position and turn they were last observed. */
  remembered: Map<string, { squad: Squad; turn: number }>;
}

export function alliesOfAt(replay: Replay, faction: FactionId, turnIndex: number): FactionId[] {
  if (turnIndex === 0) return [];
  const pairs = replay.turns[turnIndex - 1]?.alliances?.pairs ?? [];
  return pairs
    .filter((p) => p.split("|").includes(faction))
    .flatMap((p) => p.split("|"))
    .filter((f) => f !== faction) as FactionId[];
}

const stateAt = (replay: Replay, i: number) => (i === 0 ? replay.initialState : replay.turns[i - 1]!.stateAfter);

export function knowledgeOf(replay: Replay, faction: FactionId, turnIndex: number): Knowledge {
  const allies = alliesOfAt(replay, faction, turnIndex);
  const own = (s: Squad) => s.factionId === faction || allies.includes(s.factionId);

  const remembered = new Map<string, { squad: Squad; turn: number }>();
  for (let i = 0; i <= turnIndex; i += 1) {
    const state = stateAt(replay, i);
    const seen = visibleSquadIds(state.squads, faction, allies);
    for (const squad of state.squads) {
      if (own(squad)) continue;
      if (seen.has(squad.id)) remembered.set(squad.id, { squad, turn: i });
    }
  }

  const current = stateAt(replay, turnIndex);
  const visible = visibleSquadIds(current.squads, faction, allies);
  // A squad in sight is a fact, not a memory; one that no longer exists was
  // seen to die and is not remembered either.
  for (const id of visible) remembered.delete(id);
  for (const id of [...remembered.keys()]) {
    if (!current.squads.some((s) => s.id === id)) remembered.delete(id);
  }
  return { visible, remembered };
}
