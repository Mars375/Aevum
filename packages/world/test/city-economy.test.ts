import { describe, it, expect } from "vitest";
import { newSpectator } from "../src/spectator.js";
import { deriveCityEconomy, CityLedgerSchema } from "../src/city-economy.js";

function fixture() {
  const world = newSpectator().world;
  const civ = world.civs.find((c) => c.id === "amber")!;
  world.simulation!.cities = [
    {
      id: "a",
      owner: "amber",
      position: 0,
      founded: 0,
      buildings: [],
      queue: null,
    },
    {
      id: "b",
      owner: "amber",
      position: 4,
      founded: 0,
      buildings: [],
      queue: null,
    },
  ];
  world.board.forEach((tile) => {
    tile.owner = "amber";
    tile.kind = "plain";
  });
  world.simulation!.units = [];
  civ.population = 120;
  civ.soldiers = 0;
  return world;
}
describe("local city economy", () => {
  it("assigns catchments once, preserves population, and is pure and order independent", () => {
    const world = fixture(),
      before = JSON.stringify(world);
    const ledger = deriveCityEconomy(world, "amber");
    expect(ledger.reduce((sum, c) => sum + c.population, 0)).toBe(120);
    ledger.forEach((c) => CityLedgerSchema.parse(c));
    expect(JSON.stringify(world)).toBe(before);
    world.simulation!.cities.reverse();
    expect(deriveCityEconomy(world, "amber")).toEqual(ledger);
  });
  it("requires appropriate owned local terrain, caps duplicate crews, and blocks contested work", () => {
    const world = fixture();
    const sim = world.simulation!;
    const base = deriveCityEconomy(world, "amber");
    const farmer = {
      id: "worker",
      owner: "amber" as const,
      role: "farmer" as const,
      position: 1,
      previous: 1,
      target: null,
      strength: 1,
      cooldown: 0,
      task: "work" as const,
    };
    sim.units = [farmer];
    const worked = deriveCityEconomy(world, "amber");
    expect(worked[0]!.production.food).toBeGreaterThan(
      base[0]!.production.food,
    );
    expect(worked[1]!.production).toEqual(base[1]!.production);
    sim.units.push({ ...farmer, id: "duplicate" });
    expect(deriveCityEconomy(world, "amber")).toEqual(worked);
    sim.units.push({ ...farmer, id: "enemy", owner: "azure", role: "soldier" });
    expect(deriveCityEconomy(world, "amber")[0]!.workers.farmer).toBe(0);
    sim.units = [farmer];
    world.board[1]!.owner = "azure";
    expect(deriveCityEconomy(world, "amber")[0]!.workedTiles).toEqual([]);
    world.board[1]!.owner = "amber";
    world.board[1]!.kind = "hill";
    expect(deriveCityEconomy(world, "amber")[0]!.workers.farmer).toBe(0);
  });
  it("credits only bounded concrete arrivals and never stationary merchants", () => {
    const world = fixture(),
      sim = world.simulation!;
    const merchant = {
      id: "merchant",
      owner: "amber" as const,
      role: "merchant" as const,
      position: 4,
      previous: 3,
      target: null,
      strength: 1,
      cooldown: 0,
      task: "march" as const,
    };
    sim.units = [merchant, { ...merchant, id: "second" }];
    expect(deriveCityEconomy(world, "amber")[1]!.deliveries).toEqual([]);
    expect(
      deriveCityEconomy(world, "amber", { merchant: "b", second: "b" })[1]!
        .deliveries,
    ).toEqual([]);
    expect(
      deriveCityEconomy(world, "amber", {
        merchant: "missing",
        second: "missing",
      })[1]!.deliveries,
    ).toEqual([]);
    const visits = { merchant: "a", second: "a" };
    const delivery = deriveCityEconomy(world, "amber", visits)[1]!;
    expect(delivery.deliveries).toEqual([
      { unit: "merchant", from: "a", to: "b", value: 2 },
    ]);
    for (const unit of sim.units) unit.previous = unit.position;
    expect(deriveCityEconomy(world, "amber", visits)[1]!.deliveries).toEqual(
      [],
    );
  });
  it("retains modest subsistence without crews and excludes land beyond catchments", () => {
    const world = fixture();
    const base = deriveCityEconomy(world, "amber");
    expect(
      base.every(
        (city) => city.production.food > 0 && city.workedTiles.length === 0,
      ),
    ).toBe(true);
    world.board[world.board.length - 1]!.kind = "forest";
    expect(deriveCityEconomy(world, "amber")).toEqual(base);
  });
});
