import { z } from "zod";
import { BuildingSchema } from "./civilization-state.js";
import { BUILDING_RULES, TECHNOLOGIES } from "./development.js";
import type { World } from "./state.js";
import type { CityLedger } from "./city-economy.js";
import { unitPath } from "./units.js";
const PlanFieldsSchema = z
  .object({
    kind: z.enum(["settle", "build", "research", "trade"]),
    targetTile: z.number().int().nonnegative().nullable(),
    targetCity: z.string().min(1).max(120).nullable(),
    targetTech: z
      .enum([
        "irrigation",
        "masonry",
        "metallurgy",
        "coinage",
        "engineering",
        "scholarship",
      ])
      .nullable(),
    targetBuilding: BuildingSchema.nullable(),
    rationale: z.string().max(800),
  })
  .strict();
export type StrategicPlan = z.infer<typeof PlanFieldsSchema>;
function validTargets(plan: StrategicPlan): boolean {
  if (plan.kind === "settle")
    return (
      plan.targetTile !== null &&
      plan.targetCity === null &&
      plan.targetTech === null &&
      plan.targetBuilding === null
    );
  if (plan.kind === "research")
    return (
      plan.targetTech !== null &&
      plan.targetTile === null &&
      plan.targetCity === null &&
      plan.targetBuilding === null
    );
  return (
    plan.targetCity !== null &&
    plan.targetTile === null &&
    plan.targetTech === null &&
    (plan.kind === "build"
      ? plan.targetBuilding !== null
      : plan.targetBuilding === null)
  );
}
export const StrategicPlanSchema = PlanFieldsSchema.refine(
  validTargets,
  "Les cibles doivent correspondre au type du plan.",
);
export const TrackedPlanSchema = PlanFieldsSchema.extend({
  status: z.enum(["active", "completed", "blocked", "cancelled"]),
  progress: z.number().min(0).max(1),
  stagnation: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  detail: z.string().max(1000),
}).refine(validTargets, "Les cibles doivent correspondre au type du plan.");
export type TrackedPlan = z.infer<typeof TrackedPlanSchema>;
export function planIssue(
  world: World,
  civ: string,
  plan: StrategicPlan,
): string | null {
  const city = world.simulation!.cities.find(
    (c) => c.id === plan.targetCity && c.owner === civ,
  );
  if (plan.kind === "settle") {
    const target = plan.targetTile;
    if (
      target === null ||
      !world.board[target] ||
      plan.targetCity !== null ||
      plan.targetTech !== null ||
      plan.targetBuilding !== null
    )
      return "Le plan de fondation exige une case existante et aucun autre objectif.";
    const distance = (a: number, b: number) =>
      Math.abs((a % world.size) - (b % world.size)) +
      Math.abs(Math.floor(a / world.size) - Math.floor(b / world.size));
    if (
      world.board[target]!.owner !== null ||
      world.board[target]!.kind === "river" ||
      world.simulation!.cities.some(
        (city) => distance(city.position, target) < 3,
      )
    )
      return "Le site de fondation est occupé ou trop proche d'une ville.";
    if (
      !world.simulation!.units.some(
        (unit) =>
          unit.owner === civ &&
          unit.role === "settler" &&
          unitPath(world, unit, target).length,
      )
    )
      return "Aucun colon ne peut atteindre ce site.";
    return null;
  }
  if (plan.kind === "research")
    return plan.targetTech !== null &&
      plan.targetTile === null &&
      plan.targetCity === null &&
      plan.targetBuilding === null
      ? null
      : "Le plan de recherche exige uniquement une technologie.";
  if (!city || plan.targetTile !== null || plan.targetTech !== null)
    return "Le plan exige une ville possédée existante, sans case ni technologie.";
  if (plan.kind === "build")
    return plan.targetBuilding !== null
      ? null
      : "Le plan de construction exige un bâtiment.";
  return plan.targetBuilding === null
    ? null
    : "Le plan commercial ne doit pas cibler de bâtiment.";
}
export function startPlan(plan: StrategicPlan, tick: number): TrackedPlan {
  return {
    ...plan,
    status: "active",
    progress: 0,
    stagnation: 0,
    startedAt: tick,
    updatedAt: tick,
    detail: "Plan adopté.",
  };
}
/** Only observed world outcomes advance a plan; the plan itself executes no actions. */
export function advancePlan(
  plan: TrackedPlan,
  world: World,
  civId: string,
  economy: CityLedger[],
  research: string | null,
): TrackedPlan {
  if (plan.status === "completed" || plan.status === "cancelled") return plan;
  const next = { ...plan, updatedAt: world.tick };
  const civ = world.civs.find((c) => c.id === civId);
  const sim = world.simulation!;
  let progress = 0,
    blocked = false,
    detail = "Aucun progrès constaté.";
  if (!civ || civ.fellOnTick !== null) {
    blocked = true;
    detail = "La civilisation ne peut plus poursuivre ce plan.";
  } else if (plan.kind === "settle") {
    const target = plan.targetTile!;
    if (sim.cities.some((c) => c.position === target && c.owner === civId)) {
      progress = 1;
      detail = "La ville est fondée sur la case prévue.";
    } else if (
      !world.board[target] ||
      world.board[target]!.owner !== null ||
      world.board[target]!.kind === "river"
    ) {
      blocked = true;
      detail = "La case de fondation est indisponible.";
    } else {
      const distances = sim.units
        .filter((u) => u.owner === civId && u.role === "settler")
        .map((u) => unitPath(world, u, target))
        .filter((route) => route.length)
        .map((route) => route.length - 1);
      if (planIssue(world, civId, plan)) {
        blocked = true;
        detail = "Site inaccessible ou trop proche d'une ville.";
      } else if (distances.length) {
        const distance = Math.min(...distances);
        progress = 0.8 / (1 + distance);
        detail = `Colons à ${distance} case(s) de l'objectif.`;
      } else {
        blocked = true;
        detail = "Aucun colon disponible.";
      }
    }
  } else if (plan.kind === "research") {
    const tech = TECHNOLOGIES.find((t) => t.name === plan.targetTech)!;
    if (civ.advances.includes(tech.name)) {
      progress = 1;
      detail = "La technologie est acquise.";
    } else if (!tech.requires.every((p) => civ.advances.includes(p))) {
      blocked = true;
      detail = "Des technologies préalables sont nécessaires.";
    } else if (research === tech.name) {
      progress = Math.min(0.99, (civ.science ?? 0) / tech.cost);
      detail = `Recherche : ${Math.round(progress * 100)} % du coût atteint.`;
    }
  } else {
    const city = sim.cities.find(
      (c) => c.id === plan.targetCity && c.owner === civId,
    );
    if (!city) {
      blocked = true;
      detail = "La ville cible n'est plus possédée.";
    } else if (plan.kind === "build") {
      if (city.buildings.includes(plan.targetBuilding!)) {
        progress = 1;
        detail = "Le bâtiment est terminé.";
      } else if (city.queue?.building === plan.targetBuilding) {
        progress = Math.max(
          0,
          1 - city.queue.remaining / BUILDING_RULES[plan.targetBuilding!].years,
        );
        detail = `Chantier : ${city.queue.remaining} tour(s) restant(s).`;
      } else if (city.queue) {
        blocked = true;
        detail = "Un autre chantier occupe la ville.";
      }
    } else if (
      economy.some((c) => c.city === city.id && c.deliveries.length > 0)
    ) {
      progress = 1;
      detail = "Une livraison commerciale a atteint la ville.";
    }
  }
  next.progress = Math.round(progress * 1000) / 1000;
  next.stagnation = next.progress > plan.progress ? 0 : plan.stagnation + 1;
  if (progress !== 1 && next.stagnation >= 6 && !blocked) {
    blocked = true;
    detail = "Aucun progrès depuis six tours : plan à réexaminer.";
  }
  next.status = progress === 1 ? "completed" : blocked ? "blocked" : "active";
  next.detail = detail;
  return next;
}
