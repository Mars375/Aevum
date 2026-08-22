import type { Civ } from "./state.js";

/**
 * Advances are w8 milestones, not rule modifiers. Changing their effects would
 * require a new world version so recorded w8 journals keep replaying unchanged.
 */
export const ADVANCES: Array<{ name: string; when: (c: Civ) => boolean }> = [
  { name: "irrigation", when: (c) => c.stock.food >= 600 },
  { name: "masonry", when: (c) => c.stock.timber >= 400 && c.territory >= 8 },
  { name: "metallurgy", when: (c) => c.stock.ore >= 300 },
  { name: "coinage", when: (c) => c.stock.wealth >= 500 },
  { name: "engineering", when: (c) => c.advances.includes("masonry") && c.advances.includes("metallurgy") },
];
