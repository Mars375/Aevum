import { ARCHETYPES, type Archetype, type FactionId, type Squad, type Vec2, type WorldState } from "@abs/contracts";

/**
 * Symmetric, fixed, no jitter. Symmetry is what makes comparing two models
 * honest — a randomised deployment would let a general win on the draw.
 */
export const DEPLOYMENT: Record<FactionId, Record<Archetype, Vec2>> = {
  crimson: { MELEE: { x: 2, y: 2 }, RANGED: { x: 1, y: 3 } },
  azure: { MELEE: { x: 13, y: 2 }, RANGED: { x: 14, y: 3 } },
  verdant: { MELEE: { x: 13, y: 13 }, RANGED: { x: 14, y: 12 } },
  amber: { MELEE: { x: 2, y: 13 }, RANGED: { x: 1, y: 12 } },
};

export function squadId(factionId: FactionId, archetype: Archetype): string {
  return `${factionId}-${archetype.toLowerCase()}`;
}

export function createInitialState(factions: readonly FactionId[]): WorldState {
  const squads: Squad[] = [];
  for (const factionId of factions) {
    for (const archetype of ["MELEE", "RANGED"] as const) {
      squads.push({
        id: squadId(factionId, archetype),
        factionId,
        archetype,
        position: { ...DEPLOYMENT[factionId][archetype] },
        hp: ARCHETYPES[archetype].hp,
        maxHp: ARCHETYPES[archetype].hp,
      });
    }
  }
  // Canonical id order, matching what resolveTurn emits. Keeping one ordering
  // everywhere means a replay diff never shows a reshuffle that isn't real.
  squads.sort((a, b) => a.id.localeCompare(b.id));
  return { turn: 0, squads };
}
