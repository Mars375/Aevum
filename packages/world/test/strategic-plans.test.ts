import { describe, it, expect } from "vitest";
import {
  newSpectator,
  resolveCouncil,
  localCouncil,
  type StrategicPlan,
} from "../src/spectator.js";
import { advancePlan, startPlan } from "../src/strategic-plans.js";
const research: StrategicPlan = {
  kind: "research",
  targetTech: "irrigation",
  targetTile: null,
  targetCity: null,
  targetBuilding: null,
  rationale: "Assurer les récoltes.",
};
describe("persistent strategic plans", () => {
  it("requires a city at the planned tile and an observed commercial delivery", () => {
    const state = newSpectator(42, "spectator-3"),
      world = state.world;
    const city = world.simulation!.cities.find((c) => c.owner === "amber")!;
    const founding = startPlan(
      {
        ...research,
        kind: "settle",
        targetTech: null,
        targetTile: city.position,
      },
      0,
    );
    expect(advancePlan(founding, world, "amber", [], null).status).toBe(
      "completed",
    );
    const trade = startPlan(
      { ...research, kind: "trade", targetTech: null, targetCity: city.id },
      0,
    );
    expect(advancePlan(trade, world, "amber", [], null).status).toBe("active");
    const ledger = {
      city: city.id,
      population: 1,
      workers: { farmer: 0, lumberjack: 0, miner: 0, merchant: 1 },
      workedTiles: [],
      production: { food: 0, timber: 0, ore: 0, wealth: 2 },
      deliveries: [{ unit: "merchant", from: "other", to: city.id, value: 2 }],
    };
    expect(advancePlan(trade, world, "amber", [ledger], null).status).toBe(
      "completed",
    );
    expect(
      advancePlan({ ...trade, stagnation: 5 }, world, "amber", [], null).status,
    ).toBe("blocked");
  });
  it("gives local v3 rulers concrete plans and leaves active plans persistent", () => {
    const state = newSpectator(42, "spectator-3");
    const decision = localCouncil(state, "amber");
    expect(decision.plan).toBeTruthy();
    const next = resolveCouncil(state, [decision]).state;
    expect(next.plans!.amber).toBeTruthy();
    if (next.plans!.amber!.status === "active")
      expect(localCouncil(next, "amber").plan).toBeUndefined();
  });
  it("persists without decisions, tracks stagnation, replaces and cancels explicitly", () => {
    const state = newSpectator(42, "spectator-3");
    const decision = {
      ...localCouncil(state, "amber"),
      research: null,
      construction: [],
      orders: [],
      plan: research,
    };
    const first = resolveCouncil(state, [decision]).state;
    expect(first.plans!.amber!.kind).toBe("research");
    const next = resolveCouncil(first, []).state;
    expect(next.plans!.amber!.startedAt).toBe(0);
    expect(next.plans!.amber!.stagnation).toBe(2);
    const repeated = resolveCouncil(next, [
      { ...decision, turn: next.world.tick },
    ]).state;
    expect(repeated.plans!.amber!.startedAt).toBe(0);
    const replaced = resolveCouncil(repeated, [
      {
        ...decision,
        turn: repeated.world.tick,
        plan: { ...research, targetTech: "metallurgy" },
      },
    ]).state;
    expect(replaced.plans!.amber!.startedAt).toBe(repeated.world.tick);
    const cancelled = resolveCouncil(replaced, [
      { ...decision, turn: replaced.world.tick, plan: null },
    ]).state;
    expect(cancelled.plans!.amber!.status).toBe("cancelled");
    expect(state.plans).toEqual({});
  });
  it("requires observed completion and records lost targets as blocked", () => {
    const state = newSpectator(42, "spectator-3"),
      world = state.world;
    const civ = world.civs.find((c) => c.id === "amber")!;
    const plan = startPlan(research, 0);
    civ.science = 1000;
    expect(advancePlan(plan, world, "amber", [], null).status).toBe("active");
    civ.advances.push("irrigation");
    expect(advancePlan(plan, world, "amber", [], null).status).toBe(
      "completed",
    );
    const city = world.simulation!.cities.find((c) => c.owner === "amber")!;
    const build = startPlan(
      {
        ...research,
        kind: "build",
        targetTech: null,
        targetCity: city.id,
        targetBuilding: "walls",
      },
      0,
    );
    city.queue = { building: "walls", remaining: 3 };
    expect(advancePlan(build, world, "amber", [], null).progress).toBe(0.5);
    city.owner = "azure";
    expect(advancePlan(build, world, "amber", [], null).status).toBe("blocked");
  });
  it("ignores plans in legacy rules and keeps legacy state shape", () => {
    for (const rules of ["spectator-1", "spectator-2"] as const) {
      const state = newSpectator(42, rules),
        decision = localCouncil(state, "amber");
      expect(
        resolveCouncil(state, [{ ...decision, plan: research }]).state,
      ).toEqual(resolveCouncil(state, [decision]).state);
      expect(resolveCouncil(state, [decision]).state).not.toHaveProperty(
        "plans",
      );
    }
  });
  it("rejects impossible target shapes without replacing a valid plan", () => {
    const state = newSpectator(42, "spectator-3");
    state.plans!.amber = startPlan(research, 0);
    const result = resolveCouncil(state, [
      {
        ...localCouncil(state, "amber"),
        plan: { ...research, kind: "build", targetCity: "foreign-city" },
      },
    ]);
    expect(result.rejected.length).toBeGreaterThan(0);
    expect(result.state.plans!.amber!.kind).toBe("research");
  });
});
