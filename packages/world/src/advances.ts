import type { Civ } from "./state.js";

export interface Advance {
  name: string;
  /** Objective acquisition condition, kept beside the executable predicate. */
  threshold: string;
  /** w8 records progress but deliberately grants no resolution modifier. */
  engineEffect: "milestone-only";
  tradeoff: "none";
  worldVersion: `w${number}`;
  when: (civ: Civ) => boolean;
}

const versionNumber = (version: string): number => Number.parseInt(version.slice(1), 10);

/** A later advance cannot leak into an archived world's replay. */
export function advanceAvailableIn(advance: Advance, worldVersion: string): boolean {
  return versionNumber(advance.worldVersion) <= versionNumber(worldVersion);
}

/**
 * Advances are w8 milestones, not rule modifiers. Changing their effects would
 * require a new world version with a declared cost so recorded w8 journals keep
 * replaying unchanged.
 */
export const ADVANCES: Advance[] = [
  { name: "irrigation", threshold: "food >= 600", engineEffect: "milestone-only", tradeoff: "none", worldVersion: "w8", when: (c) => c.stock.food >= 600 },
  { name: "masonry", threshold: "timber >= 400 and territory >= 8", engineEffect: "milestone-only", tradeoff: "none", worldVersion: "w8", when: (c) => c.stock.timber >= 400 && c.territory >= 8 },
  { name: "metallurgy", threshold: "ore >= 300", engineEffect: "milestone-only", tradeoff: "none", worldVersion: "w8", when: (c) => c.stock.ore >= 300 },
  { name: "coinage", threshold: "wealth >= 500", engineEffect: "milestone-only", tradeoff: "none", worldVersion: "w8", when: (c) => c.stock.wealth >= 500 },
  { name: "engineering", threshold: "masonry and metallurgy", engineEffect: "milestone-only", tradeoff: "none", worldVersion: "w8", when: (c) => c.advances.includes("masonry") && c.advances.includes("metallurgy") },
];
