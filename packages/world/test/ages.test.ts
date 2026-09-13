import { describe, expect, it } from "vitest";
import { ageAllows, ageProgress } from "../src/ages.js";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  SpectatorStateSchema,
} from "../src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
} from "../src/campaign.js";

describe("civilization ages", () => {
  it("starts independently in bronze, without calendar advancement", () => {
    const state = newSpectator(42, "spectator-5");
    state.world.tick = 500;
    expect(
      Object.values(state.ages!).every((a) => a.current === "bronze"),
    ).toBe(true);
    expect(ageProgress(state.world, "amber", "bronze").ready).toBe(false);
    expect(ageAllows("bronze", "classical")).toBe(false);
    expect(ageAllows("medieval", "bronze")).toBe(true);
  });

  it("advances only the acting ruler after verified achievements", () => {
    const state = newSpectator(42, "spectator-5");
    for (const civ of state.world.civs) {
      civ.advances = ["irrigation", "masonry"];
      civ.stock.food = 100000;
      state.world
        .simulation!.cities.find((c) => c.owner === civ.id)!
        .buildings.push("granary");
    }
    const result = resolveCouncil(state, []);
    expect(result.state.ages!.amber!.current).toBe("classical");
    expect(result.state.ages!.azure!.current).toBe("bronze");
    expect(result.state.ageTransitions).toEqual([
      { civ: "amber", from: "bronze", to: "classical", turn: 1 },
    ]);
    expect(state.ages!.amber!.current).toBe("bronze");
    expect(SpectatorStateSchema.parse(result.state)).toEqual(result.state);
  });

  it("rejects locked requests and never queues their construction", () => {
    const state = newSpectator(42, "spectator-5");
    const city = state.world.simulation!.cities.find(
      (c) => c.owner === "amber",
    )!;
    const decision = {
      ...localCouncil(state, "amber"),
      research: "scholarship" as const,
      construction: [{ city: city.id, building: "academy" as const }],
      plan: null,
    };
    const result = resolveCouncil(state, [decision]);
    expect(result.rejected.length).toBeGreaterThanOrEqual(2);
    expect(result.state.research.amber).toBeUndefined();
    expect(
      result.state.world.simulation!.cities.find((c) => c.id === city.id)!
        .queue,
    ).toBeNull();
  });

  it("runs deterministic local turns with legal age choices", () => {
    let state = newSpectator(42, "spectator-5");
    const campaign = CampaignSchema.parse({
      version: "spectator-5",
      id: "age-test",
      seed: 42,
      mode: "local",
      models: {},
      turns: [],
      pending: null,
    });
    for (let i = 0; i < 80; i++) {
      const decision = localCouncil(state, activeCiv(state)!);
      const result = resolveCouncil(state, [decision]);
      expect(result.rejected).toEqual([]);
      expect(resolveCouncil(state, [decision]).state).toEqual(result.state);
      state = result.state;
      campaign.turns.push({
        turn: decision.turn,
        signature: stateSignature(state),
        answers: [
          {
            civ: decision.civ,
            decision,
            source: "local",
            model: null,
            service: null,
            error: null,
          },
        ],
      });
    }
    expect(replayCampaign(campaign).state).toEqual(state);
  });

  it("requires medieval achievements and a complete saved age state", () => {
    const state = newSpectator(42, "spectator-5");
    const civ = state.world.civs[0]!;
    civ.advances = [
      "irrigation",
      "masonry",
      "metallurgy",
      "coinage",
      "engineering",
    ];
    civ.stock.wealth = 100;
    const city = state.world.simulation!.cities.find(
      (c) => c.owner === civ.id,
    )!;
    city.buildings = ["granary", "workshop", "market"];
    expect(ageProgress(state.world, civ.id, "classical").ready).toBe(false);
    state.world.simulation!.cities.push({
      ...structuredClone(city),
      id: "second-city",
      position: city.position + 1,
    });
    expect(ageProgress(state.world, civ.id, "classical").ready).toBe(true);
    expect(ageProgress(state.world, civ.id, "medieval").next).toBeNull();
    delete state.ages;
    expect(SpectatorStateSchema.safeParse(state).success).toBe(false);
  });
});
