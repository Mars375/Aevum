import {
  ARCHETYPES,
  ARMY_BUDGET,
  GRID_SIZE,
  MAX_MEMORY_ENTRIES,
  distance,
  type FactionId,
  type LocalView,
  type MemoryEntry,
  type RememberedSquad,
  type Squad,
  type WorldState,
} from "@abs/contracts";
import { alliesOf, proposalsTo, type DiplomacyState } from "./alliances.js";

/**
 * Project the world down to what one general is shown.
 *
 * All of the fog of war lives here. The v1 architecture note promised phase 2
 * would only have to filter this projection, and it held: the engine, the
 * replay format and the resolution rules are untouched by v2 visibility.
 *
 * A general therefore acts on beliefs, not on truth — orders are still resolved
 * against the real state, so attacking a remembered position can strike empty
 * ground.
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
    rememberedEnemies: [],
    allies: [],
    pendingProposals: [],
    memory: [],
    budget: null,
  };
}

/** Everything a faction can see, given its own squads and its allies'. */
export function visibleTo(state: WorldState, faction: FactionId, allies: readonly FactionId[]): Set<string> {
  const eyes = state.squads.filter((s) => s.factionId === faction || allies.includes(s.factionId));
  const seen = new Set<string>();
  for (const squad of state.squads) {
    if (squad.factionId === faction || allies.includes(squad.factionId)) {
      seen.add(squad.id);
      continue;
    }
    // Shared vision is the first concrete benefit of an alliance.
    if (eyes.some((e) => distance(e.position, squad.position) <= ARCHETYPES[e.archetype].vision)) seen.add(squad.id);
  }
  return seen;
}

export interface V2ViewInput {
  state: WorldState;
  you: FactionId;
  maxTurns: number;
  gridSize: number;
  diplomacy: DiplomacyState;
  factions: readonly FactionId[];
  /** Last known sighting per enemy squad id, carried across turns. */
  sightings: Map<string, RememberedSquad>;
  memory: readonly MemoryEntry[];
  budgetSpent: number;
}

export function localViewForV2(input: V2ViewInput): LocalView {
  const { state, you, diplomacy, factions, sightings } = input;
  const allies = alliesOf(diplomacy, you, factions);
  const seen = visibleTo(state, you, allies);

  const mine: Squad[] = [];
  const visible: Squad[] = [];
  for (const squad of state.squads) {
    if (squad.factionId === you || allies.includes(squad.factionId)) mine.push(squad);
    else if (seen.has(squad.id)) visible.push(squad);
  }

  // Only enemies currently out of sight are remembered; a visible one is not a
  // memory, it is a fact.
  const remembered = [...sightings.values()]
    .filter((r) => !seen.has(r.id) && state.squads.some((s) => s.id === r.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    turn: state.turn,
    maxTurns: input.maxTurns,
    gridSize: input.gridSize,
    you,
    yourSquads: mine,
    enemySquads: visible,
    rememberedEnemies: remembered,
    allies,
    pendingProposals: proposalsTo(diplomacy, you),
    memory: input.memory.slice(-MAX_MEMORY_ENTRIES),
    budget: { spent: input.budgetSpent, total: ARMY_BUDGET },
  };
}

/** Refresh a faction's sightings with what it can see right now. */
export function updateSightings(
  sightings: Map<string, RememberedSquad>,
  state: WorldState,
  faction: FactionId,
  allies: readonly FactionId[],
): Map<string, RememberedSquad> {
  const next = new Map(sightings);
  const seen = visibleTo(state, faction, allies);
  for (const squad of state.squads) {
    if (squad.factionId === faction || allies.includes(squad.factionId)) continue;
    if (seen.has(squad.id)) next.set(squad.id, { ...squad, position: { ...squad.position }, lastSeenTurn: state.turn });
  }
  // A destroyed squad stops being remembered — the general saw it die.
  for (const id of [...next.keys()]) if (!state.squads.some((s) => s.id === id)) next.delete(id);
  return next;
}

/**
 * Build a faction's digest from events the engine actually emitted.
 *
 * Never written by a model, so it cannot hallucinate a memory (invariant I18),
 * and capped at MAX_MEMORY_ENTRIES so token cost does not grow with battle
 * length (I17) — the first trap any long-running agent loop falls into.
 */
export function appendMemory(
  memory: readonly MemoryEntry[],
  turn: number,
  faction: FactionId,
  lost: string[],
  destroyed: string[],
  diplomacy: string[],
): MemoryEntry[] {
  if (!lost.length && !destroyed.length && !diplomacy.length) return [...memory];
  return [...memory, { turn, lost, destroyed, diplomacy }].slice(-MAX_MEMORY_ENTRIES);
}
