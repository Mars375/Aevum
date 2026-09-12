import { describe, expect, it } from "vitest";
import { councilOptions } from "../src/council-options.js";
import { newSpectator } from "../../world/src/spectator.js";
import { unitPath } from "../../world/src/units.js";

describe("council options", () => {
  it("restricts actions by role, keeps rival information private and leaves state untouched", () => {
    const state = newSpectator();
    state.objectives.azure = "secret objective";
    state.memory.azure = ["private thought"];
    const before = JSON.stringify(state);
    const options = councilOptions(state, "amber");
    for (const option of options.units) {
      const unit = state.world.simulation!.units.find(
        (unit) => unit.id === option.unit,
      )!;
      expect(unit.owner).toBe("amber");
      expect(option.actions.includes("settle")).toBe(unit.role === "settler");
      for (const action of ["defend", "attack", "escort"] as const)
        expect(option.actions.includes(action)).toBe(unit.role === "soldier");
    }
    expect(JSON.stringify(options)).not.toContain("secret objective");
    expect(JSON.stringify(options)).not.toContain("private thought");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("offers at most six reachable neutral dry founding sites away from every city", () => {
    const state = newSpectator();
    const world = state.world;
    const options = councilOptions(state, "amber");
    const settler = world.simulation!.units.find(
      (unit) => unit.owner === "amber" && unit.role === "settler",
    )!;
    const sites = options.units.find(
      (unit) => unit.unit === settler.id,
    )!.foundationSites;
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.length).toBeLessThanOrEqual(6);
    for (const site of sites) {
      expect(world.board[site.target]!.owner).toBeNull();
      expect(world.board[site.target]!.kind).not.toBe("river");
      expect(site.route).toEqual(unitPath(world, settler, site.target));
      expect(site.distance).toBe(site.route.length - 1);
      for (const city of world.simulation!.cities)
        expect(
          Math.abs((city.position % world.size) - (site.target % world.size)) +
            Math.abs(
              Math.floor(city.position / world.size) -
                Math.floor(site.target / world.size),
            ),
        ).toBeGreaterThanOrEqual(3);
    }
    // Surround the settler with foreign land: geometrically valid sites cease to be reachable.
    for (const tile of world.board) tile.owner = "azure";
    world.board[settler.position]!.owner = "amber";
    const far = sites.find((site) => site.distance > 1)!;
    world.board[far.target]!.owner = null;
    expect(
      councilOptions(state, "amber").units.find(
        (unit) => unit.unit === settler.id,
      )!.foundationSites,
    ).toEqual([]);
  });

  it("filters queued, built and unaffordable construction with years outside resource costs", () => {
    const state = newSpectator();
    const civ = state.world.civs.find((civ) => civ.id === "amber")!;
    const city = state.world.simulation!.cities.find(
      (city) => city.owner === "amber",
    )!;
    Object.assign(civ.stock, { timber: 35, ore: 0, wealth: 15 });
    expect(councilOptions(state, "amber").construction).toEqual([
      {
        city: city.id,
        building: "granary",
        cost: { timber: 35, ore: 0, wealth: 15 },
        years: 4,
      },
    ]);
    city.buildings = ["granary"];
    expect(councilOptions(state, "amber").construction).toEqual([]);
    city.buildings = [];
    city.queue = { building: "market", remaining: 2 };
    expect(councilOptions(state, "amber").construction).toEqual([]);
  });

  it("checks research prerequisites and recruitment stock, capital and settler cap", () => {
    const state = newSpectator();
    const civ = state.world.civs.find((civ) => civ.id === "amber")!;
    civ.advances = [];
    expect(
      councilOptions(state, "amber").research.map((tech) => tech.name),
    ).toEqual(["irrigation", "metallurgy"]);
    civ.advances = ["irrigation"];
    expect(
      councilOptions(state, "amber").research.map((tech) => tech.name),
    ).toEqual(["masonry", "metallurgy", "coinage"]);
    Object.assign(civ.stock, { food: 50, timber: 60, wealth: 20 });
    expect(councilOptions(state, "amber").recruitSettler.possible).toBe(true);
    civ.stock.food = 49;
    expect(councilOptions(state, "amber").recruitSettler.possible).toBe(false);
    civ.stock.food = 50;
    const settler = state.world.simulation!.units.find(
      (unit) => unit.owner === "amber" && unit.role === "settler",
    )!;
    state.world.simulation!.units.push({ ...settler, id: "second-settler" });
    expect(councilOptions(state, "amber").recruitSettler.possible).toBe(false);
    state.world.simulation!.units.pop();
    civ.capital = null;
    expect(councilOptions(state, "amber").recruitSettler.possible).toBe(false);
  });
});
