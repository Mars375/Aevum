import { describe, expect, it } from "vitest";
import { ARCHETYPES, FACTION_IDS, GRID_SIZE, distance, type FactionId, type Order, type WorldState } from "@abs/contracts";
import { SeededRng, checkOutcome, createInitialState, resolveTurn } from "@abs/engine";
import type { FactionOrders } from "../src/resolve.js";

const ROSTER = createInitialState(FACTION_IDS).squads.map((s) => s.id);

const run = (state: WorldState, orders: FactionOrders[]) => resolveTurn(state, orders, ROSTER, GRID_SIZE);

const hold = (factionId: FactionId, ids: string[]): FactionOrders => ({
  factionId,
  orders: ids.map((squadId) => ({ squadId, action: "HOLD", target: { x: 0, y: 0 } }) satisfies Order),
});

/** Every faction holds, so a scenario only has to state the orders it cares about. */
function allHold(state: WorldState): FactionOrders[] {
  return FACTION_IDS.map((factionId) =>
    hold(
      factionId,
      state.squads.filter((s) => s.factionId === factionId).map((s) => s.id),
    ),
  );
}

function withOrders(state: WorldState, overrides: Record<string, Order>): FactionOrders[] {
  return FACTION_IDS.map((factionId) => ({
    factionId,
    orders: state.squads
      .filter((s) => s.factionId === factionId)
      .map((s) => overrides[s.id] ?? ({ squadId: s.id, action: "HOLD", target: { ...s.position } } satisfies Order)),
  }));
}

/** Place squads exactly where a scenario needs them, dropping everyone else. */
function scenario(placements: Array<{ id: string; at: { x: number; y: number }; hp?: number }>): WorldState {
  const base = createInitialState(FACTION_IDS);
  const squads = placements.map(({ id, at, hp }) => {
    const squad = base.squads.find((s) => s.id === id);
    if (!squad) throw new Error(`unknown squad ${id}`);
    return { ...squad, position: { ...at }, hp: hp ?? squad.hp };
  });
  return { turn: 0, squads };
}

describe("I1 conservation", () => {
  it("never introduces a squad and never resurrects one", () => {
    let state = createInitialState(FACTION_IDS);
    const counts: number[] = [state.squads.length];
    for (let i = 0; i < 5; i += 1) {
      state = run(state, allHold(state)).state;
      counts.push(state.squads.length);
    }
    expect(counts.every((c, i) => i === 0 || c <= counts[i - 1]!)).toBe(true);
    expect(new Set(state.squads.map((s) => s.id)).size).toBe(state.squads.length);
  });
});

describe("I2 hp bounds", () => {
  it("keeps published hp within (0, maxHp]", () => {
    let state = scenario([
      { id: "crimson-melee", at: { x: 5, y: 5 } },
      { id: "azure-melee", at: { x: 6, y: 5 } },
    ]);
    for (let i = 0; i < 3; i += 1) {
      state = run(
        state,
        withOrders(state, {
          "crimson-melee": { squadId: "crimson-melee", action: "ATTACK", target: { x: 6, y: 5 } },
        }),
      ).state;
      for (const squad of state.squads) {
        expect(squad.hp).toBeGreaterThan(0);
        expect(squad.hp).toBeLessThanOrEqual(squad.maxHp);
      }
    }
  });
});

describe("I3 unique occupancy", () => {
  it("fails both moves when two squads claim the same tile", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 4, y: 5 } },
      { id: "azure-melee", at: { x: 6, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: 5, y: 5 } },
        "azure-melee": { squadId: "azure-melee", action: "MOVE", target: { x: 5, y: 5 } },
      }),
    );

    // Neither wins the tile: contested moves fail on both sides, no priority.
    expect(result.state.squads.find((s) => s.id === "crimson-melee")!.position).toEqual({ x: 4, y: 5 });
    expect(result.state.squads.find((s) => s.id === "azure-melee")!.position).toEqual({ x: 6, y: 5 });
    expect(result.events.filter((e) => e.type === "MOVE_BLOCKED")).toHaveLength(2);

    const tiles = result.state.squads.map((s) => `${s.position.x},${s.position.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it("blocks a move onto a squad that is standing still", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 4, y: 5 } },
      { id: "azure-melee", at: { x: 5, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: 5, y: 5 } },
      }),
    );
    expect(result.state.squads.find((s) => s.id === "crimson-melee")!.position).toEqual({ x: 4, y: 5 });
  });

  it("propagates a blocked move to the squad queued behind it", () => {
    // c-melee is pinned by the stationary a-melee; a-ranged wanted c-melee's tile
    // and must fail too once c-melee is known to stay. This is the fixed point.
    const state = scenario([
      { id: "azure-melee", at: { x: 5, y: 5 } },
      { id: "crimson-melee", at: { x: 4, y: 5 } },
      { id: "azure-ranged", at: { x: 3, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: 5, y: 5 } },
        "azure-ranged": { squadId: "azure-ranged", action: "MOVE", target: { x: 4, y: 5 } },
      }),
    );
    expect(result.state.squads.find((s) => s.id === "crimson-melee")!.position).toEqual({ x: 4, y: 5 });
    expect(result.state.squads.find((s) => s.id === "azure-ranged")!.position).toEqual({ x: 3, y: 5 });
    expect(result.events.filter((e) => e.type === "MOVE_BLOCKED")).toHaveLength(2);
  });
});

describe("I4 closed grid", () => {
  it("rejects an out-of-bounds destination", () => {
    const state = scenario([{ id: "crimson-melee", at: { x: 0, y: 0 } }]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: -1, y: 0 } },
      }),
    );
    expect(result.events).toContainEqual({ type: "ORDER_REJECTED", squadId: "crimson-melee", reason: "OUT_OF_BOUNDS" });
    for (const squad of result.state.squads) {
      expect(squad.position.x).toBeGreaterThanOrEqual(0);
      expect(squad.position.x).toBeLessThan(GRID_SIZE);
      expect(squad.position.y).toBeGreaterThanOrEqual(0);
      expect(squad.position.y).toBeLessThan(GRID_SIZE);
    }
  });
});

describe("I5 legal movement", () => {
  it("rejects a move beyond the archetype's allowance", () => {
    const state = scenario([{ id: "crimson-ranged", at: { x: 5, y: 5 } }]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-ranged": { squadId: "crimson-ranged", action: "MOVE", target: { x: 9, y: 5 } },
      }),
    );
    expect(result.events).toContainEqual({ type: "ORDER_REJECTED", squadId: "crimson-ranged", reason: "MOVE_TOO_FAR" });
    expect(result.state.squads[0]!.position).toEqual({ x: 5, y: 5 });
  });

  it("holds every effective step within the allowance over a full battle", () => {
    let state = createInitialState(FACTION_IDS);
    for (let turn = 0; turn < 6; turn += 1) {
      const before = new Map(state.squads.map((s) => [s.id, { ...s.position }]));
      const orders = withOrders(
        state,
        Object.fromEntries(
          state.squads.map((s) => [
            s.id,
            { squadId: s.id, action: "MOVE", target: { x: Math.min(s.position.x + 1, 15), y: s.position.y } } satisfies Order,
          ]),
        ),
      );
      state = run(state, orders).state;
      for (const squad of state.squads) {
        expect(distance(before.get(squad.id)!, squad.position)).toBeLessThanOrEqual(ARCHETYPES[squad.archetype].movement);
      }
    }
  });
});

describe("I6 simultaneity", () => {
  it("gives the same state and events whatever order the factions answered in", () => {
    const state = createInitialState(FACTION_IDS);
    const orders = withOrders(state, {
      "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } },
      "azure-melee": { squadId: "azure-melee", action: "MOVE", target: { x: 11, y: 2 } },
    });
    const forward = run(state, orders);
    const reversed = run(state, [...orders].reverse());
    expect(reversed.state).toEqual(forward.state);
    expect(reversed.events).toEqual(forward.events);
  });
});

describe("I7 mutual destruction", () => {
  it("lets two squads kill each other on the same turn", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 5, y: 5 }, hp: 3 },
      { id: "azure-melee", at: { x: 6, y: 5 }, hp: 3 },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "ATTACK", target: { x: 6, y: 5 } },
        "azure-melee": { squadId: "azure-melee", action: "ATTACK", target: { x: 5, y: 5 } },
      }),
    );
    expect(result.state.squads).toHaveLength(0);
    expect(result.events.filter((e) => e.type === "SQUAD_DESTROYED")).toHaveLength(2);
  });
});

describe("I8 determinism", () => {
  it("replays a whole battle to an identical state", () => {
    const play = () => {
      let state = createInitialState(FACTION_IDS);
      const log: WorldState[] = [];
      for (let turn = 0; turn < 12; turn += 1) {
        state = run(
          state,
          withOrders(state, {
            "crimson-melee": { squadId: "crimson-melee", action: "MOVE", target: { x: state.squads[0]!.position.x + 1, y: 2 } },
          }),
        ).state;
        log.push(state);
      }
      return log;
    };
    expect(play()).toEqual(play());
  });
});

describe("I9 purity", () => {
  it("consumes no randomness at ruleset v1", () => {
    const rng = new SeededRng(1234);
    let state = createInitialState(FACTION_IDS);
    for (let turn = 0; turn < 12; turn += 1) state = run(state, allHold(state)).state;
    // If a future rule starts rolling dice, this fails and forces the change to
    // be acknowledged rather than slipped in.
    expect(rng.calls).toBe(0);
  });
});

describe("I10 termination", () => {
  it("always ends by the turn limit", () => {
    let state = createInitialState(FACTION_IDS);
    let outcome = checkOutcome(state, 12);
    let turns = 0;
    while (!outcome && turns < 100) {
      state = run(state, allHold(state)).state;
      turns += 1;
      outcome = checkOutcome(state, 12);
    }
    expect(turns).toBe(12);
    expect(outcome).not.toBeNull();
    expect(outcome!.kind).toBe("DRAW");
  });
});

describe("I11 illegal orders are inert", () => {
  it("leaves positions and hp untouched when every order is illegal", () => {
    const state = createInitialState(FACTION_IDS);
    const result = run(state, [
      {
        factionId: "crimson",
        orders: [
          { squadId: "ghost-squad", action: "MOVE", target: { x: 1, y: 1 } },
          { squadId: "azure-melee", action: "MOVE", target: { x: 1, y: 1 } },
          { squadId: "crimson-melee", action: "MOVE", target: { x: 99, y: 99 } },
          { squadId: "crimson-melee", action: "MOVE", target: { x: 3, y: 2 } },
        ],
      },
    ]);
    expect(result.state.squads.map((s) => s.position)).toEqual(state.squads.map((s) => s.position));
    expect(result.state.squads.map((s) => s.hp)).toEqual(state.squads.map((s) => s.hp));

    const reasons = result.events.filter((e) => e.type === "ORDER_REJECTED").map((e) => (e as { reason: string }).reason);
    expect(reasons).toContain("UNKNOWN_SQUAD");
    expect(reasons).toContain("FOREIGN_SQUAD");
    expect(reasons).toContain("OUT_OF_BOUNDS");
    // First order wins: the follow-up for the same squad is rejected even
    // though the first one was itself downgraded to HOLD.
    expect(reasons).toContain("DUPLICATE_ORDER");
  });

  it("reports a dead squad differently from an unknown one", () => {
    const state = scenario([{ id: "crimson-melee", at: { x: 5, y: 5 } }]);
    const result = run(state, [
      { factionId: "azure", orders: [{ squadId: "azure-melee", action: "HOLD", target: { x: 0, y: 0 } }] },
    ]);
    expect(result.events).toContainEqual({ type: "ORDER_REJECTED", squadId: "azure-melee", reason: "DEAD_SQUAD" });
  });
});

describe("combat edge cases", () => {
  it("misses a target that moved away", () => {
    const state = scenario([
      { id: "crimson-ranged", at: { x: 5, y: 5 } },
      { id: "azure-melee", at: { x: 7, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-ranged": { squadId: "crimson-ranged", action: "ATTACK", target: { x: 7, y: 5 } },
        "azure-melee": { squadId: "azure-melee", action: "MOVE", target: { x: 9, y: 5 } },
      }),
    );
    expect(result.events).toContainEqual({ type: "ATTACK_MISSED", squadId: "crimson-ranged", at: { x: 7, y: 5 } });
    expect(result.state.squads.find((s) => s.id === "azure-melee")!.hp).toBe(ARCHETYPES.MELEE.hp);
  });

  it("hits whoever ends the turn on the targeted tile", () => {
    const state = scenario([
      { id: "crimson-ranged", at: { x: 5, y: 5 } },
      { id: "azure-melee", at: { x: 7, y: 5 } },
      { id: "verdant-melee", at: { x: 8, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-ranged": { squadId: "crimson-ranged", action: "ATTACK", target: { x: 8, y: 5 } },
        "azure-melee": { squadId: "azure-melee", action: "MOVE", target: { x: 6, y: 5 } },
      }),
    );
    expect(result.state.squads.find((s) => s.id === "verdant-melee")!.hp).toBe(ARCHETYPES.MELEE.hp - ARCHETYPES.RANGED.damage);
  });

  it("blocks friendly fire", () => {
    const state = scenario([
      { id: "crimson-ranged", at: { x: 5, y: 5 } },
      { id: "crimson-melee", at: { x: 6, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-ranged": { squadId: "crimson-ranged", action: "ATTACK", target: { x: 6, y: 5 } },
      }),
    );
    expect(result.events).toContainEqual({ type: "ATTACK_FRIENDLY_BLOCKED", squadId: "crimson-ranged", at: { x: 6, y: 5 } });
    expect(result.state.squads.find((s) => s.id === "crimson-melee")!.hp).toBe(ARCHETYPES.MELEE.hp);
  });

  it("reports an attack beyond range instead of silently shortening it", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 5, y: 5 } },
      { id: "azure-melee", at: { x: 9, y: 5 } },
    ]);
    const result = run(
      state,
      withOrders(state, {
        "crimson-melee": { squadId: "crimson-melee", action: "ATTACK", target: { x: 9, y: 5 } },
      }),
    );
    expect(result.events).toContainEqual({
      type: "ATTACK_OUT_OF_RANGE",
      squadId: "crimson-melee",
      at: { x: 9, y: 5 },
      distance: 4,
      range: 1,
    });
  });

  it("normalises a stray HOLD target without rejecting it", () => {
    const state = scenario([{ id: "crimson-melee", at: { x: 5, y: 5 } }]);
    const result = run(state, [
      { factionId: "crimson", orders: [{ squadId: "crimson-melee", action: "HOLD", target: { x: 0, y: 0 } }] },
    ]);
    expect(result.events.filter((e) => e.type === "ORDER_REJECTED")).toHaveLength(0);
    expect(result.state.squads[0]!.position).toEqual({ x: 5, y: 5 });
  });
});

describe("outcome", () => {
  it("declares the last faction standing the winner", () => {
    const state = scenario([{ id: "crimson-melee", at: { x: 5, y: 5 } }]);
    expect(checkOutcome(state, 12)).toMatchObject({ kind: "VICTORY", winner: "crimson" });
  });

  it("calls mutual annihilation a draw with no winner", () => {
    expect(checkOutcome({ turn: 4, squads: [] }, 12)).toMatchObject({ kind: "ANNIHILATION", winner: null });
  });

  it("breaks a turn-limit tie on remaining hp", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 5, y: 5 }, hp: 9 },
      { id: "azure-melee", at: { x: 9, y: 9 }, hp: 4 },
    ]);
    expect(checkOutcome({ ...state, turn: 12 }, 12)).toMatchObject({ kind: "VICTORY", winner: "crimson" });
  });

  it("keeps the battle running while two factions live and turns remain", () => {
    const state = scenario([
      { id: "crimson-melee", at: { x: 5, y: 5 } },
      { id: "azure-melee", at: { x: 9, y: 9 } },
    ]);
    expect(checkOutcome({ ...state, turn: 5 }, 12)).toBeNull();
  });
});
