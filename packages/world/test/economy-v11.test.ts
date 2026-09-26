import { describe, expect, it } from "vitest";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorRules,
} from "../src/spectator.js";
import { develop, ECONOMY_V11, housingCapacity } from "../src/development.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";

function play(rules: SpectatorRules, seed: number, actions: number) {
  let state = newSpectator(seed, rules);
  const states = [state];
  const campaign: Campaign = {
    version: rules,
    id: `economie-${seed}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  for (let n = 0; n < actions; n++) {
    const civ = activeCiv(state);
    if (!civ) break;
    const decision = localCouncil(state, civ);
    state = resolveCouncil(state, [decision]).state;
    states.push(state);
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }
  return { states, campaign };
}

describe("l'économie de spectator-11", () => {
  it("borne la population par le logement, à chaque tour", () => {
    const { states } = play("spectator-11", 42, 240);
    for (const state of states)
      for (const civ of state.world.civs) {
        if (civ.fellOnTick !== null) continue;
        const cities = state.world.simulation!.cities.filter(
          (c) => c.owner === civ.id,
        ).length;
        expect(civ.population).toBeLessThanOrEqual(
          housingCapacity(civ, cities, "v11"),
        );
      }
  });

  it("ne laisse pas les réserves s'accumuler sans fin", () => {
    const { states } = play("spectator-11", 42, 240);
    const last = states.at(-1)!;
    for (const civ of last.world.civs) {
      if (civ.fellOnTick !== null) continue;
      const cities = last.world.simulation!.cities.filter(
        (c) => c.owner === civ.id,
      );
      const granaries = cities.filter((c) =>
        c.buildings.includes("granary"),
      ).length;
      const need = civ.population * 0.8 + civ.soldiers * 0.4;
      // Un tour de production au-dessus du plafond de stockage, au plus.
      const bound =
        need *
        (ECONOMY_V11.storagePerNeed +
          granaries * ECONOMY_V11.storagePerGranary);
      expect(civ.stock.food).toBeLessThanOrEqual(bound * 1.5 + 200);
    }
  });

  it("fait croître plus vite qui a plus de réserves", () => {
    const grow = (food: number) => {
      const state = newSpectator(42, "spectator-11");
      const world = state.world;
      const civ = world.civs[0]!;
      civ.population = 100;
      civ.soldiers = 0;
      civ.territory = 20;
      civ.stock = { food, timber: 0, ore: 0, wealth: 100 };
      const before = civ.population;
      develop(world, civ, [], {
        manual: true,
        foodMultiplier: 1,
        research: null,
        production: { food: 80, timber: 0, ore: 0, wealth: 0 },
        economy: "v11",
      });
      return civ.population - before;
    };
    expect(grow(600)).toBeGreaterThan(grow(120));
  });

  it("se rejoue, et laisse spectator-10 tel qu'il était", () => {
    const { campaign, states } = play("spectator-11", 7, 120);
    expect(replayCampaign(campaign).state).toEqual(states.at(-1));
    // Même graine, règles précédentes : l'ancienne économie, qui ne borne pas
    // à 110 par ville.
    const classic = play("spectator-10", 7, 120).states.at(-1)!;
    const civ = classic.world.civs.find((c) => c.fellOnTick === null)!;
    const cities = classic.world.simulation!.cities.filter(
      (c) => c.owner === civ.id,
    ).length;
    expect(housingCapacity(civ, cities)).toBe(
      (cities * 140 + civ.territory * 35) *
        (civ.advances.includes("masonry") ? 1.25 : 1),
    );
  });
});
