import { z } from "zod";
import { ageAllows, type Age } from "./ages.js";
import { affordable, pay } from "./development.js";
import type { World, Stock } from "./state.js";

export const ModernizationProjectSchema = z.enum([
  "mechanization",
  "power_grid",
  "computing",
  "clean_energy",
  "automation",
  "orbital_network",
]);
export type ModernizationProject = z.infer<typeof ModernizationProjectSchema>;
export const ModernizationSchema = z.object({
  completed: z.array(ModernizationProjectSchema).max(6),
  active: z
    .object({
      project: ModernizationProjectSchema,
      remaining: z.number().int().positive(),
      startedAt: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type Modernization = z.infer<typeof ModernizationSchema>;
type Program = {
  name: string;
  age: Age;
  requires: ModernizationProject[];
  science: number;
  turns: number;
  cost: Partial<Stock>;
  effect: string;
};
export const MODERNIZATION: Record<ModernizationProject, Program> = {
  mechanization: {
    name: "Mécanisation",
    age: "medieval",
    requires: [],
    science: 100,
    turns: 8,
    cost: { timber: 120, ore: 100, wealth: 180 },
    effect: "+20 % de production de bois et de minerai",
  },
  power_grid: {
    name: "Réseau électrique",
    age: "industrial",
    requires: ["mechanization"],
    science: 100,
    turns: 8,
    cost: { ore: 150, wealth: 240 },
    effect: "+15 % de production de richesse",
  },
  computing: {
    name: "Informatique",
    age: "industrial",
    requires: ["power_grid"],
    science: 140,
    turns: 10,
    cost: { ore: 100, wealth: 260 },
    effect: "+1 point de science par ville et par tour personnel",
  },
  clean_energy: {
    name: "Énergie propre",
    age: "modern",
    requires: ["power_grid"],
    science: 140,
    turns: 10,
    cost: { ore: 180, wealth: 300 },
    effect: "+15 % de production alimentaire",
  },
  automation: {
    name: "Automatisation",
    age: "modern",
    requires: ["computing"],
    science: 180,
    turns: 12,
    cost: { ore: 220, wealth: 350 },
    effect: "+15 % de production de bois, minerai et richesse",
  },
  orbital_network: {
    name: "Réseau orbital",
    age: "future",
    requires: ["automation", "clean_energy"],
    science: 220,
    turns: 14,
    cost: { ore: 300, wealth: 500 },
    effect: "+20 % de richesse et +1 point de science par ville",
  },
};

export function modernizationIssue(
  world: World,
  civId: string,
  age: Age,
  state: Modernization,
  project: ModernizationProject,
) {
  const civ = world.civs.find((c) => c.id === civId);
  const rule = MODERNIZATION[project];
  if (!civ || civ.fellOnTick !== null || !civ.population)
    return "Civilisation inactive";
  if (state.active) return "Un programme de modernisation est déjà en cours";
  if (state.completed.includes(project)) return "Programme déjà achevé";
  if (!ageAllows(age, rule.age)) return "Programme inaccessible à cet âge";
  if (!rule.requires.every((p) => state.completed.includes(p)))
    return "Programme préalable manquant";
  if (
    !civ.advances.includes("scholarship") ||
    !world.simulation!.cities.some(
      (c) => c.owner === civId && c.buildings.includes("academy"),
    )
  )
    return "Une académie et l'érudition sont nécessaires";
  if ((civ.science ?? 0) < rule.science || !affordable(civ.stock, rule.cost))
    return "Réserves ou science insuffisantes";
  return null;
}

export function startModernization(
  world: World,
  civId: string,
  age: Age,
  state: Modernization,
  project: ModernizationProject,
) {
  const issue = modernizationIssue(world, civId, age, state, project);
  if (issue) return issue;
  const civ = world.civs.find((c) => c.id === civId)!;
  const rule = MODERNIZATION[project];
  pay(civ.stock, rule.cost);
  civ.science = (civ.science ?? 0) - rule.science;
  state.active = { project, remaining: rule.turns, startedAt: world.tick };
  return null;
}

export function modernizationProduction(
  production: Stock,
  state: Modernization,
): Stock {
  const has = (project: ModernizationProject) =>
    state.completed.includes(project);
  return {
    food: production.food * (has("clean_energy") ? 1.15 : 1),
    timber:
      production.timber *
      (1 + (has("mechanization") ? 0.2 : 0) + (has("automation") ? 0.15 : 0)),
    ore:
      production.ore *
      (1 + (has("mechanization") ? 0.2 : 0) + (has("automation") ? 0.15 : 0)),
    wealth:
      production.wealth *
      (1 +
        (has("power_grid") ? 0.15 : 0) +
        (has("automation") ? 0.15 : 0) +
        (has("orbital_network") ? 0.2 : 0)),
  };
}
