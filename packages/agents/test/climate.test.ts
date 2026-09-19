import { expect, it } from "vitest";
import { councilObservation } from "../src/council.js";
import { forecastFor, newSpectator } from "../../world/src/spectator.js";

it("shares upcoming climate with all v8 rulers without leaking it into v7 observations", () => {
  const state = newSpectator(42, "spectator-8");
  state.sequence!.round = 10;
  const event = forecastFor(42, 9)!;
  expect(event).not.toBeNull();
  for (const c of state.world.civs) {
    const observation = councilObservation(state, c.id);
    expect(observation).toMatchObject({ forecast: event, event: null });
    expect(observation.climatePreparation).toContain("three rounds");
    expect(observation.civilizations[0]).toHaveProperty("power");
    expect(observation.options).toHaveProperty("modernization");
  }
  state.rules = "spectator-7";
  expect(councilObservation(state, "amber")).not.toHaveProperty("forecast");
});
