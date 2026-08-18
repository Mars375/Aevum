import { describe, expect, it, vi } from "vitest";
import { DecisionSchema, FACTION_IDS, GRID_SIZE, MAX_REASONING_CHARS, type GeneralConfig } from "@abs/contracts";
import { createInitialState, localViewFor } from "@abs/engine";
import { DEFAULT_GENERALS, ORDER_JSON_SCHEMA, RemoteProvider, ScriptedProvider, chargeNearest, runBattle, userPrompt } from "@abs/agents";

const VIEW = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);
const GENERAL: GeneralConfig = { factionId: "crimson", displayName: "Crimson", model: "a:free", fallbacks: ["b:free"] };

const SAMPLE = {
  reasoning: "Close on the nearest enemy.",
  orders: [
    { squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } },
    { squadId: "crimson-ranged", action: "HOLD", target: { x: 1, y: 3 } },
  ],
};

/** Minimal JSON Schema checker — enough for the strict subset we hand the API. */
function validate(schema: any, value: unknown, path = "$"): string[] {
  const errors: string[] = [];
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: expected object`];
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${path}.${key}: missing`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!(key in schema.properties)) errors.push(`${path}.${key}: not allowed`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in obj) errors.push(...validate(sub, obj[key], `${path}.${key}`));
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${path}: expected array`];
    value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
  } else if (schema.type === "string") {
    if (typeof value !== "string") errors.push(`${path}: expected string`);
    else if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not in enum`);
  } else if (schema.type === "integer") {
    if (!Number.isInteger(value)) errors.push(`${path}: expected integer`);
  }
  return errors;
}

const okResponse = (body: unknown, usage = { prompt_tokens: 100, completion_tokens: 50, cost: 0 }) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(body) } }], usage }), {
    status: 200,
  });

describe("schema agreement", () => {
  // Guards the deliberate duplication between the hand-written JSON Schema and
  // the zod schema. If one gains a field and the other does not, this fails.
  it("accepts the same sample on both sides", () => {
    expect(validate(ORDER_JSON_SCHEMA, SAMPLE)).toEqual([]);
    expect(DecisionSchema.safeParse(SAMPLE).success).toBe(true);
  });

  it("rejects the same malformed payloads on both sides", () => {
    const cases = [
      { reasoning: "x", orders: [{ squadId: "a", action: "TELEPORT", target: { x: 1, y: 1 } }] },
      { reasoning: "x", orders: [{ squadId: "a", action: "MOVE", target: { x: 1.5, y: 1 } }] },
      { reasoning: "x", orders: [{ squadId: "a", action: "MOVE" }] },
      { orders: [] },
    ];
    for (const bad of cases) {
      expect(validate(ORDER_JSON_SCHEMA, bad).length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(DecisionSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("forbids extra properties, as strict mode requires", () => {
    expect(validate(ORDER_JSON_SCHEMA, { ...SAMPLE, extra: 1 })).toEqual(["$.extra: not allowed"]);
  });
});

describe("prompt", () => {
  it("carries battlefield state and no secret", () => {
    const prompt = userPrompt(VIEW);
    expect(prompt).toContain("crimson-melee");
    expect(prompt).toContain("16x16");
    expect(prompt).not.toMatch(/sk-or-|OPENROUTER|\/home\//);
  });
});

describe("RemoteProvider", () => {
  const provider = (fetchImpl: any, extra = {}) =>
    new RemoteProvider({ apiKeys: { openrouter: "k", groq: "k" }, fetchImpl, sleepImpl: async () => {}, ...extra });

  it("returns a decision and its telemetry on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(SAMPLE));
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision!.orders).toHaveLength(2);
    expect(telemetry).toMatchObject({ servedModel: "a:free", requestedModel: "a:free", attempts: 1, promptTokens: 100, costUsd: 0 });
  });

  it("retries a 429 then succeeds on the same model", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(okResponse(SAMPLE));
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision).not.toBeNull();
    expect(telemetry.attempts).toBe(2);
    expect(telemetry.servedModel).toBe("a:free");
  });

  it("falls back to the next model and records both names", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(okResponse(SAMPLE));
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision).not.toBeNull();
    expect(telemetry.requestedModel).toBe("a:free");
    expect(telemetry.servedModel).toBe("b:free");
  });

  it("treats a length-truncated answer as retryable, not as a broken model", async () => {
    // This is the failure that made the first provider probe misdiagnose six
    // models. It must never be reported as "cannot follow a schema".
    const truncated = new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{\"reas" } }] }), {
      status: 200,
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(truncated).mockResolvedValueOnce(okResponse(SAMPLE));
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision).not.toBeNull();
    expect(telemetry.attempts).toBe(2);
  });

  it("returns a null decision rather than inventing orders when the chain is exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision).toBeNull();
    expect(telemetry.servedModel).toBeNull();
    expect(telemetry.error).toContain("429");
    expect(telemetry.attempts).toBe(4); // 2 models x 2 attempts
  });

  it("refuses a paid model while the budget ceiling is on, without calling it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(SAMPLE));
    const paid: GeneralConfig = { ...GENERAL, model: "anthropic/expensive", fallbacks: [] };
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, paid);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(decision).toBeNull();
    expect(telemetry.error).toContain("0 EUR");
  });

  it("skips a paid model but still uses a free fallback", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(SAMPLE));
    const mixed: GeneralConfig = { ...GENERAL, model: "anthropic/expensive", fallbacks: ["b:free"] };
    const { decision, telemetry } = await provider(fetchImpl).decide(VIEW, mixed);
    expect(decision).not.toBeNull();
    expect(telemetry.servedModel).toBe("b:free");
  });

  it("truncates an oversized justification before it reaches the replay", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ ...SAMPLE, reasoning: "x".repeat(9000) }));
    const { decision } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(decision!.reasoning).toHaveLength(MAX_REASONING_CHARS);
  });

  it("does not retry a 400, which no retry can fix", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 400 }));
    const { telemetry } = await provider(fetchImpl).decide(VIEW, GENERAL);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // one per model, no retry within a model
    expect(telemetry.servedModel).toBeNull();
  });
});

describe("runBattle", () => {
  const config = { seed: 42, maxTurns: 12, gridSize: GRID_SIZE, generals: DEFAULT_GENERALS };

  it("plays a full battle offline and produces a coherent replay", async () => {
    const replay = await runBattle({
      config,
      provider: new ScriptedProvider(chargeNearest),
      battleId: "test-battle",
      now: () => new Date("2026-08-17T00:00:00.000Z"),
    });

    expect(replay.manifest.battleId).toBe("test-battle");
    expect(replay.turns.length).toBeGreaterThan(0);
    expect(replay.turns.length).toBeLessThanOrEqual(12);
    expect(replay.turns.map((t) => t.turn)).toEqual(replay.turns.map((_, i) => i + 1));
    expect(replay.outcome.finalTurn).toBe(replay.turns.at(-1)!.stateAfter.turn);
    expect(replay.initialState.squads).toHaveLength(8);
  });

  it("is reproducible: the same scripted battle twice yields identical replays", async () => {
    const once = async () =>
      runBattle({
        config,
        provider: new ScriptedProvider(chargeNearest),
        battleId: "fixed",
        now: () => new Date("2026-08-17T00:00:00.000Z"),
      });
    expect(await once()).toEqual(await once());
  });

  it("records an unreachable general instead of holding silently", async () => {
    const replay = await runBattle({
      config,
      provider: new ScriptedProvider((view, general) => (general.factionId === "amber" ? null : chargeNearest(view, general))),
      battleId: "unreachable",
      now: () => new Date("2026-08-17T00:00:00.000Z"),
    });

    const unreachable = replay.turns[0]!.events.filter((e) => e.type === "GENERAL_UNREACHABLE");
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0]).toMatchObject({ factionId: "amber" });

    // The engine still had to fill the gap, and it did so visibly.
    const missing = replay.turns[0]!.events.filter((e) => e.type === "ORDER_MISSING");
    expect(missing.map((e) => (e as { squadId: string }).squadId).sort()).toEqual(["amber-melee", "amber-ranged"]);
  });

  /**
   * Regression: the first baseline let both squads of a faction pick the same
   * destination — they start adjacent and chase the same enemy — so the
   * contested-tile rule blocked both every turn and no squad ever moved. The
   * battle ran the full 12 turns with zero casualties. The engine was right;
   * the baseline was not.
   */
  it("closes to contact instead of deadlocking on its own squads", async () => {
    const replay = await runBattle({
      config,
      provider: new ScriptedProvider(chargeNearest),
      battleId: "no-deadlock",
      now: () => new Date("2026-08-17T00:00:00.000Z"),
    });

    const blocked = replay.turns[0]!.events.filter((e) => e.type === "MOVE_BLOCKED");
    expect(blocked, "no squad should be blocked by a squad of its own faction on turn 1").toHaveLength(0);

    const hits = replay.turns.flatMap((t) => t.events).filter((e) => e.type === "ATTACK_HIT");
    expect(hits.length, "the baseline must actually reach the enemy").toBeGreaterThan(0);
    expect(replay.turns.at(-1)!.stateAfter.squads.length).toBeLessThan(8);
  });

  it("stops calling a faction once it has been wiped out", async () => {
    const seen: string[] = [];
    await runBattle({
      config: { ...config, maxTurns: 3 },
      provider: new ScriptedProvider((view, general) => {
        seen.push(`${view.turn}:${general.factionId}`);
        return chargeNearest(view, general);
      }),
      battleId: "x",
      now: () => new Date("2026-08-17T00:00:00.000Z"),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
