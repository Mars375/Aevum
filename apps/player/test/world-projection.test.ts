import { describe, expect, it } from "vitest";
import { census, newWorld, newCivilizationWorld, type Year } from "@abs/world";
import { projectWorld } from "../src/three/world-projection";

const origin = (): Year => ({ tick: 0, world: census(newWorld(["crimson", "azure", "verdant", "amber"], 42)), events: [], rulings: [] });

it("projects independent age silhouettes without changing archived views", () => {
  const world = newCivilizationWorld(["crimson", "azure"], 42);
  const year: Year = { tick: 0, world, events: [], rulings: [] };
  const before = structuredClone(year);
  const parcels = projectWorld(year, [year], { crimson: "bronze", azure: "medieval" });
  for (const city of world.simulation!.cities) {
    expect(parcels[city.position]!.assets[0]!.asset).toBe(city.owner === "crimson" ? "bronze_city" : "medieval_city");
  }
  for (const soldier of world.simulation!.units.filter(u => u.role === "soldier")) {
    expect(parcels[soldier.position]!.assets.find(a => a.unitId === soldier.id)!.asset).toBe(soldier.owner === "crimson" ? "bronze_soldier" : "medieval_soldier");
  }
  expect(projectWorld(year, [year]).flatMap(p => p.assets).some(a => a.asset.endsWith("_city"))).toBe(false);
  expect(year).toEqual(before);
});

describe("la carte 3D représente l'année demandée", () => {
  it("place les unités w10 à leur position enregistrée, avec leur propre faction", () => {
    const world = newCivilizationWorld(["crimson", "azure"], 42);
    const unit = world.simulation!.units[0]!;
    const destination = world.board.findIndex(p => p.owner === null);
    unit.position = destination;
    const year: Year = { tick: 0, world, events: [], rulings: [] };
    const parcels = projectWorld(year, [year]);
    expect(parcels[destination]!.assets.some(a => a.asset === unit.role && a.faction === unit.owner)).toBe(true);
    expect(parcels.flatMap(p => p.units)).toHaveLength(world.simulation!.units.length);
    const figures = parcels.flatMap(p => p.assets).filter(a => a.unitId);
    expect(figures.map(a => a.unitId).sort()).toEqual(world.simulation!.units.map(u => u.id).sort());
    expect(parcels[destination]!.assets.find(a => a.unitId === unit.id)?.previousPosition).toBe(unit.previous);
  });
  it("conserve les propriétaires, coordonnées et capitales du moteur sans muter le monde", () => {
    const year = origin();
    const before = structuredClone(year);
    const parcels = projectWorld(year, [year]);
    expect(parcels).toHaveLength(year.world.board.length);
    expect(parcels.filter((p) => p.capital)).toHaveLength(4);
    for (const p of parcels) {
      expect(p.place.owner).toBe(year.world.board[p.index]!.owner);
      expect(p.x + 4).toBe(p.index % 9);
      expect(p.z + 4).toBe(Math.floor(p.index / 9));
    }
    expect(year).toEqual(before);
    expect(projectWorld(year, [year])).toEqual(parcels);
  });
  it("fait évoluer une capitale selon sa population et ses progrès", () => {
    const year = origin();
    const civ = year.world.civs[0]!;
    const asset = () => projectWorld(year, [year]).find((p) => p.capital && p.civ?.id === civ.id)!.assets[0]!.asset;
    civ.population = 100;
    expect(asset()).toBe("hamlet");
    civ.population = 250;
    expect(asset()).toBe("town");
    civ.population = 600; civ.advances = ["a", "b", "c"];
    expect(asset()).toBe("citadel");
  });
  it("relie les figurines aux effectifs et métiers, sans peupler les terres libres", () => {
    const year = origin();
    const civ = year.world.civs[0]!;
    civ.soldiers = 0;
    civ.doctrine.farming = 12;
    civ.doctrine.forestry = civ.doctrine.mining = civ.doctrine.trade = civ.doctrine.military = 0;
    const own = () => projectWorld(year, [year]).filter(p => p.place.owner === civ.id);
    expect(own().flatMap(p => p.units)).toContain("farmer");
    expect(own().flatMap(p => p.units)).not.toContain("soldier");
    expect(own().flatMap(p => p.units)).not.toContain("miner");
    civ.soldiers = 15;
    expect(own().flatMap(p => p.units).filter(u => u === "soldier")).toHaveLength(2);
    for (const p of projectWorld(year, [year])) {
      expect(p.units.length).toBeLessThanOrEqual(4);
      if (p.place.owner === null || p.place.kind === "river") expect(p.units).toEqual([]);
      for (const unit of p.assets.filter(a => a.faction)) expect(unit.faction).toBe(p.place.owner);
    }
    civ.fellOnTick = 0;
    expect(own().flatMap(p => p.units)).toEqual([]);
  });
  it("borne les figurines même pour de très grandes civilisations", () => {
    const year = origin();
    const civ = year.world.civs[0]!;
    civ.population = 1_000_000; civ.soldiers = 1_000_000;
    for (const place of year.world.board) place.owner = civ.id;
    const parcels = projectWorld(year, [year]);
    expect(parcels.flatMap(p => p.units).filter(u => u === "soldier")).toHaveLength(6);
    expect(parcels.flatMap(p => p.units).length).toBeLessThanOrEqual(14);
    expect(parcels.every(p => p.units.length <= 4)).toBe(true);
  });
  it("ne dessine des ruines qu'après l'abandon d'un siège attesté dans le passé", () => {
    const first = origin();
    const seat = first.world.civs[0]!.capital!;
    const later = structuredClone(first);
    later.tick = later.world.tick = 10;
    later.world.board[seat]!.owner = null;
    later.world.civs[0]!.capital = null;
    later.world.civs[0]!.fellOnTick = 10;
    const history = [first, later];
    expect(projectWorld(first, history)[seat]!.ruins).toBe(false);
    expect(projectWorld(later, history)[seat]!.assets[0]!.asset).toBe("ruins");
    expect(projectWorld(later, [later])[seat]!.ruins).toBe(false);
    later.world.board[seat]!.owner = "azure";
    expect(projectWorld(later, history)[seat]!.ruins).toBe(false);
  });
});
