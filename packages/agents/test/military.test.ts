import { describe, it, expect } from "vitest";
import { councilObservation } from "../src/council.js";
import { newSpectator } from "../../world/src/spectator.js";

describe("council observation military profile", () => {
  it("exposes power and resilience multipliers at spectator-7", () => {
    const state = newSpectator(42, "spectator-7");
    state.ages!.azure = {
      current: "industrial",
      enteredAt: 0,
      history: [{ age: "industrial", turn: 0 }],
    };
    state.modernization!.azure!.completed = ["mechanization"];
    const observation = councilObservation(state, "azure");
    const azure = observation.civilizations.find((c) => c.id === "azure")!;
    expect(azure).toMatchObject({
      population: expect.any(Number),
      soldiers: expect.any(Number),
    });
    expect(azure.power).toBe(2.9);
    expect(azure.resilience).toBe(1.6);
  });

  it("keeps the observation free of military multipliers at spectator-6", () => {
    const state = newSpectator(42, "spectator-6");
    const observation = councilObservation(state, "azure");
    for (const civilization of observation.civilizations)
      expect(civilization).not.toHaveProperty("power");
  });
});
