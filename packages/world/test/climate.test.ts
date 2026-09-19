import { expect, it } from "vitest";
import { forecastFor, incidentFor, newSpectator, localCouncil, activeCiv, resolveCouncil } from "../src/spectator.js";
import { latestClimateReport } from "../src/climate-report.js";
import { CampaignSchema, replayCampaign, stateSignature } from "../src/campaign.js";

it("announces exactly three rounds ahead across climate blocks without early effects", () => {
  for (const seed of [42, 7, 123]) {
    for (let turn = 0; turn < 70; turn++) {
      const forecast = forecastFor(seed, turn);
      if (!forecast) continue;
      expect(forecast.start - turn).toBeGreaterThan(0);
      expect(forecast.start - turn).toBeLessThanOrEqual(3);
      expect(incidentFor(seed, turn)).toBeNull();
      expect(incidentFor(seed, forecast.start)).toEqual(forecast);
      expect(forecastFor(seed, forecast.start - 4)).toBeNull();
      expect(forecastFor(seed, forecast.start - 3)).toEqual(forecast);
      expect(forecastFor(seed, forecast.start)).toBeNull();
    }
  }
});

it("prepares a vulnerable ruler only in v8 and keeps the forecast shared", () => {
  const state = newSpectator(42, "spectator-8");
  let turn = 0;
  while ((forecastFor(42, turn)?.foodMultiplier ?? 1) >= 1) turn++;
  state.sequence!.round = turn + 1;
  const crimson = state.world.civs.find((c) => c.id === "crimson")!;
  crimson.stock.food = crimson.population;
  const forecast = forecastFor(42, turn);
  for (const c of state.world.civs) {
    state.sequence!.activeCiv = c.id;
    expect(forecastFor(state.world.seed, state.sequence!.round - 1)).toEqual(forecast);
  }
  expect(localCouncil(state, "crimson")).toMatchObject({ focus: "growth", recruitSettler: false });
  state.rules = "spectator-7";
  expect(localCouncil(state, "crimson").focus).toBe("military");
});

it("reports only completed visible crises and replays v8 without rejected orders", () => {
  let state = newSpectator(42, "spectator-8");
  const history = [state];
  const turns = [];
  expect(latestClimateReport(history)).toBeNull();
  for (let i = 0; i < 110; i++) {
    const civ = activeCiv(state)!;
    const decision = localCouncil(state, civ);
    const result = resolveCouncil(state, [decision]);
    expect(result.rejected).toEqual([]);
    state = result.state;
    history.push(state);
    turns.push({ turn: i, signature: stateSignature(state), answers: [{
      civ, decision, source: "local", model: null, service: null, error: null,
    }] });
  }
  const report = latestClimateReport(history)!;
  expect(report).not.toBeNull();
  expect(report.civilizations).toHaveLength(4);
  expect(latestClimateReport(history.slice(0, report.endTick))?.event.id).not.toBe(report.event.id);
  expect(latestClimateReport(history.slice(0, report.endTick + 1))?.event.id).toBe(report.event.id);
  for (const row of report.civilizations) {
    const before = history[report.startTick]!.world.civs.find((c) => c.id === row.civ)!;
    const after = history[report.endTick]!.world.civs.find((c) => c.id === row.civ)!;
    expect(row.foodBefore).toBe(before.stock.food);
    expect(row.foodAfter).toBe(after.stock.food);
    expect(row.populationChange).toBe(after.population - before.population);
  }
  const campaign = CampaignSchema.parse({
    version: "spectator-8", id: "climate-test", seed: 42, mode: "local",
    models: {}, turns, pending: null,
  });
  expect(replayCampaign(campaign).state).toEqual(state);
}, 20_000);
