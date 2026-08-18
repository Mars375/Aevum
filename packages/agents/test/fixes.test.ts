import { describe, expect, it, vi } from "vitest";
import { FACTION_IDS, GRID_SIZE, ReplaySchema, type GeneralConfig, type Replay } from "@abs/contracts";
import { createInitialState, localViewFor } from "@abs/engine";
import { DEFAULT_GENERALS, RemoteProvider, ScriptedProvider, chargeNearest, isFreeRef, runBattle, userPrompt } from "@abs/agents";
import { extractJson } from "../src/json.js";
import { NATIVE_SCHEMA_MODELS, supportsNativeSchema } from "../src/roster.js";

const SAMPLE = {
  reasoning: "Close in.",
  orders: [
    { squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } },
    { squadId: "crimson-ranged", action: "HOLD", target: { x: 1, y: 3 } },
  ],
};

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }], usage: {} }), { status: 200 });

/** D1 — the roster collapsed onto one model because native schema was required. */
describe("D1 · prompt JSON mode widens the roster", () => {
  it("recovers JSON from a markdown fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("```\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("recovers JSON wrapped in prose", () => {
    expect(extractJson('Here are my orders:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it("is not fooled by braces inside strings", () => {
    expect(extractJson('{"note":"a } brace","b":2}')).toEqual({ note: "a } brace", b: 2 });
  });

  it("returns null rather than guessing when there is no JSON", () => {
    expect(extractJson("I refuse to answer.")).toBeNull();
    expect(extractJson("")).toBeNull();
  });

  it("sends response_format only to models that enforce it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(JSON.stringify(SAMPLE)));
    const provider = new RemoteProvider({ apiKeys: { openrouter: "k", groq: "k" }, fetchImpl, sleepImpl: async () => {} });
    const view = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);

    const native: GeneralConfig = { factionId: "crimson", displayName: "C", model: "google/gemma-4-26b-a4b-it:free", fallbacks: [] };
    await provider.decide(view, native);
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body)).toHaveProperty("response_format");

    fetchImpl.mockClear();
    const prompted: GeneralConfig = { factionId: "crimson", displayName: "C", model: "z-ai/glm-5.2:free", fallbacks: [] };
    await provider.decide(view, prompted);
    const body = JSON.parse(fetchImpl.mock.calls[0]![1].body);
    expect(body).not.toHaveProperty("response_format");
    // ...and the shape must be stated in the prompt instead.
    expect(body.messages[0].content).toContain("OUTPUT FORMAT");
  });

  it("accepts a fenced answer from a prompt-mode model", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("```json\n" + JSON.stringify(SAMPLE) + "\n```"));
    const provider = new RemoteProvider({ apiKeys: { openrouter: "k", groq: "k" }, fetchImpl, sleepImpl: async () => {} });
    const view = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);
    const { decision } = await provider.decide(view, {
      factionId: "crimson",
      displayName: "C",
      model: "z-ai/glm-5.2:free",
      fallbacks: [],
    });
    expect(decision!.orders).toHaveLength(2);
  });

  it("gives every faction a distinct primary, and never reuses one as another's first fallback", () => {
    const primaries = DEFAULT_GENERALS.map((g) => g.model);
    expect(new Set(primaries).size).toBe(4);
    for (const g of DEFAULT_GENERALS) {
      expect(primaries, `${g.model} is ${g.factionId}'s primary`).not.toContain(g.fallbacks[0]);
      expect(g.fallbacks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps the whole roster on free models", () => {
    // Checked through isFreeRef, not a ":free" suffix: that marker is
    // OpenRouter's convention and Groq has no per-model equivalent.
    for (const g of DEFAULT_GENERALS) {
      for (const m of [g.model, ...g.fallbacks]) expect(isFreeRef(m), m).toBe(true);
    }
  });

  it("only claims native support for models that actually have it", () => {
    expect(supportsNativeSchema("z-ai/glm-5.2:free")).toBe(false);
    expect(supportsNativeSchema("nvidia/nemotron-3-ultra-550b-a55b:free")).toBe(false);
    expect(supportsNativeSchema("google/gemma-4-26b-a4b-it:free")).toBe(true);
    for (const m of NATIVE_SCHEMA_MODELS) expect(m.endsWith(":free"), m).toBe(true);
  });
});

/** D2 — 18 out-of-range attacks against 11 hits, because range was a rule, not a fact. */
describe("D2 · reachability is stated per squad", () => {
  it("names the enemies a squad can hit right now", () => {
    const state = {
      turn: 3,
      squads: [
        { id: "crimson-ranged", factionId: "crimson" as const, archetype: "RANGED" as const, position: { x: 5, y: 5 }, hp: 8, maxHp: 8 },
        { id: "azure-melee", factionId: "azure" as const, archetype: "MELEE" as const, position: { x: 8, y: 5 }, hp: 10, maxHp: 10 },
      ],
    };
    const prompt = userPrompt(localViewFor(state, "crimson", 12, GRID_SIZE));
    expect(prompt).toContain("CAN ATTACK now");
    expect(prompt).toContain("azure-melee at (8,5)");
  });

  it("says plainly when a squad can hit nothing, and how far the nearest enemy is", () => {
    const state = {
      turn: 0,
      squads: [
        { id: "crimson-melee", factionId: "crimson" as const, archetype: "MELEE" as const, position: { x: 1, y: 1 }, hp: 10, maxHp: 10 },
        { id: "azure-melee", factionId: "azure" as const, archetype: "MELEE" as const, position: { x: 14, y: 14 }, hp: 10, maxHp: 10 },
      ],
    };
    const prompt = userPrompt(localViewFor(state, "crimson", 12, GRID_SIZE));
    expect(prompt).toContain("can attack NOTHING this turn");
    expect(prompt).toContain("13 tiles away");
  });

  it("still leaks no secret", () => {
    const prompt = userPrompt(localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE));
    expect(prompt).not.toMatch(/sk-or-|OPENROUTER|\/home\//);
  });
});

/** D4 — an interruption at turn 11 used to lose the whole battle. */
describe("D4 · checkpoint and resume", () => {
  const config = { seed: 7, maxTurns: 12, gridSize: GRID_SIZE, generals: DEFAULT_GENERALS };
  const play = (extra: Record<string, unknown> = {}) =>
    runBattle({
      config,
      provider: new ScriptedProvider(chargeNearest),
      battleId: "ckpt",
      now: () => new Date("2026-08-18T00:00:00.000Z"),
      ...extra,
    });

  it("emits a valid, loadable replay after every single turn", async () => {
    const snapshots: Replay[] = [];
    const replay = await play({ onTurn: (p: Replay) => snapshots.push(JSON.parse(JSON.stringify(p))) });

    expect(snapshots).toHaveLength(replay.turns.length);
    snapshots.forEach((snap, i) => {
      // Each checkpoint must satisfy the schema on its own — an interrupted
      // file has to stay openable, not merely exist.
      expect(ReplaySchema.safeParse(snap).success, `snapshot ${i}`).toBe(true);
      expect(snap.turns).toHaveLength(i + 1);
    });
  });

  it("resumes from a truncated replay and lands on the same battle as an uninterrupted run", async () => {
    const full = await play();
    const cut: Replay = {
      ...full,
      turns: full.turns.slice(0, 3),
      outcome: { kind: "DRAW", winner: null, reason: "interrompue", finalTurn: full.turns[2]!.stateAfter.turn },
    };

    const resumed = await play({ resumeFrom: cut });
    expect(resumed.turns).toHaveLength(full.turns.length);
    expect(resumed.turns).toEqual(full.turns);
    expect(resumed.outcome).toEqual(full.outcome);
    expect(resumed.manifest.battleId).toBe(full.manifest.battleId);
  });

  it("does not re-request turns it already has", async () => {
    const full = await play();
    let calls = 0;
    const counted = new ScriptedProvider((view, general) => {
      calls += 1;
      return chargeNearest(view, general);
    });
    await runBattle({
      config,
      provider: counted,
      battleId: "ckpt",
      now: () => new Date("2026-08-18T00:00:00.000Z"),
      resumeFrom: { ...full, turns: full.turns.slice(0, 3) },
    });
    const wouldBeFull = full.turns.flatMap((t) => t.decisions).length;
    expect(calls).toBeLessThan(wouldBeFull);
  });
});

/** Extension of D2: MOVE_TOO_FAR persisted because only attacks were spelled out. */
describe("D2b · the legal move envelope is stated too", () => {
  it("gives an explicit coordinate box, clipped to the grid edge", () => {
    const state = {
      turn: 0,
      squads: [
        { id: "crimson-melee", factionId: "crimson" as const, archetype: "MELEE" as const, position: { x: 1, y: 1 }, hp: 10, maxHp: 10 },
        { id: "azure-melee", factionId: "azure" as const, archetype: "MELEE" as const, position: { x: 14, y: 14 }, hp: 10, maxHp: 10 },
      ],
    };
    const prompt = userPrompt(localViewFor(state, "crimson", 12, GRID_SIZE));
    // MELEE moves 2 from (1,1); the box must clip at 0, not run to -1.
    expect(prompt).toContain("x in [0,3] and y in [0,3]");
  });

  it("clips at the far edge as well", () => {
    const state = {
      turn: 0,
      squads: [
        { id: "crimson-ranged", factionId: "crimson" as const, archetype: "RANGED" as const, position: { x: 15, y: 15 }, hp: 8, maxHp: 8 },
        { id: "azure-melee", factionId: "azure" as const, archetype: "MELEE" as const, position: { x: 1, y: 1 }, hp: 10, maxHp: 10 },
      ],
    };
    const prompt = userPrompt(localViewFor(state, "crimson", 12, GRID_SIZE));
    expect(prompt).toContain("x in [14,15] and y in [14,15]");
  });
});
