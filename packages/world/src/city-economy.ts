import type { Stock, World } from "./state.js";
import { shares } from "./tick.js";
import { unitPath } from "./units.js";
import { z } from "zod";

export const CityLedgerSchema = z.object({
  city: z.string(),
  population: z.number().int().nonnegative(),
  workedTiles: z.array(z.number().int().nonnegative()),
  workers: z.object({
    farmer: z.number().int().nonnegative(),
    lumberjack: z.number().int().nonnegative(),
    miner: z.number().int().nonnegative(),
    merchant: z.number().int().nonnegative(),
  }),
  production: z.object({
    food: z.number().nonnegative(),
    timber: z.number().nonnegative(),
    ore: z.number().nonnegative(),
    wealth: z.number().nonnegative(),
  }),
  deliveries: z.array(
    z.object({
      unit: z.string(),
      from: z.string(),
      to: z.string(),
      value: z.number().nonnegative(),
    }),
  ),
});

export interface CityLedger {
  city: string;
  population: number;
  workedTiles: number[];
  workers: {
    farmer: number;
    lumberjack: number;
    miner: number;
    merchant: number;
  };
  production: Stock;
  deliveries: { unit: string; from: string; to: string; value: number }[];
}

/** Full gross production before season/weather. Stocks remain national, not city inventories.
 * Population is allocated by catchment weight (1 + owned tiles), with sorted-id remainder.
 * One productive crew per tile, at most three per resource/city. No orders are generated.
 */
export function deriveCityEconomy(
  world: World,
  civId: string,
  lastVisitedCity: Readonly<Record<string, string>> = {},
): CityLedger[] {
  const civ = world.civs.find((c) => c.id === civId);
  if (
    !civ ||
    civ.fellOnTick !== null ||
    !world.simulation ||
    civ.population <= 0
  )
    return [];
  const sim = world.simulation;
  const cities = sim.cities
    .filter((c) => c.owner === civId)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!cities.length) return [];
  const distance = (a: number, b: number) =>
    Math.abs((a % world.size) - (b % world.size)) +
    Math.abs(Math.floor(a / world.size) - Math.floor(b / world.size));
  const catchments = cities.map(() => [] as number[]);
  for (let tile = 0; tile < world.board.length; tile++) {
    if (world.board[tile]!.owner !== civId) continue;
    let nearest = -1,
      best = 4;
    cities.forEach((city, index) => {
      const d = distance(city.position, tile);
      if (d < best) {
        nearest = index;
        best = d;
      }
    });
    if (nearest >= 0) catchments[nearest]!.push(tile);
  }
  const weight = catchments.reduce((sum, tiles) => sum + tiles.length + 1, 0);
  const populations = catchments.map((tiles) =>
    Math.floor((civ.population * (tiles.length + 1)) / weight),
  );
  let remainder =
    civ.population - populations.reduce((sum, pop) => sum + pop, 0);
  for (let i = 0; remainder > 0; i++, remainder--)
    populations[i % populations.length]!++;
  const doctrine = shares(civ.doctrine);
  const ownUnits = sim.units
    .filter((u) => u.owner === civId)
    .sort((a, b) => a.id.localeCompare(b.id));
  return cities.map((city, index) => {
    const tiles = catchments[index]!,
      population = populations[index]!;
    const workers = { farmer: 0, lumberjack: 0, miner: 0, merchant: 0 };
    const occupied = new Set<number>();
    const workedTiles: number[] = [];
    for (const unit of ownUnits) {
      if (!tiles.includes(unit.position) || occupied.has(unit.position))
        continue;
      const kind = world.board[unit.position]!.kind;
      const role = unit.role;
      if (
        (role === "farmer" && (kind === "plain" || kind === "river")) ||
        (role === "lumberjack" && kind === "forest") ||
        (role === "miner" && kind === "hill")
      ) {
        // A hostile army contests work even before territorial ownership changes.
        if (
          sim.units.some(
            (other) =>
              other.position === unit.position &&
              other.owner !== civId &&
              other.role === "soldier",
          )
        )
          continue;
        if (workers[role] >= 3) continue;
        workers[role]++;
        occupied.add(unit.position);
        workedTiles.push(unit.position);
      }
    }
    const capacity = (kind: string) =>
      tiles.filter((tile) => world.board[tile]!.kind === kind).length;
    const civilians =
      (population * Math.max(0, civ.population - civ.soldiers)) /
      civ.population;
    const carried = (share: number, land: number, rate: number) =>
      Math.min(civilians * share, land * 40) * rate;
    const production: Stock = {
      food:
        (population * 0.55 +
          carried(
            doctrine.farming,
            capacity("plain") + capacity("river") * 0.7,
            3.2,
          ) +
          workers.farmer * 4) *
        (civ.advances.includes("irrigation") ? 1.2 : 1) *
        (city.buildings.includes("granary") ? 1.12 : 1),
      timber:
        (carried(doctrine.forestry, capacity("forest"), 0.9) +
          workers.lumberjack * 1.33) *
        (city.buildings.includes("workshop") ? 1.15 : 1),
      ore:
        (carried(doctrine.mining, capacity("hill"), 0.65) + workers.miner) *
        (civ.advances.includes("metallurgy") ? 1.2 : 1),
      wealth:
        (population * 0.07 +
          carried(doctrine.trade, 1 + capacity("river"), 0.65)) *
        (city.buildings.includes("market") ? 1.2 : 1) *
        (civ.advances.includes("coinage") ? 1.25 : 1),
    };
    const deliveries: CityLedger["deliveries"] = [];
    for (const unit of ownUnits) {
      if (
        unit.role !== "merchant" ||
        unit.position !== city.position ||
        distance(unit.previous, unit.position) !== 1
      )
        continue;
      if (
        sim.units.some(
          (other) =>
            other.position === unit.position &&
            other.owner !== civId &&
            other.role === "soldier",
        )
      )
        continue;
      const source = cities
        .filter(
          (other) =>
            other.id !== city.id && other.id === lastVisitedCity[unit.id],
        )
        .map((other) => ({
          city: other,
          route: unitPath(
            world,
            { ...unit, position: other.position },
            city.position,
          ),
        }))
        .filter(
          (candidate) =>
            candidate.route.length > 1 &&
            candidate.route[candidate.route.length - 2] === unit.previous,
        )
        .sort(
          (a, b) =>
            a.route.length - b.route.length ||
            a.city.id.localeCompare(b.city.id),
        )[0];
      if (!source) continue;
      const value = city.buildings.includes("market") ? 4 : 2;
      deliveries.push({
        unit: unit.id,
        from: source.city.id,
        to: city.id,
        value,
      });
      workers.merchant++;
      production.wealth += value;
      break; // At most one credited arrival per destination and resolution snapshot.
    }
    if (civ.doctrine.focus === "science")
      for (const key of ["food", "timber", "ore", "wealth"] as const)
        production[key] *= 0.9;
    for (const key of ["food", "timber", "ore", "wealth"] as const)
      production[key] = Math.round(production[key] * 100) / 100;
    return {
      city: city.id,
      population,
      workedTiles: workedTiles.sort((a, b) => a - b),
      workers,
      production,
      deliveries,
    };
  });
}
