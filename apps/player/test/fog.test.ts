import { describe, expect, it } from "vitest";
import { ARCHETYPES, type Archetype, type FactionId, type Replay, type Squad, type WorldState } from "@abs/contracts";
import { alliesOfAt, knowledgeOf } from "../src/fog";

const squad = (id: string, factionId: FactionId, archetype: Archetype, x: number, y: number): Squad => ({
  id,
  factionId,
  archetype,
  position: { x, y },
  hp: ARCHETYPES[archetype].hp,
  maxHp: ARCHETYPES[archetype].hp,
});

/** Builds a replay from a list of states, with optional alliance pairs per turn. */
function makeReplay(states: WorldState[], pairsByTurn: Record<number, string[]> = {}): Replay {
  return {
    manifest: {
      replayVersion: "1",
      rulesetVersion: "v2",
      contractsVersion: "2.0.0",
      battleId: "fog",
      createdAt: "2026-08-19T00:00:00.000Z",
      config: { rulesetVersion: "v2", seed: 1, maxTurns: 12, gridSize: 16, generals: [] },
    },
    initialState: states[0]!,
    turns: states.slice(1).map((stateAfter, i) => ({
      turn: i + 1,
      decisions: [],
      events: [],
      stateAfter,
      alliances: { pairs: pairsByTurn[i + 1] ?? [], surrendered: [] },
    })),
    outcome: { kind: "DRAW", winner: null, winners: [], reason: "", finalTurn: states.length - 1 },
    reports: [],
    audits: [],
  } as unknown as Replay;
}

describe("a general sees only what its squads can see", () => {
  // crimson's scout has vision 9; azure sits 12 tiles away, out of reach.
  const far: WorldState = {
    turn: 0,
    squads: [squad("crimson-scout-1", "crimson", "SCOUT", 2, 2), squad("azure-melee-1", "azure", "MELEE", 14, 2)],
  };

  it("hides an enemy beyond every squad's vision", () => {
    const k = knowledgeOf(makeReplay([far]), "crimson", 0);
    expect(k.visible.has("crimson-scout-1")).toBe(true);
    expect(k.visible.has("azure-melee-1")).toBe(false);
    expect(k.remembered.size).toBe(0); // never seen, so nothing to remember
  });

  it("reveals it once it comes within reach", () => {
    const close: WorldState = {
      turn: 1,
      squads: [squad("crimson-scout-1", "crimson", "SCOUT", 2, 2), squad("azure-melee-1", "azure", "MELEE", 9, 2)],
    };
    const k = knowledgeOf(makeReplay([far, close]), "crimson", 1);
    expect(k.visible.has("azure-melee-1")).toBe(true);
    // Seen right now is a fact, not a memory.
    expect(k.remembered.has("azure-melee-1")).toBe(false);
  });
});

describe("what is lost from sight becomes a dated memory", () => {
  const seen: WorldState = {
    turn: 0,
    squads: [squad("crimson-scout-1", "crimson", "SCOUT", 2, 2), squad("azure-melee-1", "azure", "MELEE", 9, 2)],
  };
  const gone: WorldState = {
    turn: 1,
    squads: [squad("crimson-scout-1", "crimson", "SCOUT", 2, 2), squad("azure-melee-1", "azure", "MELEE", 15, 2)],
  };

  it("keeps the position where it was last observed, not where it now is", () => {
    const k = knowledgeOf(makeReplay([seen, gone]), "crimson", 1);
    expect(k.visible.has("azure-melee-1")).toBe(false);

    const memory = k.remembered.get("azure-melee-1")!;
    expect(memory.turn).toBe(0);
    // Stale on purpose: acting on this is a gamble, which is the whole point.
    expect(memory.squad.position).toEqual({ x: 9, y: 2 });
  });

  it("forgets a squad that was destroyed rather than lost", () => {
    const destroyed: WorldState = { turn: 1, squads: [squad("crimson-scout-1", "crimson", "SCOUT", 2, 2)] };
    const k = knowledgeOf(makeReplay([seen, destroyed]), "crimson", 1);
    expect(k.remembered.size).toBe(0);
  });
});

describe("allies share their eyes", () => {
  const states: WorldState[] = [
    {
      turn: 0,
      squads: [
        squad("crimson-melee-1", "crimson", "MELEE", 1, 1), // vision 4
        squad("amber-scout-1", "amber", "SCOUT", 13, 13), // vision 9
        squad("verdant-melee-1", "verdant", "MELEE", 14, 14),
      ],
    },
  ];

  it("cannot see the far enemy alone", () => {
    const k = knowledgeOf(makeReplay(states), "crimson", 0);
    expect(k.visible.has("verdant-melee-1")).toBe(false);
  });

  it("sees it through an ally's scout once allied", () => {
    // The alliance is recorded on turn 1, so we read the state after it.
    const replay = makeReplay([states[0]!, states[0]!], { 1: ["amber|crimson"] });
    expect(alliesOfAt(replay, "crimson", 1)).toEqual(["amber"]);

    const k = knowledgeOf(replay, "crimson", 1);
    expect(k.visible.has("verdant-melee-1")).toBe(true);
    // The ally's own squads are visible too, not treated as enemies.
    expect(k.visible.has("amber-scout-1")).toBe(true);
  });
});

describe("the omniscient view is not a general's view", () => {
  it("shows strictly less than the full board when fog applies", () => {
    const state: WorldState = {
      turn: 0,
      squads: [
        squad("crimson-melee-1", "crimson", "MELEE", 1, 1),
        squad("azure-melee-1", "azure", "MELEE", 14, 1),
        squad("verdant-melee-1", "verdant", "MELEE", 14, 14),
      ],
    };
    const k = knowledgeOf(makeReplay([state]), "crimson", 0);
    expect(k.visible.size).toBeLessThan(state.squads.length);
  });
});
