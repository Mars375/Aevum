import type { Age } from "./ages.js";

/**
 * Era baseline for military capability. Power multiplies attack damage,
 * resilience multiplies the structural defence of towns and fortifications.
 * The profile is a pure function of observed state, so replays stay
 * deterministic and the same world gives the same results every time.
 *
 * spectator-7 uses these profiles in combat. Older rule versions keep their
 * original formulas so archived campaigns replay byte for byte.
 */
export const MILITARY_AGE_POWER: Record<Age, number> = {
  bronze: 1,
  classical: 1.2,
  medieval: 1.6,
  industrial: 2.4,
  modern: 3.8,
  future: 6,
};
export const MILITARY_AGE_RESILIENCE: Record<Age, number> = {
  bronze: 1,
  classical: 1.1,
  medieval: 1.25,
  industrial: 1.6,
  modern: 2.2,
  future: 3,
};
/** Additional attack power from research or a completed modernization programme. */
export const MILITARY_POWER_TECHS: Readonly<Record<string, number>> = {
  metallurgy: 0.15,
  engineering: 0.1,
  scholarship: 0.1,
  mechanization: 0.5,
  computing: 0.5,
  automation: 0.8,
  orbital_network: 0.4,
};
/** Additional defensive resilience from research or a completed programme. */
export const MILITARY_RESILIENCE_TECHS: Readonly<Record<string, number>> = {
  masonry: 0.1,
  engineering: 0.15,
  power_grid: 0.4,
  clean_energy: 0.3,
};

export interface MilitaryProfile {
  age: Age;
  power: number;
  resilience: number;
}

const rounded = (value: number) => Math.round(value * 100) / 100;

export function militaryProfile(
  age: Age,
  advances: readonly string[],
  completedPrograms: readonly string[],
): MilitaryProfile {
  const known = new Set([...advances, ...completedPrograms]);
  let power = MILITARY_AGE_POWER[age];
  let resilience = MILITARY_AGE_RESILIENCE[age];
  for (const [tech, bonus] of Object.entries(MILITARY_POWER_TECHS))
    if (known.has(tech)) power += bonus;
  for (const [tech, bonus] of Object.entries(MILITARY_RESILIENCE_TECHS))
    if (known.has(tech)) resilience += bonus;
  return { age, power: rounded(power), resilience: rounded(resilience) };
}
