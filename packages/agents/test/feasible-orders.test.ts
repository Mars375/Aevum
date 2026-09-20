import { describe, expect, it } from "vitest";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../../world/src/spectator.js";
import { neighbours } from "../../world/src/state.js";
import { unitPath } from "../../world/src/units.js";
import { councilObservation } from "../src/council.js";
import { councilOptions } from "../src/council-options.js";

/** Local warm-up: stop just before the first infrastructure decision. */
function warmSeed42V9(): SpectatorState {
  let state = newSpectator(42, "spectator-9");
  for (let guard = 0; state.world.tick < 1200; ) {
    if (guard++ > 2000) throw new Error("warm-up did not converge");
    const civ = activeCiv(state)!;
    const decision = localCouncil(state, civ);
    if (decision.infrastructure) return state;
    state = resolveCouncil(state, [decision]).state;
  }
  throw new Error(
    "seed 42 spectator-9 never offered a local infrastructure decision",
  );
}

describe("spectator-9 feasible order hardening", () => {
  it("warms seed 42 to the first local infrastructure council near tick 639", () => {
    const state = warmSeed42V9();
    expect(state.world.tick).toBeGreaterThanOrEqual(625);
    expect(state.world.tick).toBeLessThanOrEqual(655);
    const civ = activeCiv(state)!;
    expect(localCouncil(state, civ).infrastructure).not.toBeNull();
  });

  it("keeps stranded azure settlers from advertising settle", () => {
    const state = warmSeed42V9();
    const options = councilOptions(state, "azure");
    for (const id of ["azure-164", "azure-166"]) {
      const unit = state.world.simulation!.units.find((u) => u.id === id);
      expect(unit, `unit ${id} exists`).toBeDefined();
      expect(unit!.owner).toBe("azure");
      expect(unit!.role).toBe("settler");
      const entry = options.units.find((u) => u.unit === id)!;
      expect(entry.foundationSites).toEqual([]);
      expect(entry.actions).not.toContain("settle");
    }
  });

  it("limits settlementPlanSites to unique reachable advertised foundations", () => {
    const state = warmSeed42V9();
    const options = councilOptions(state, "azure");
    expect(options.settlementPlanSites).toBeDefined();
    expect(options.units.length).toBeGreaterThan(0);
    for (const unit of options.units) {
      expect(typeof unit.role).toBe("string");
      expect(Array.isArray(unit.moveTargets)).toBe(true);
    }
    const advertised = options.units
      .filter((unit) => unit.role === "settler")
      .flatMap((unit) => unit.foundationSites.map((site) => site.target));
    expect(options.settlementPlanSites).toEqual(
      [...new Set(advertised)].sort((a, b) => a - b),
    );
    for (const target of options.settlementPlanSites!) {
      const advertiser = options.units.find(
        (unit) =>
          unit.role === "settler" &&
          unit.foundationSites.some((site) => site.target === target),
      );
      expect(advertiser, `plan site ${target} is advertised`).toBeDefined();
      const unit = state.world.simulation!.units.find(
        (worldUnit) => worldUnit.id === advertiser!.unit,
      )!;
      expect(unitPath(state.world, unit, target).length).toBeGreaterThan(0);
    }
  });

  it("keeps spectator-8 options free of v9-only fields", () => {
    const state = newSpectator(42, "spectator-8");
    const options = councilOptions(state, "amber");
    expect(options.settlementPlanSites).toBeUndefined();
    const observation = councilObservation(state, "amber");
    for (const unit of options.units) {
      expect(unit).not.toHaveProperty("role");
      expect(unit).not.toHaveProperty("moveTargets");
      expect(unit.actions).toContain("move");
      expect(unit.actions).toContain("explore");
      expect(unit.actions).toContain("retreat");
    }
    const settler = options.units.find((unit) => {
      const worldUnit = state.world.simulation!.units.find(
        (u) => u.id === unit.unit,
      )!;
      return worldUnit.role === "settler";
    })!;
    expect(settler.actions).toContain("settle");
    expect(JSON.stringify(observation)).not.toContain("settlementPlanSites");
    expect(JSON.stringify(observation.options)).not.toContain("moveTargets");
  });

  it("advertises only traversable adjacent neutral/own moves and never mutates input", () => {
    const state = warmSeed42V9();
    const before = structuredClone(state);
    const options = councilOptions(state, "azure");
    const world = state.world;
    let checked = 0;
    for (const entry of options.units) {
      const unit = world.simulation!.units.find((u) => u.id === entry.unit)!;
      for (const target of entry.moveTargets ?? []) {
        expect(neighbours(world.size, unit.position)).toContain(target);
        const owner = world.board[target]!.owner;
        expect(owner === null || owner === "azure").toBe(true);
        expect(unitPath(world, unit, target).length).toBeGreaterThan(1);
        checked++;
      }
      for (const action of ["move", "explore", "retreat"] as const) {
        expect(entry.actions.includes(action)).toBe(
          (entry.moveTargets ?? []).length > 0,
        );
      }
      expect(entry.actions.includes("settle")).toBe(
        entry.role === "settler" && entry.foundationSites.length > 0,
      );
    }
    expect(checked).toBeGreaterThan(0);
    expect(state).toEqual(before);
  });
});