import { z } from "zod";
import type { World } from "./state.js";
import type { Building } from "./civilization-state.js";

export const AgeSchema = z.enum(["bronze", "classical", "medieval"]);
export type Age = z.infer<typeof AgeSchema>;
export const AGE_NAMES: Record<Age, string> = {
  bronze: "Âge du bronze",
  classical: "Antiquité",
  medieval: "Moyen Âge",
};
export const CivilizationAgeSchema = z.object({
  current: AgeSchema,
  enteredAt: z.number().int().nonnegative(),
  history: z
    .array(z.object({ age: AgeSchema, turn: z.number().int().nonnegative() }))
    .max(3),
});
export const AgeTransitionSchema = z.object({
  civ: z.string(),
  from: AgeSchema,
  to: AgeSchema,
  turn: z.number().int().nonnegative(),
});
export const BUILDING_AGE: Record<Building, Age> = {
  granary: "bronze",
  walls: "bronze",
  workshop: "classical",
  market: "classical",
  academy: "medieval",
};
export const TECHNOLOGY_AGE: Record<string, Age> = {
  irrigation: "bronze",
  masonry: "bronze",
  metallurgy: "classical",
  coinage: "classical",
  engineering: "classical",
  scholarship: "medieval",
};
export const ageAllows = (current: Age, required: Age) =>
  AgeSchema.options.indexOf(current) >= AgeSchema.options.indexOf(required);

/** Conditions are observed facts, not an AI assertion or a calendar deadline. */
export function ageProgress(world: World, civId: string, currentAge: Age) {
  const civ = world.civs.find((c) => c.id === civId)!;
  const cities = world.simulation!.cities.filter((c) => c.owner === civId);
  const next: Age | null =
    currentAge === "bronze"
      ? "classical"
      : currentAge === "classical"
        ? "medieval"
        : null;
  const requirements: {
    label: string;
    current: number;
    required: number;
    met: boolean;
  }[] = [];
  const add = (label: string, value: number, required = 1) =>
    requirements.push({
      label,
      current: value,
      required,
      met: value >= required,
    });
  if (next === "classical") {
    add(
      "Irrigation et maçonnerie",
      ["irrigation", "masonry"].filter((t) => civ.advances.includes(t)).length,
      2,
    );
    add(
      "Grenier construit",
      cities.filter((c) => c.buildings.includes("granary")).length,
    );
    add(
      "Réserves alimentaires (2 par habitant)",
      civ.stock.food,
      Math.max(1, civ.population * 2),
    );
  } else if (next === "medieval") {
    add(
      "Métallurgie, monnaie et ingénierie",
      ["metallurgy", "coinage", "engineering"].filter((t) =>
        civ.advances.includes(t),
      ).length,
      3,
    );
    add("Villes possédées", cities.length, 2);
    add(
      "Atelier construit",
      cities.filter((c) => c.buildings.includes("workshop")).length,
    );
    add(
      "Marché construit",
      cities.filter((c) => c.buildings.includes("market")).length,
    );
    add("Réserves de richesse", civ.stock.wealth, 80);
  }
  const progress = requirements.length
    ? requirements.reduce(
        (sum, r) => sum + Math.min(1, r.current / r.required),
        0,
      ) / requirements.length
    : 1;
  return {
    next,
    requirements,
    progress,
    ready:
      next !== null &&
      civ.fellOnTick === null &&
      requirements.every((r) => r.met),
  };
}
