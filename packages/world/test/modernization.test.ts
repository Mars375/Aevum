import { describe, it, expect } from "vitest";
import { ageProgress } from "../src/ages.js";
import {
  MODERNIZATION,
  modernizationProduction,
  startModernization,
} from "../src/modernization.js";
import {
  newSpectator,
  activeCiv,
  localCouncil,
  resolveCouncil,
  SpectatorStateSchema,
} from "../src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
} from "../src/campaign.js";
import { census } from "../src/state.js";

function prepared() {
  const state = newSpectator(42, "spectator-6");
  const civ = state.world.civs.find((c) => c.id === "amber")!;
  civ.advances = [
    "irrigation",
    "masonry",
    "metallurgy",
    "coinage",
    "engineering",
    "scholarship",
  ];
  civ.science = 1000;
  civ.stock = { food: 10000, timber: 10000, ore: 10000, wealth: 10000 };
  for (const city of state.world.simulation!.cities.filter(
    (c) => c.owner === "amber",
  ))
    city.buildings = ["granary", "workshop", "market", "academy"];
  state.ages!.amber = {
    current: "medieval",
    enteredAt: 0,
    history: [{ age: "medieval", turn: 0 }],
  };
  return state;
}

describe("modernization programs", () => {
  it("pays once, rejects locked/duplicate projects without spending", () => {
    const state = prepared(),
      civ = state.world.civs[0]!,
      programs = state.modernization!.amber!;
    const before = structuredClone(civ);
    expect(
      startModernization(
        state.world,
        "amber",
        "medieval",
        programs,
        "power_grid",
      ),
    ).not.toBeNull();
    expect(civ).toEqual(before);
    expect(
      startModernization(
        state.world,
        "amber",
        "medieval",
        programs,
        "mechanization",
      ),
    ).toBeNull();
    expect(civ.stock.ore).toBe(
      before.stock.ore - MODERNIZATION.mechanization.cost.ore!,
    );
    expect(civ.science).toBe(
      before.science! - MODERNIZATION.mechanization.science,
    );
    const paid = structuredClone(civ);
    expect(
      startModernization(
        state.world,
        "amber",
        "medieval",
        programs,
        "mechanization",
      ),
    ).not.toBeNull();
    expect(civ).toEqual(paid);
  });

  it("only advances on the owner's turn and suspends without an academy", () => {
    const state = prepared();
    state.modernization!.amber!.active = {
      project: "mechanization",
      remaining: 3,
      startedAt: 0,
    };
    const first = resolveCouncil(state, []).state;
    expect(first.modernization!.amber!.active!.remaining).toBe(2);
    const passive = resolveCouncil(first, []).state;
    expect(passive.modernization!.amber).toEqual(first.modernization!.amber);
    for (const city of state.world.simulation!.cities) city.buildings = [];
    expect(
      resolveCouncil(state, []).state.modernization!.amber!.active!.remaining,
    ).toBe(3);
    expect(state.modernization!.amber!.active!.remaining).toBe(3);
  });

  it("completes programs before evaluating age advancement, without advancing rivals", () => {
    const state = prepared();
    const city = state.world.simulation!.cities.find(
      (c) => c.owner === "amber",
    )!;
    const position = state.world.board.findIndex(
      (p) => p.owner === null && p.kind !== "river",
    );
    state.world.board[position]!.owner = "amber";
    state.world.simulation!.cities.push({
      ...structuredClone(city),
      id: "second",
      position,
    });
    state.world = census(state.world);
    state.modernization!.amber!.active = {
      project: "mechanization",
      remaining: 1,
      startedAt: 0,
    };
    const result = resolveCouncil(state, []);
    expect(result.state.modernization!.amber!.completed).toEqual([
      "mechanization",
    ]);
    expect(result.state.ages!.amber!.current).toBe("industrial");
    expect(result.state.ages!.azure!.current).toBe("bronze");
    expect(
      result.events.some(
        (e) => e.kind === "ADVANCE" && e.detail.includes("Mécanisation"),
      ),
    ).toBe(true);
    expect(ageProgress(state.world, "amber", "medieval").next).toBeNull();
    expect(ageProgress(state.world, "amber", "medieval", []).next).toBe(
      "industrial",
    );
  });

  it("applies finite advertised production effects", () => {
    const production = { food: 100, timber: 100, ore: 100, wealth: 100 };
    const actual = modernizationProduction(production, {
      completed: [
        "mechanization",
        "power_grid",
        "clean_energy",
        "automation",
        "orbital_network",
      ],
      active: null,
    });
    expect(actual.food).toBeCloseTo(115);
    expect(actual.timber).toBeCloseTo(135);
    expect(actual.ore).toBeCloseTo(135);
    expect(actual.wealth).toBeCloseTo(150);
    expect(production.ore).toBe(100);
  });

  it("requires all national state on saved v6 campaigns", () => {
    const state = prepared();
    delete state.modernization;
    expect(SpectatorStateSchema.safeParse(state).success).toBe(false);
  });

  it("replays 1100 autonomous actions with no rejected orders and reaches the future", () => {
    let state = newSpectator(42, "spectator-6");
    const campaign = CampaignSchema.parse({
      version: "spectator-6",
      id: "future-test",
      seed: 42,
      mode: "local",
      models: {},
      pending: null,
      turns: [],
    });
    for (let i = 0; i < 1100; i++) {
      const actor = activeCiv(state)!;
      const decision = localCouncil(state, actor);
      const result = resolveCouncil(state, [decision]);
      expect(result.rejected).toEqual([]);
      state = result.state;
      campaign.turns.push({
        turn: decision.turn,
        signature: stateSignature(state),
        answers: [
          {
            civ: actor,
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
    expect(
      Object.values(state.ages!).some((age) => age.current === "future"),
    ).toBe(true);
    // Vingt secondes suffisaient quand ce test etait seul de son espece ; la
    // suite en compte desormais plusieurs aussi lourds, et en parallele
    // celui-ci depassait de deux secondes. Un delai propre l'emporte sur le
    // defaut global, donc il faut le relever ici aussi.
  }, 45000);
});
