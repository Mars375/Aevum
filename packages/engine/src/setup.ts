import {
  ARCHETYPES,
  ARMY_BUDGET,
  MAX_SQUADS_PER_FACTION,
  type Archetype,
  type FactionId,
  type Squad,
  type Vec2,
  type WorldState,
} from "@abs/contracts";

/**
 * Deployment tiles per corner, in the order squads claim them.
 *
 * v1 placed exactly one MELEE and one RANGED, at fixed tiles. Those two tiles
 * are still first in every list, and v1 squads are still sorted canonically by
 * id (`-melee` before `-ranged`), so a v1 battle deploys byte-identically under
 * the v2 engine — invariant I20. The two extra tiles exist only for v2, where a
 * faction may field up to four squads.
 *
 * Symmetric by reflection, and in Chebyshev distance every pair of corners is
 * exactly 11 apart, diagonals included. No corner is advantaged.
 */
export const DEPLOYMENT_TILES: Record<FactionId, Vec2[]> = {
  crimson: [
    { x: 2, y: 2 },
    { x: 1, y: 3 },
    { x: 3, y: 1 },
    { x: 1, y: 1 },
  ],
  azure: [
    { x: 13, y: 2 },
    { x: 14, y: 3 },
    { x: 12, y: 1 },
    { x: 14, y: 1 },
  ],
  verdant: [
    { x: 13, y: 13 },
    { x: 14, y: 12 },
    { x: 12, y: 14 },
    { x: 14, y: 14 },
  ],
  amber: [
    { x: 2, y: 13 },
    { x: 1, y: 12 },
    { x: 3, y: 14 },
    { x: 1, y: 14 },
  ],
};

/** Kept for the v1 path and for anything still reading per-archetype tiles. */
export const DEPLOYMENT: Record<FactionId, Record<"MELEE" | "RANGED", Vec2>> = {
  crimson: { MELEE: DEPLOYMENT_TILES.crimson[0]!, RANGED: DEPLOYMENT_TILES.crimson[1]! },
  azure: { MELEE: DEPLOYMENT_TILES.azure[0]!, RANGED: DEPLOYMENT_TILES.azure[1]! },
  verdant: { MELEE: DEPLOYMENT_TILES.verdant[0]!, RANGED: DEPLOYMENT_TILES.verdant[1]! },
  amber: { MELEE: DEPLOYMENT_TILES.amber[0]!, RANGED: DEPLOYMENT_TILES.amber[1]! },
};

/** v1 ids stay `faction-archetype`; v2 ids always carry an index. */
export function squadId(factionId: FactionId, archetype: Archetype): string {
  return `${factionId}-${archetype.toLowerCase()}`;
}

/** The composition every faction fields at v1. Never changes. */
export const V1_COMPOSITION: Archetype[] = ["MELEE", "RANGED"];

/** Used when a v2 composition is rejected. 17 of 20 points. */
export const DEFAULT_V2_COMPOSITION: Archetype[] = ["MELEE", "RANGED", "SCOUT"];

export type CompositionRejection = "OVER_BUDGET" | "TOO_MANY_SQUADS" | "EMPTY" | "NO_OFFENSE";

export function compositionCost(composition: readonly Archetype[]): number {
  return composition.reduce((n, a) => n + ARCHETYPES[a].cost, 0);
}

/**
 * Why a composition is illegal, or null when it is fine. The engine never
 * repairs a composition to make it fit — it rejects it and substitutes the
 * default, so the replay records that the general overspent.
 */
export function validateComposition(composition: readonly Archetype[]): CompositionRejection | null {
  if (composition.length === 0) return "EMPTY";
  if (composition.length > MAX_SQUADS_PER_FACTION) return "TOO_MANY_SQUADS";
  if (compositionCost(composition) > ARMY_BUDGET) return "OVER_BUDGET";
  if (!composition.some((a) => ARCHETYPES[a].damage > 0)) return "NO_OFFENSE";
  return null;
}

function makeSquad(factionId: FactionId, archetype: Archetype, id: string, position: Vec2): Squad {
  return {
    id,
    factionId,
    archetype,
    position: { ...position },
    hp: ARCHETYPES[archetype].hp,
    maxHp: ARCHETYPES[archetype].hp,
  };
}

/** v1: one MELEE and one RANGED per faction, at the historical tiles. */
export function createInitialState(factions: readonly FactionId[]): WorldState {
  const squads: Squad[] = [];
  for (const factionId of factions) {
    for (const archetype of V1_COMPOSITION) {
      squads.push(makeSquad(factionId, archetype, squadId(factionId, archetype), DEPLOYMENT[factionId][archetype as "MELEE" | "RANGED"]));
    }
  }
  // Canonical id order everywhere, matching what resolveTurn emits.
  squads.sort((a, b) => a.id.localeCompare(b.id));
  return { turn: 0, squads };
}

/**
 * v2: each faction fields the composition it bought. Ids always carry a
 * 1-based index because a composition may hold two squads of one archetype.
 */
export function createInitialStateV2(compositions: Record<FactionId, readonly Archetype[]>): WorldState {
  const squads: Squad[] = [];
  for (const factionId of Object.keys(compositions).sort() as FactionId[]) {
    const composition = compositions[factionId]!;
    const tiles = DEPLOYMENT_TILES[factionId];
    composition.forEach((archetype, i) => {
      const seen = composition.slice(0, i + 1).filter((a) => a === archetype).length;
      squads.push(makeSquad(factionId, archetype, `${factionId}-${archetype.toLowerCase()}-${seen}`, tiles[i] ?? tiles[tiles.length - 1]!));
    });
  }
  squads.sort((a, b) => a.id.localeCompare(b.id));
  return { turn: 0, squads };
}
