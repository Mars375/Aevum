import { z } from "zod";
import { FactionIdSchema, type FactionId } from "@abs/contracts";
import { affordable, pay, round } from "./development.js";
import type { Modernization, ModernizationProject } from "./modernization.js";
import { neighbours, type Stock, type World } from "./state.js";

/**
 * Infrastructure — localised investments placed on a city (v9).
 *
 * One module on purpose: schemas, rules and helpers stay together. It never
 * imports the spectator: it reads a structural `InfrastructureContext`
 * (world plus the optional v9 records), so the spectator can hand its own
 * cloned state in without creating a dependency cycle.
 */

export const INFRASTRUCTURE_KINDS = [
  "foundry",
  "thermal_plant",
  "solar_array",
  "research_center",
  "automated_factory",
  "spaceport",
] as const;
export const InfrastructureKindSchema = z.enum(INFRASTRUCTURE_KINDS);
export type InfrastructureKind = z.infer<typeof InfrastructureKindSchema>;

export const InfrastructureCommandSchema = z
  .object({
    city: z.string().min(1),
    kind: InfrastructureKindSchema,
  })
  .strict();
export type InfrastructureCommand = z.infer<typeof InfrastructureCommandSchema>;

export const SiteSchema = z
  .object({
    city: z.string().min(1),
    kind: InfrastructureKindSchema,
    builtAt: z.number().int().nonnegative(),
  })
  .strict();
export type Site = z.infer<typeof SiteSchema>;

export const ConstructionSchema = z
  .object({
    city: z.string().min(1),
    kind: InfrastructureKindSchema,
    remaining: z.number().int().positive(),
    owner: FactionIdSchema,
  })
  .strict();
export type Construction = z.infer<typeof ConstructionSchema>;

export const POLLUTION_CAP = 80;

export const InfrastructureStateSchema = z
  .object({
    sites: z.array(SiteSchema),
    queues: z.array(ConstructionSchema),
    pollution: z.record(z.string(), z.number().min(0).max(POLLUTION_CAP)),
  })
  .strict();
export type InfrastructureState = z.infer<typeof InfrastructureStateSchema>;

/** Structural context: world plus optional v9 records, never spectator. */
export interface InfrastructureContext {
  world: World;
  modernization?: Record<string, Modernization>;
  infrastructure?: InfrastructureState;
}

export interface InfrastructureRule {
  unlock: ModernizationProject;
  cost: { ore: number; wealth: number };
  turns: number;
  supply: number;
  demand: number;
}

/** Published numbers of the v9 contract: unique cost, personal-turn duration. */
export const INFRASTRUCTURE: Record<InfrastructureKind, InfrastructureRule> = {
  foundry: { unlock: "mechanization", cost: { ore: 150, wealth: 200 }, turns: 8, supply: 0, demand: 3 },
  thermal_plant: { unlock: "power_grid", cost: { ore: 120, wealth: 180 }, turns: 8, supply: 6, demand: 0 },
  solar_array: { unlock: "clean_energy", cost: { ore: 100, wealth: 160 }, turns: 8, supply: 4, demand: 0 },
  research_center: { unlock: "computing", cost: { ore: 140, wealth: 220 }, turns: 10, supply: 0, demand: 3 },
  automated_factory: { unlock: "automation", cost: { ore: 200, wealth: 280 }, turns: 12, supply: 0, demand: 4 },
  spaceport: { unlock: "orbital_network", cost: { ore: 260, wealth: 400 }, turns: 14, supply: 0, demand: 5 },
};

export const emptyInfrastructure = (): InfrastructureState => ({
  sites: [],
  queues: [],
  pollution: {},
});

/** Refusal reasons, in the engine's language. */
export const INFRASTRUCTURE_ISSUES = {
  inactive: "Civilisation inactive",
  notOwned: "Ville non possédée",
  unlockMissing: "Déblocage manquant",
  queueActive: "Un chantier est déjà en cours",
  duplicate: "Déjà construit ou en file",
  insufficient: "Réserves insuffisantes",
} as const;

export function infrastructureIssue(
  ctx: InfrastructureContext,
  civId: string,
  kind: InfrastructureKind,
  city: string,
): string | null {
  const civ = ctx.world.civs.find((c) => c.id === civId);
  const rule = INFRASTRUCTURE[kind];
  if (!civ || civ.fellOnTick !== null || civ.population <= 0)
    return INFRASTRUCTURE_ISSUES.inactive;
  const record = ctx.world.simulation?.cities.find((c) => c.id === city);
  if (!record || record.owner !== civId) return INFRASTRUCTURE_ISSUES.notOwned;
  const unlocked = ctx.modernization?.[civId]?.completed.includes(rule.unlock) ?? false;
  if (!unlocked) return INFRASTRUCTURE_ISSUES.unlockMissing;
  const state = ctx.infrastructure;
  if (state && state.queues.some((q) => q.owner === civId))
    return INFRASTRUCTURE_ISSUES.queueActive;
  if (
    state &&
    (state.sites.some((s) => s.city === city && s.kind === kind) ||
      state.queues.some((q) => q.city === city && q.kind === kind))
  )
    return INFRASTRUCTURE_ISSUES.duplicate;
  if (!affordable(civ.stock, rule.cost)) return INFRASTRUCTURE_ISSUES.insufficient;
  return null;
}

/**
 * Pays the cost up front and enqueues one construction per civilisation.
 * Mutates the already-cloned context; returns the issue or null once queued.
 */
export function queueInfrastructure(
  ctx: InfrastructureContext,
  civId: string,
  kind: InfrastructureKind,
  city: string,
): string | null {
  const issue = infrastructureIssue(ctx, civId, kind, city);
  if (issue) return issue;
  const civ = ctx.world.civs.find((c) => c.id === civId)!;
  const rule = INFRASTRUCTURE[kind];
  const state = ctx.infrastructure ?? (ctx.infrastructure = emptyInfrastructure());
  pay(civ.stock, rule.cost);
  state.queues.push({ city, kind, remaining: rule.turns, owner: civId as FactionId });
  return null;
}

/** Sites planted on one city, oldest first. Site ownership follows the city. */
export function sitesOf(ctx: InfrastructureContext, cityId: string): Site[] {
  return (ctx.infrastructure?.sites ?? [])
    .filter((s) => s.city === cityId)
    .sort((a, b) => a.builtAt - b.builtAt || a.kind.localeCompare(b.kind));
}

/**
 * Contiguous dry land held by one civilisation. Rivers are excluded, so a
 * watercourse cuts territory into separate power networks.
 */
export function ownedComponents(ctx: InfrastructureContext, civId: string): number[][] {
  const { board, size } = ctx.world;
  const seen = new Set<number>();
  const components: number[][] = [];
  for (let i = 0; i < board.length; i++) {
    const place = board[i]!;
    if (place.owner !== civId || place.kind === "river" || seen.has(i)) continue;
    const component: number[] = [];
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const tile = stack.pop()!;
      component.push(tile);
      for (const next of neighbours(size, tile)) {
        if (seen.has(next)) continue;
        const neighbour = board[next]!;
        if (neighbour.owner === civId && neighbour.kind !== "river") {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}

export interface ComponentBalance {
  supply: number;
  cleanSupply: number;
  thermalSupply: number;
  demand: number;
  fossilUsed: number;
  deficit: number;
  powerRatio: number;
}

export function componentBalance(
  ctx: InfrastructureContext,
  civId: string,
  component: number[],
): ComponentBalance {
  const cities = new Set(
    (ctx.world.simulation?.cities ?? [])
      .filter((c) => c.owner === civId && component.includes(c.position))
      .map((c) => c.id),
  );
  let cleanSupply = 0;
  let thermalSupply = 0;
  let demand = 0;
  for (const site of ctx.infrastructure?.sites ?? []) {
    if (!cities.has(site.city)) continue;
    const rule = INFRASTRUCTURE[site.kind];
    if (site.kind === "solar_array") cleanSupply += rule.supply;
    else if (site.kind === "thermal_plant") thermalSupply += rule.supply;
    demand += rule.demand;
  }
  const supply = cleanSupply + thermalSupply;
  // Fossil only covers what solar does not: an idle plant emits nothing.
  const fossilUsed = Math.min(thermalSupply, Math.max(0, demand - cleanSupply));
  const deficit = Math.max(0, demand - supply);
  const powerRatio = demand > 0 ? Math.min(1, supply / demand) : 1;
  return { supply, cleanSupply, thermalSupply, demand, fossilUsed, deficit, powerRatio };
}

export interface ComponentReport extends ComponentBalance {
  id: number;
  cities: string[];
}

export interface CityInfrastructureReport {
  city: string;
  sites: Site[];
  pollution: number;
  foodFactor: number;
  powerRatio: number;
  scienceBonus: number;
}

export interface EnergyReport {
  components: ComponentReport[];
  cities: CityInfrastructureReport[];
}

/** Read-only balance and city summary for a civilisation. Never mutates. */
export function energyReport(ctx: InfrastructureContext, civId: string): EnergyReport {
  const components = ownedComponents(ctx, civId);
  const cities = (ctx.world.simulation?.cities ?? []).filter((c) => c.owner === civId);
  const reported = components.map((component, id) => {
    const balance = componentBalance(ctx, civId, component);
    return {
      id,
      cities: cities.filter((c) => component.includes(c.position)).map((c) => c.id),
      ...balance,
    };
  });
  const cityReports = cities.map((city) => {
    const sites = sitesOf(ctx, city.id);
    const component = reported.find((entry) => entry.cities.includes(city.id));
    const demandsPower = sites.some((s) => INFRASTRUCTURE[s.kind].demand > 0);
    const powerRatio = component ? component.powerRatio : demandsPower ? 0 : 1;
    const pollution = ctx.infrastructure?.pollution[city.id] ?? 0;
    return {
      city: city.id,
      sites,
      pollution,
      foodFactor: 1 - 0.25 * Math.min(1, pollution / POLLUTION_CAP),
      powerRatio,
      scienceBonus:
        sites.filter((s) => s.kind === "research_center" || s.kind === "spaceport").length *
        powerRatio,
    };
  });
  return { components: reported, cities: cityReports };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Advances only the acting civilisation's queue, decrements from the first
 * personal turn, and never touches a surviving rival's queue. Queues whose
 * owner is dead or whose city is lost are cancelled without refund, whichever
 * civilisation ticks. Sites stay on their city and follow conquest; sites and
 * pollution of destroyed cities are pruned.
 */
export function tickInfrastructure(ctx: InfrastructureContext, civId: string): InfrastructureContext {
  const state = ctx.infrastructure ?? (ctx.infrastructure = emptyInfrastructure());
  const cities = ctx.world.simulation?.cities ?? [];
  const existing = new Set(cities.map((c) => c.id));
  // Orphan sites of destroyed cities vanish, and so does their pollution.
  state.sites = state.sites.filter((s) => existing.has(s.city));
  for (const id of Object.keys(state.pollution))
    if (!existing.has(id)) delete state.pollution[id];
  const next: Construction[] = [];
  for (const queue of state.queues) {
    const owner = ctx.world.civs.find((c) => c.id === queue.owner);
    const city = cities.find((c) => c.id === queue.city);
    // A construction is cancelled, without refund, when its owner is gone or
    // the city is no longer theirs — whoever ticks this round.
    if (!owner || owner.fellOnTick !== null || owner.population <= 0) continue;
    if (!city || city.owner !== queue.owner) continue;
    if (queue.owner !== civId) {
      next.push(queue); // a surviving rival queue is never decremented
      continue;
    }
    const remaining = queue.remaining - 1;
    if (remaining <= 0)
      state.sites.push({ city: queue.city, kind: queue.kind, builtAt: ctx.world.tick });
    else next.push({ ...queue, remaining });
  }
  state.queues = next;
  return ctx;
}

/**
 * Balances the actor's networks and moves only its cities' pollution:
 * [+2 per unit of thermal utilisation, -1 once per personal turn], clamped to
 * [0, POLLUTION_CAP]. Unused plants emit nothing.
 */
export function tickEnergy(ctx: InfrastructureContext, civId: string): InfrastructureContext {
  const state = ctx.infrastructure ?? (ctx.infrastructure = emptyInfrastructure());
  const components = ownedComponents(ctx, civId);
  const plants = new Set(
    state.sites.filter((s) => s.kind === "thermal_plant").map((s) => s.city),
  );
  for (const city of ctx.world.simulation?.cities ?? []) {
    if (city.owner !== civId) continue;
    const component = components.find((comp) => comp.includes(city.position)) ?? [];
    const balance = componentBalance(ctx, civId, component);
    // Emissions accrue at the producing thermal site only: a city without a
    // plant sitting in the same network only decays.
    const utilization =
      balance.thermalSupply > 0 && plants.has(city.id)
        ? balance.fossilUsed / balance.thermalSupply
        : 0;
    const current = state.pollution[city.id] ?? 0;
    state.pollution[city.id] = clamp(current + 2 * utilization - 1, 0, POLLUTION_CAP);
  }
  return ctx;
}

/**
 * Applies only this city's infrastructure bonuses to a city production entry.
 * Consuming sites scale by power ratio; solar food is passive; pollution
 * lowers food through foodFactor. Science flows via report.scienceBonus.
 */
export function infrastructureProduction(
  production: Stock,
  report: CityInfrastructureReport,
): Stock {
  const has = (kind: InfrastructureKind) => report.sites.some((s) => s.kind === kind);
  const ratio = report.powerRatio;
  return {
    food: round(production.food * report.foodFactor * (has("solar_array") ? 1.1 : 1)),
    timber: round(production.timber * (1 + (has("automated_factory") ? 0.08 : 0) * ratio)),
    ore: round(
      production.ore *
        (1 +
          (has("foundry") ? 0.1 : 0) * ratio +
          (has("automated_factory") ? 0.08 : 0) * ratio),
    ),
    wealth: round(
      production.wealth *
        (1 +
          (has("automated_factory") ? 0.08 : 0) * ratio +
          (has("spaceport") ? 0.15 : 0) * ratio),
    ),
  };
}