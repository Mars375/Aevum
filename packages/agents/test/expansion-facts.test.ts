import { describe, expect, it } from "vitest";
import { councilObservation } from "../src/council.js";
import { newSpectator, SETTLER_COST } from "../../world/src/spectator.js";
import { housingCapacity } from "../../world/src/development.js";

type Housing = {
  capacity: number;
  expansion?: {
    newCityAddsUpTo: number;
    settlerCost: typeof SETTLER_COST;
    settlerAffordable: boolean;
    settlersOwned: number;
  };
};

const housingOf = (state: ReturnType<typeof newSpectator>) =>
  (councilObservation(state, "amber") as { housing?: Housing }).housing;

describe("l'expansion dite au dirigeant qui bute sur son logement", () => {
  it("n'apparaît qu'au plafond", () => {
    const state = newSpectator(42, "spectator-11");
    expect(housingOf(state)!.expansion).toBeUndefined();

    const amber = state.world.civs.find((c) => c.id === "amber")!;
    const cities = state.world.simulation!.cities.filter(
      (c) => c.owner === "amber",
    ).length;
    amber.population = housingCapacity(amber, cities, "v11");
    const expansion = housingOf(state)!.expansion!;
    expect(expansion.newCityAddsUpTo).toBe(110 + 5 * 15);
    // Le prix dit est celui que le moteur fait payer.
    expect(expansion.settlerCost).toBe(SETTLER_COST);
    expect(expansion.settlersOwned).toBe(
      state.world.simulation!.units.filter(
        (u) => u.owner === "amber" && u.role === "settler",
      ).length,
    );
  });

  it("reste absente des règles précédentes", () => {
    const state = newSpectator(42, "spectator-10");
    expect(housingOf(state)).toBeUndefined();
  });
});

describe("l'objectif précédent, à réexaminer", () => {
  it("n'est plus montré sous la clé que le dirigeant remplit", () => {
    const state = newSpectator(42, "spectator-11");
    state.objectives.amber = "Fonder une ville au nord";
    const seen = councilObservation(state, "amber") as Record<string, unknown>;
    expect(seen.objective).toBeUndefined();
    expect(seen.previousObjective).toBe("Fonder une ville au nord");
  });

  it("garde l'ancienne clé pour les règles précédentes", () => {
    const state = newSpectator(42, "spectator-10");
    state.objectives.amber = "Fonder une ville au nord";
    const seen = councilObservation(state, "amber") as Record<string, unknown>;
    expect(seen.objective).toBe("Fonder une ville au nord");
  });
});
