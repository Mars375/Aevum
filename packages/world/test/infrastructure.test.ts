import { describe, it, expect } from "vitest";
import { newCivilizationWorld } from "../src/civilization.js";
import type { Modernization } from "../src/modernization.js";
import { census, neighbours } from "../src/state.js";
import {
  INFRASTRUCTURE,
  InfrastructureCommandSchema,
  InfrastructureStateSchema,
  componentBalance,
  energyReport,
  infrastructureIssue,
  infrastructureProduction,
  ownedComponents,
  queueInfrastructure,
  sitesOf,
  tickEnergy,
  tickInfrastructure,
  type CityInfrastructureReport,
  type InfrastructureContext,
} from "../src/infrastructure.js";

function fresh(): InfrastructureContext {
  const world = newCivilizationWorld(["amber", "azure"], 7);
  const modernization: Record<string, Modernization> = {
    amber: { completed: [], active: null },
    azure: { completed: [], active: null },
  };
  return {
    world,
    modernization,
    infrastructure: { sites: [], queues: [], pollution: {} },
  };
}

const amberCity = (ctx: InfrastructureContext) =>
  ctx.world.simulation!.cities.find((c) => c.owner === "amber")!.id;
const azureCity = (ctx: InfrastructureContext) =>
  ctx.world.simulation!.cities.find((c) => c.owner === "azure")!.id;
const amberCapital = (ctx: InfrastructureContext) =>
  ctx.world.civs.find((c) => c.id === "amber")!.capital!;

function rich(ctx: InfrastructureContext) {
  const civ = ctx.world.civs.find((c) => c.id === "amber")!;
  civ.stock = { food: 1000, timber: 1000, ore: 1000, wealth: 1000 };
  return civ;
}

/** Claim the tile and its non-river neighbours for amber, then re-census. */
function claimAround(ctx: InfrastructureContext, around: number): number[] {
  const tiles = [around, ...neighbours(ctx.world.size, around)].filter(
    (i) => ctx.world.board[i]!.kind !== "river",
  );
  for (const i of tiles) ctx.world.board[i]!.owner = "amber";
  ctx.world = census(ctx.world);
  return tiles;
}

/** Farthest non-river tile amber may still take (never another civ's seat). */
function farTile(ctx: InfrastructureContext): number {
  const from = amberCapital(ctx);
  let best = -1;
  let bestDistance = -1;
  for (let i = 0; i < ctx.world.board.length; i++) {
    if (ctx.world.board[i]!.kind === "river") continue;
    const owner = ctx.world.board[i]!.owner;
    if (owner !== null && owner !== "amber") continue;
    const d =
      Math.abs((i % ctx.world.size) - (from % ctx.world.size)) +
      Math.abs(Math.floor(i / ctx.world.size) - Math.floor(from / ctx.world.size));
    if (d > bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}

function addCity(
  ctx: InfrastructureContext,
  id: string,
  position: number,
  owner: "amber" | "azure" = "amber",
) {
  ctx.world.board[position]!.owner = owner;
  ctx.world.simulation!.cities.push({
    id,
    owner,
    position,
    founded: 0,
    buildings: [],
    queue: null,
  });
  ctx.world = census(ctx.world);
}

describe("infrastructure schemas", () => {
  it("describe pure data with strict commands", () => {
    expect(InfrastructureCommandSchema.parse({ city: "city-amber", kind: "foundry" })).toEqual({
      city: "city-amber",
      kind: "foundry",
    });
    expect(
      InfrastructureCommandSchema.safeParse({ city: "c", kind: "foundry", extra: true }).success,
    ).toBe(false);
    const state = InfrastructureStateSchema.parse({
      sites: [{ city: "city-amber", kind: "solar_array", builtAt: 3 }],
      queues: [{ city: "city-amber", kind: "foundry", remaining: 8, owner: "amber" }],
      pollution: { "city-amber": 12 },
    });
    expect(state.sites[0]!.builtAt).toBe(3);
    expect(
      InfrastructureStateSchema.safeParse({
        sites: [],
        queues: [],
        pollution: { "city-amber": -1 },
      }).success,
    ).toBe(false);
    expect(
      InfrastructureStateSchema.safeParse({
        sites: [],
        queues: [],
        pollution: { "city-amber": 81 },
      }).success,
    ).toBe(false);
    expect(
      InfrastructureStateSchema.safeParse({
        sites: [],
        queues: [],
        pollution: { "city-amber": 80 },
      }).success,
    ).toBe(true);
  });
});

describe("queueInfrastructure", () => {
  it("pays once when accepted and leaves the context untouched on rejection", () => {
    const ctx = fresh();
    ctx.modernization!.amber!.completed = ["mechanization"];
    const civ = rich(ctx);
    const city = amberCity(ctx);
    expect(queueInfrastructure(ctx, "amber", "foundry", city)).toBeNull();
    expect(civ.stock.ore).toBe(1000 - INFRASTRUCTURE.foundry.cost.ore);
    expect(civ.stock.wealth).toBe(1000 - INFRASTRUCTURE.foundry.cost.wealth);
    expect(ctx.infrastructure!.queues).toEqual([
      { city, kind: "foundry", remaining: INFRASTRUCTURE.foundry.turns, owner: "amber" },
    ]);
    const before = structuredClone(ctx);
    expect(queueInfrastructure(ctx, "amber", "foundry", city)).toBe(
      "Un chantier est déjà en cours",
    );
    expect(queueInfrastructure(ctx, "amber", "thermal_plant", city)).toBe(
      "Déblocage manquant",
    );
    expect(queueInfrastructure(ctx, "azure", "foundry", city)).toBe("Ville non possédée");
    expect(queueInfrastructure(ctx, "amber", "foundry", "missing-city")).toBe(
      "Ville non possédée",
    );
    expect(ctx).toEqual(before);
  });

  it("rejects a duplicate site already built in the same city", () => {
    const ctx = fresh();
    ctx.modernization!.amber!.completed = ["mechanization", "clean_energy"];
    rich(ctx);
    const city = amberCity(ctx);
    ctx.infrastructure!.sites.push({ city, kind: "foundry", builtAt: 5 });
    expect(queueInfrastructure(ctx, "amber", "foundry", city)).toBe("Déjà construit ou en file");
    expect(queueInfrastructure(ctx, "amber", "solar_array", city)).toBeNull();
    expect(ctx.infrastructure!.queues).toHaveLength(1);
  });

  it("rejects a missing unlock or insufficient reserves without spending", () => {
    const ctx = fresh();
    const civ = ctx.world.civs.find((c) => c.id === "amber")!;
    civ.stock = { food: 1000, timber: 1000, ore: 10, wealth: 1000 };
    const city = amberCity(ctx);
    expect(queueInfrastructure(ctx, "amber", "thermal_plant", city)).toBe(
      "Déblocage manquant",
    );
    ctx.modernization!.amber!.completed = ["power_grid"];
    expect(queueInfrastructure(ctx, "amber", "thermal_plant", city)).toBe(
      "Réserves insuffisantes",
    );
    expect(ctx.infrastructure!.queues).toEqual([]);
    expect(civ.stock.ore).toBe(10);
  });

  it("rejects when the civilisation is inactive", () => {
    const ctx = fresh();
    ctx.modernization!.amber!.completed = ["mechanization"];
    rich(ctx);
    ctx.world.civs.find((c) => c.id === "amber")!.fellOnTick = 5;
    expect(queueInfrastructure(ctx, "amber", "foundry", amberCity(ctx))).toBe(
      "Civilisation inactive",
    );
  });

  /**
   * Callers build their context inline, so a helper that quietly created its
   * own records would have written the queue into a throwaway object — after
   * `pay()` had already taken the reserves from the shared stock. Complaining
   * is the point: the loss would otherwise leave no trace at all.
   */
  it("faults on missing records instead of paying into a void", () => {
    const ctx = fresh();
    ctx.modernization!.amber!.completed = ["mechanization"];
    const civ = rich(ctx);
    const city = amberCity(ctx);
    const before = { ...civ.stock };
    const orphan = { world: ctx.world, modernization: ctx.modernization };
    expect(() => queueInfrastructure(orphan, "amber", "foundry", city)).toThrow(
      "Infrastructure records required",
    );
    expect(civ.stock).toEqual(before);
  });

  it("validates the same rules through infrastructureIssue", () => {
    const ctx = fresh();
    ctx.modernization!.amber!.completed = ["mechanization"];
    rich(ctx);
    const city = amberCity(ctx);
    expect(infrastructureIssue(ctx, "amber", "foundry", city)).toBeNull();
    expect(infrastructureIssue(ctx, "azure", "foundry", city)).toBe("Ville non possédée");
    expect(infrastructureIssue(ctx, "amber", "solar_array", city)).toBe("Déblocage manquant");
  });
});

describe("tickInfrastructure", () => {
  it("advances only the acting civilisation's queue, from the first turn", () => {
    const ctx = fresh();
    const cityA = amberCity(ctx);
    const cityB = azureCity(ctx);
    ctx.infrastructure!.queues = [
      { city: cityA, kind: "foundry", remaining: 2, owner: "amber" },
      { city: cityB, kind: "foundry", remaining: 2, owner: "azure" },
    ];
    tickInfrastructure(ctx, "amber");
    expect(ctx.infrastructure!.queues).toEqual([
      { city: cityA, kind: "foundry", remaining: 1, owner: "amber" },
      { city: cityB, kind: "foundry", remaining: 2, owner: "azure" },
    ]);
    tickInfrastructure(ctx, "amber");
    expect(ctx.infrastructure!.queues).toEqual([
      { city: cityB, kind: "foundry", remaining: 2, owner: "azure" },
    ]);
    expect(ctx.infrastructure!.sites).toEqual([
      { city: cityA, kind: "foundry", builtAt: ctx.world.tick },
    ]);
  });

  it("cancels a construction on a lost city without refund and keeps sites on conquest", () => {
    const ctx = fresh();
    const far = farTile(ctx);
    addCity(ctx, "outpost", far, "amber");
    ctx.infrastructure!.queues.push({
      city: "outpost",
      kind: "foundry",
      remaining: 1,
      owner: "amber",
    });
    ctx.infrastructure!.sites.push({ city: "outpost", kind: "solar_array", builtAt: 0 });
    const city = ctx.world.simulation!.cities.find((c) => c.id === "outpost")!;
    city.owner = "azure";
    ctx.world.board[far]!.owner = "azure";
    ctx.world = census(ctx.world);
    tickInfrastructure(ctx, "amber");
    expect(ctx.infrastructure!.queues).toEqual([]);
    expect(ctx.infrastructure!.sites.find((s) => s.city === "outpost")).toBeDefined();
    expect(sitesOf(ctx, "outpost").map((s) => s.kind)).toEqual(["solar_array"]);
  });

  it("removes sites of destroyed cities when the owner ticks", () => {
    const ctx = fresh();
    ctx.infrastructure!.sites.push(
      { city: "city-amber", kind: "solar_array", builtAt: 0 },
      { city: "ruined", kind: "foundry", builtAt: 0 },
    );
    tickInfrastructure(ctx, "amber");
    expect(ctx.infrastructure!.sites.map((s) => s.city)).toEqual(["city-amber"]);
  });

  it("prunes dead-rival queues and destroyed-city pollution, sparing live rivals", () => {
    const civs = ["amber", "azure", "crimson"] as const;
    const ctx: InfrastructureContext = {
      world: newCivilizationWorld([...civs], 7),
      modernization: Object.fromEntries(
        civs.map((c): [string, Modernization] => [c, { completed: [], active: null }]),
      ),
      infrastructure: { sites: [], queues: [], pollution: {} },
    };
    const crimson = ctx.world.civs.find((c) => c.id === "crimson")!;
    crimson.fellOnTick = 2;
    const cityA = amberCity(ctx);
    const cityB = azureCity(ctx);
    const cityC = ctx.world.simulation!.cities.find((c) => c.owner === "crimson")!.id;
    ctx.infrastructure!.queues = [
      { city: cityA, kind: "foundry", remaining: 3, owner: "amber" },
      { city: cityB, kind: "foundry", remaining: 2, owner: "azure" },
      { city: cityC, kind: "foundry", remaining: 5, owner: "crimson" },
    ];
    ctx.infrastructure!.pollution = { [cityA]: 12.5, [cityB]: 7, ruined: 9 };
    const crimsonStock = structuredClone(crimson.stock);
    tickInfrastructure(ctx, "amber");
    // actor advances, a live rival is never decremented, a dead rival is
    // cancelled without refund, and destroyed-city pollution is pruned.
    expect(ctx.infrastructure!.queues).toEqual([
      { city: cityA, kind: "foundry", remaining: 2, owner: "amber" },
      { city: cityB, kind: "foundry", remaining: 2, owner: "azure" },
    ]);
    expect(ctx.infrastructure!.pollution).toEqual({ [cityA]: 12.5, [cityB]: 7 });
    expect(crimson.stock).toEqual(crimsonStock); // cancelled without refund
  });
});

describe("energy networks", () => {
  it("splits owned territory into contiguous dry components", () => {
    const ctx = fresh();
    const main = claimAround(ctx, amberCapital(ctx));
    const far = farTile(ctx);
    const outpost = claimAround(ctx, far);
    const components = ownedComponents(ctx, "amber");
    expect(components.length).toBeGreaterThanOrEqual(2);
    expect(components.some((c) => main.every((t) => c.includes(t)))).toBe(true);
    expect(components.some((c) => outpost.every((t) => c.includes(t)))).toBe(true);
  });

  it("reports disconnected networks with their own balance", () => {
    const ctx = fresh();
    claimAround(ctx, amberCapital(ctx));
    const far = farTile(ctx);
    addCity(ctx, "outpost", far, "amber");
    claimAround(ctx, far);
    const cityA = amberCity(ctx);
    ctx.infrastructure!.sites.push(
      { city: cityA, kind: "solar_array", builtAt: 0 },
      { city: "outpost", kind: "foundry", builtAt: 0 },
    );
    const report = energyReport(ctx, "amber");
    expect(report.components).toHaveLength(2);
    const out = report.components.find((c) => c.cities.includes("outpost"))!;
    expect(out.supply).toBe(0);
    expect(out.demand).toBe(3);
    expect(out.deficit).toBe(3);
    expect(out.fossilUsed).toBe(0);
    expect(out.powerRatio).toBe(0);
    const main = report.components.find((c) => c.cities.includes(cityA))!;
    expect(main.cleanSupply).toBe(4);
    expect(main.supply).toBe(4);
    expect(main.demand).toBe(0);
    expect(main.powerRatio).toBe(1);
    const outCity = report.cities.find((c) => c.city === "outpost")!;
    expect(outCity.powerRatio).toBe(0);
    expect(outCity.scienceBonus).toBe(0);
  });

  it("uses solar first and burns only the uncovered demand", () => {
    const ctx = fresh();
    const city = amberCity(ctx);
    const cluster = claimAround(ctx, amberCapital(ctx));
    ctx.infrastructure!.sites.push(
      { city, kind: "solar_array", builtAt: 0 },
      { city, kind: "thermal_plant", builtAt: 0 },
      { city, kind: "foundry", builtAt: 0 },
    );
    const balance = componentBalance(ctx, "amber", cluster);
    expect(balance.cleanSupply).toBe(4);
    expect(balance.thermalSupply).toBe(6);
    expect(balance.demand).toBe(3);
    expect(balance.fossilUsed).toBe(0);
    expect(balance.deficit).toBe(0);
    expect(balance.powerRatio).toBe(1);
    ctx.infrastructure!.sites.push({ city, kind: "spaceport", builtAt: 0 });
    const covered = componentBalance(ctx, "amber", cluster);
    expect(covered.demand).toBe(8);
    expect(covered.fossilUsed).toBe(4);
    expect(covered.deficit).toBe(0);
    expect(covered.powerRatio).toBe(1);
    expect(covered.fossilUsed).toBeLessThanOrEqual(covered.thermalSupply);
  });
});

describe("tickEnergy", () => {
  it("clamps pollution to [0, 80] and touches only the actor's cities", () => {
    const ctx = fresh();
    const city = amberCity(ctx);
    const downwind = "downwind";
    addCity(ctx, downwind, farTile(ctx), "amber");
    claimAround(ctx, amberCapital(ctx));
    ctx.infrastructure!.pollution = { [city]: 78, [downwind]: 5, [azureCity(ctx)]: 50 };
    ctx.infrastructure!.sites.push(
      { city, kind: "thermal_plant", builtAt: 0 },
      { city, kind: "research_center", builtAt: 0 },
      { city, kind: "spaceport", builtAt: 0 },
    );
    tickEnergy(ctx, "amber");
    // city-amber: demand 8 vs thermal 6 -> utilisation 1 -> +1 per turn.
    expect(ctx.infrastructure!.pollution[city]).toBe(79);
    // no thermal anywhere nearby -> pure decay -1.
    expect(ctx.infrastructure!.pollution[downwind]).toBe(4);
    // another civilisation is never touched by the actor's tick.
    expect(ctx.infrastructure!.pollution[azureCity(ctx)]).toBe(50);
    tickEnergy(ctx, "amber");
    expect(ctx.infrastructure!.pollution[city]).toBe(80);
    tickEnergy(ctx, "amber");
    expect(ctx.infrastructure!.pollution[city]).toBe(80);
  });

  it("emits pollution only at the producing thermal site, solar stops emissions", () => {
    const ctx = fresh();
    const generator = amberCity(ctx);
    const suburbPosition = neighbours(ctx.world.size, amberCapital(ctx)).find(
      (i) => ctx.world.board[i]!.kind !== "river",
    )!;
    addCity(ctx, "suburb", suburbPosition, "amber");
    claimAround(ctx, amberCapital(ctx));
    ctx.infrastructure!.pollution = { [generator]: 10, suburb: 10, [azureCity(ctx)]: 50 };
    ctx.infrastructure!.sites.push(
      { city: generator, kind: "thermal_plant", builtAt: 0 },
      { city: "suburb", kind: "foundry", builtAt: 0 },
      { city: "suburb", kind: "research_center", builtAt: 0 },
      { city: "suburb", kind: "spaceport", builtAt: 0 },
    );
    // demand 11 vs thermal 6 in one connected component -> utilisation 1.
    tickEnergy(ctx, "amber");
    expect(ctx.infrastructure!.pollution[generator]).toBe(11); // +2*1 - 1
    expect(ctx.infrastructure!.pollution.suburb).toBe(9); // decay only, no plant
    expect(ctx.infrastructure!.pollution[azureCity(ctx)]).toBe(50); // rival untouched
    // solar now covers the whole demand: the plant stops and emits nothing.
    ctx.infrastructure!.sites = [
      { city: generator, kind: "thermal_plant", builtAt: 0 },
      { city: "suburb", kind: "foundry", builtAt: 0 },
      { city: "suburb", kind: "solar_array", builtAt: 0 },
    ];
    ctx.infrastructure!.pollution[generator] = 20;
    tickEnergy(ctx, "amber");
    expect(ctx.infrastructure!.pollution[generator]).toBe(19); // -1, no +2
    expect(ctx.infrastructure!.pollution.suburb).toBe(8);
  });
});

describe("infrastructureProduction", () => {
  it("applies the announced bonuses to actual outputs", () => {
    const report: CityInfrastructureReport = {
      city: "city-amber",
      sites: [
        { city: "city-amber", kind: "solar_array", builtAt: 0 },
        { city: "city-amber", kind: "foundry", builtAt: 0 },
        { city: "city-amber", kind: "automated_factory", builtAt: 0 },
        { city: "city-amber", kind: "research_center", builtAt: 0 },
        { city: "city-amber", kind: "spaceport", builtAt: 0 },
      ],
      pollution: 0,
      foodFactor: 1,
      powerRatio: 1,
      scienceBonus: 2,
    };
    const production = { food: 100, timber: 100, ore: 100, wealth: 100 };
    const out = infrastructureProduction(production, report);
    expect(out.food).toBeCloseTo(110);
    expect(out.timber).toBeCloseTo(108);
    expect(out.ore).toBeCloseTo(118);
    expect(out.wealth).toBeCloseTo(123);
    expect(production.food).toBe(100);
  });

  it("scales consuming bonuses by power, keeps solar passive and applies foodFactor", () => {
    const base: CityInfrastructureReport = {
      city: "city-amber",
      sites: [
        { city: "city-amber", kind: "foundry", builtAt: 0 },
        { city: "city-amber", kind: "automated_factory", builtAt: 0 },
        { city: "city-amber", kind: "spaceport", builtAt: 0 },
        { city: "city-amber", kind: "solar_array", builtAt: 0 },
      ],
      pollution: 32,
      foodFactor: 0.9,
      powerRatio: 0.5,
      scienceBonus: 0,
    };
    const partial = infrastructureProduction(
      { food: 100, timber: 100, ore: 100, wealth: 100 },
      base,
    );
    expect(partial.food).toBeCloseTo(99);
    expect(partial.timber).toBeCloseTo(104);
    expect(partial.ore).toBeCloseTo(109);
    expect(partial.wealth).toBeCloseTo(111.5);
    const polluted = infrastructureProduction(
      { food: 100, timber: 0, ore: 0, wealth: 0 },
      { ...base, pollution: 80, foodFactor: 0.75 },
    );
    expect(polluted.food).toBeCloseTo(82.5);
  });
});

describe("energyReport", () => {
  it("is read-only, deterministic and reports scienceBonus from powered sites", () => {
    const ctx = fresh();
    const city = amberCity(ctx);
    claimAround(ctx, amberCapital(ctx));
    // solar 4 + thermal 6 vs research 3 + spaceport 5: fully powered, ratio 1.
    ctx.infrastructure!.sites.push(
      { city, kind: "solar_array", builtAt: 0 },
      { city, kind: "thermal_plant", builtAt: 0 },
      { city, kind: "research_center", builtAt: 0 },
      { city, kind: "spaceport", builtAt: 0 },
    );
    const before = structuredClone(ctx);
    const first = energyReport(ctx, "amber");
    const second = energyReport(ctx, "amber");
    expect(second).toEqual(first);
    expect(ctx).toEqual(before);
    const cityReport = first.cities.find((c) => c.city === city)!;
    expect(cityReport.powerRatio).toBe(1);
    expect(cityReport.scienceBonus).toBe(2);
    expect(cityReport.foodFactor).toBe(1);
  });
});