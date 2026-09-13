import { describe, it, expect } from "vitest";
import {
  newSpectator,
  localCouncil,
  resolveCouncil,
  activeCiv,
} from "../src/spectator.js";
import { resolveCommands, MOVEMENT_BUDGET } from "../src/commands.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";
const idle = (
  state: ReturnType<typeof newSpectator>,
  civ: NonNullable<ReturnType<typeof activeCiv>>,
) => ({
  ...localCouncil(state, civ),
  orders: [],
  construction: [],
  diplomacy: [],
  recruitSettler: false,
  plan: undefined,
});
describe("successive civilization turns", () => {
  it("credits an actual multi-tile caravan arrival and does not repeat it on another ruler's turn", () => {
    let state = newSpectator(42, "spectator-4");
    for (const index of [0, 1, 2, 3]) {
      state.world.board[index]!.owner = "amber";
      state.world.board[index]!.kind = "plain";
    }
    const cities = state.world.simulation!.cities;
    const origin = cities.find((c) => c.owner === "amber")!;
    origin.position = 0;
    cities.push({
      ...origin,
      id: "arrival",
      position: 3,
      buildings: [],
      queue: null,
    });
    const merchant = state.world.simulation!.units.find(
      (u) => u.owner === "amber" && u.role === "merchant",
    )!;
    merchant.position = 0;
    merchant.previous = 0;
    state.caravans![merchant.id] = origin.id;
    state = resolveCouncil(state, [
      {
        ...idle(state, "amber"),
        orders: [
          { unit: merchant.id, action: "move", target: 3, reason: "delivery" },
        ],
      },
    ]).state;
    expect(state.movement!.find((m) => m.unit === merchant.id)!.path).toEqual([
      0, 1, 2, 3,
    ]);
    expect(
      state.economy!.find((l) => l.city === "arrival")!.deliveries,
    ).toHaveLength(1);
    const wealth = state.world.civs.find((c) => c.id === "amber")!.stock.wealth;
    state = resolveCouncil(state, [idle(state, "azure")]).state;
    expect(state.world.civs.find((c) => c.id === "amber")!.stock.wealth).toBe(
      wealth,
    );
  });
  it("rotates once per living ruler and rejects another ruler without consuming a turn", () => {
    let state = newSpectator(42, "spectator-4");
    const original = structuredClone(state);
    expect(activeCiv(state)).toBe("amber");
    expect(resolveCouncil(state, [idle(state, "azure")]).state).toEqual(state);
    for (const civ of ["amber", "azure", "crimson", "verdant"] as const) {
      expect(activeCiv(state)).toBe(civ);
      const before = structuredClone(state);
      state = resolveCouncil(state, [idle(state, civ)]).state;
      for (const other of before.world.civs.filter((c) => c.id !== civ)) {
        expect(state.world.civs.find((c) => c.id === other.id)!.stock).toEqual(
          other.stock,
        );
        expect(
          state.world.civs.find((c) => c.id === other.id)!.science,
        ).toEqual(other.science);
      }
      expect(
        state.world.simulation!.units.filter((u) => u.owner !== civ),
      ).toEqual(before.world.simulation!.units.filter((u) => u.owner !== civ));
    }
    expect(state.sequence).toEqual({ activeCiv: "amber", round: 2 });
    expect(state.world.tick).toBe(4);
    expect(original.world.tick).toBe(0);
  });
  it("charges actual traversed terrain and leaves inactive missions and cooldown untouched", () => {
    const world = newSpectator(42, "spectator-4").world;
    world.board.forEach((tile) => {
      tile.owner = null;
      tile.kind = "plain";
    });
    const template = world.simulation!.units[0]!;
    world.simulation!.units = [
      {
        ...template,
        id: "soldier",
        owner: "amber",
        role: "soldier",
        position: 0,
        previous: 0,
        cooldown: 0,
      },
      {
        ...template,
        id: "merchant",
        owner: "azure",
        role: "merchant",
        position: 20,
        previous: 19,
        cooldown: 1,
      },
    ];
    world.board[1]!.kind = "forest";
    const order = {
      unit: "soldier",
      action: "move" as const,
      target: 4,
      reason: "",
    };
    const passive = {
      unit: "merchant",
      action: "move" as const,
      target: 25,
      reason: "",
      civ: "azure" as const,
      issuedAt: 0,
      status: "active" as const,
      route: [20, 21, 22, 23, 24, 25],
      detail: "",
    };
    const result = resolveCommands(
      world,
      [passive],
      [{ civ: "amber", turn: 0, orders: [order] }],
      "amber",
    );
    expect(result.world.simulation!.units[0]!.position).toBe(2);
    expect(result.movement[0]).toMatchObject({
      budget: 3,
      spent: 3,
      remaining: 0,
      path: [0, 1, 2],
    });
    expect(result.world.simulation!.units[1]).toEqual(
      world.simulation!.units[1],
    );
    expect(result.missions.find((m) => m.unit === "merchant")).toEqual(passive);
    expect(MOVEMENT_BUDGET.settler).toBe(2);
  });
  it("retains bilateral offers between rulers and resolves a trade agreement on the second turn", () => {
    let state = newSpectator(42, "spectator-4");
    state = resolveCouncil(state, [
      {
        ...idle(state, "amber"),
        diplomacy: [{ target: "azure", proposal: "trade" }],
      },
    ]).state;
    expect(state.diplomacyOffers).toHaveLength(1);
    state = resolveCouncil(state, [
      {
        ...idle(state, "azure"),
        diplomacy: [{ target: "amber", proposal: "trade" }],
      },
    ]).state;
    expect(
      state.world.simulation!.relations.find(
        (r) => r.a === "amber" && r.b === "azure",
      )!.status,
    ).toBe("trade");
    expect(state.diplomacyOffers).toEqual([]);
  });
  it("passes unavailable turns and deterministically replays individual decisions", () => {
    let state = newSpectator(42, "spectator-4");
    const campaign: Campaign = {
      version: "spectator-4",
      id: "sequence-test",
      seed: 42,
      mode: "local",
      models: {},
      turns: [],
      pending: null,
    };
    for (let turn = 0; turn < 12; turn++) {
      const civ = activeCiv(state)!;
      const decision = turn === 0 ? null : idle(state, civ);
      state = resolveCouncil(state, decision ? [decision] : []).state;
      campaign.turns.push({
        turn,
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
        signature: stateSignature(state),
      });
    }
    expect(state.world.tick).toBe(12);
    expect(state.sequence!.round).toBe(4);
    expect(replayCampaign(campaign).state).toEqual(state);
  });
});
