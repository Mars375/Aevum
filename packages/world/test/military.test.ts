import { describe, it, expect } from "vitest";
import { militaryProfile } from "../src/military.js";
import {
  newSpectator,
  localCouncil,
  activeCiv,
  resolveCouncil,
  CouncilDecisionSchema,
  type SpectatorState,
} from "../src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
} from "../src/campaign.js";
import { neighbours } from "../src/state.js";

function decision(overrides: Record<string, unknown> = {}) {
  return CouncilDecisionSchema.parse({
    civ: "amber",
    turn: 0,
    objective: "Évaluer l'armée",
    focus: "military",
    research: null,
    construction: [],
    diplomacy: [],
    recruitSettler: false,
    orders: [],
    ...overrides,
  });
}

describe("military profiles by technology", () => {
  it("scales power and resilience with age, research and programmes", () => {
    expect(militaryProfile("bronze", [], [])).toEqual({
      age: "bronze",
      power: 1,
      resilience: 1,
    });
    expect(
      militaryProfile("classical", ["metallurgy", "engineering"], []),
    ).toEqual({ age: "classical", power: 1.45, resilience: 1.25 });
    expect(militaryProfile("industrial", [], ["mechanization"])).toEqual({
      age: "industrial",
      power: 2.9,
      resilience: 1.6,
    });
    expect(
      militaryProfile(
        "future",
        [],
        ["automation", "orbital_network", "clean_energy", "power_grid"],
      ),
    ).toEqual({ age: "future", power: 7.2, resilience: 3.7 });
    expect(
      militaryProfile("medieval", [], []).power,
    ).toBeGreaterThan(militaryProfile("bronze", [], []).power);
  });

  function warState(rules: SpectatorState["rules"]) {
    const state = newSpectator(42, rules);
    const amber = state.world.civs.find((c) => c.id === "amber")!;
    const azure = state.world.civs.find((c) => c.id === "azure")!;
    amber.advances = ["metallurgy", "engineering"];
    amber.stock = { food: 10000, timber: 10000, ore: 10000, wealth: 10000 };
    if (rules === "spectator-7")
      state.ages!.amber = {
        current: "classical",
        enteredAt: 0,
        history: [{ age: "classical", turn: 0 }],
      };
    const relation = state.world.simulation!.relations.find(
      (r) => [r.a, r.b].includes("amber") && [r.a, r.b].includes("azure"),
    )!;
    relation.status = "war";
    relation.truceUntil = 0;
    const target = azure.capital!;
    const entry = neighbours(state.world.size, target)[0]!;
    state.world.board[entry]!.owner = "amber";
    amber.soldiers = 6;
    azure.soldiers = 6;
    state.world.simulation!.units = state.world.simulation!.units.filter(
      (u) =>
        !((u.owner === "amber" || u.owner === "azure") && u.role === "soldier"),
    );
    state.world.simulation!.units.push({
      id: "amber-attacker",
      owner: "amber",
      role: "soldier",
      position: entry,
      previous: entry,
      target: null,
      strength: 6,
      cooldown: 0,
      task: "idle",
    });
    state.world.simulation!.units.push({
      id: "azure-guard",
      owner: "azure",
      role: "soldier",
      position: target,
      previous: target,
      target: null,
      strength: 6,
      cooldown: 0,
      task: "idle",
    });
    return { state, target };
  }

  function defenderLosses(rules: SpectatorState["rules"]) {
    const { state, target } = warState(rules);
    const before = state.world.simulation!.units.find(
      (u) => u.id === "azure-guard",
    )!;
    const resolved = resolveCouncil(state, [
      decision({
        orders: [
          {
            unit: "amber-attacker",
            action: "attack",
            target,
            reason: "Test",
          },
        ],
      }),
    ]);
    const guard = resolved.state.world.simulation!.units.find(
      (u) => u.id === "azure-guard",
    )!;
    return before.strength - guard.strength;
  }

  it("multiplies attack damage only under spectator-7 rules", () => {
    expect(defenderLosses("spectator-6")).toBe(3);
    expect(defenderLosses("spectator-7")).toBe(4);
  });

  it("replays a spectator-7 campaign deterministically", () => {
    let state = newSpectator(42, "spectator-7");
    const turns = [];
    for (let t = 0; t < 4; t++) {
      const civ = activeCiv(state)!;
      const submitted = localCouncil(state, civ);
      const result = resolveCouncil(state, [submitted]);
      state = result.state;
      turns.push({
        turn: t,
        answers: [
          {
            civ,
            decision: submitted,
            source: "local" as const,
            model: "local/deterministic-council-v7",
            service: null,
            error: null,
          },
        ],
        signature: stateSignature(state),
      });
    }
    const campaign = CampaignSchema.parse({
      version: "spectator-7",
      id: "military-replay-42",
      seed: 42,
      mode: "local",
      models: {},
      turns,
      pending: null,
    });
    const first = replayCampaign(campaign);
    const second = replayCampaign(campaign);
    expect(first.state).toEqual(second.state);
    expect(
      first.history.map((snapshot) => stateSignature(snapshot)),
    ).toEqual(second.history.map((snapshot) => stateSignature(snapshot)));
  });
});
