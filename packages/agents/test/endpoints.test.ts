import { describe, expect, it, vi } from "vitest";
import { FACTION_IDS, GRID_SIZE, type GeneralConfig } from "@abs/contracts";
import { createInitialState, localViewFor } from "@abs/engine";
import { ENDPOINTS, RemoteProvider, isFreeRef, parseModelRef } from "@abs/agents";

const VIEW = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);
const SAMPLE = {
  reasoning: "Advance.",
  orders: [
    { squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } },
    { squadId: "crimson-ranged", action: "HOLD", target: { x: 1, y: 3 } },
  ],
};
const ok = () =>
  new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(SAMPLE) } }], usage: {} }), {
    status: 200,
  });

describe("model references carry their provider", () => {
  it("routes a bare id to OpenRouter and a groq: prefix to Groq", () => {
    expect(parseModelRef("google/gemma-4-26b-a4b-it:free")).toEqual({
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    });
    // The Groq id itself contains a slash, so the prefix must be stripped, not split on "/".
    expect(parseModelRef("groq:openai/gpt-oss-120b")).toEqual({ provider: "groq", model: "openai/gpt-oss-120b" });
    expect(parseModelRef("nvidia:meta/llama-3.3-70b-instruct")).toEqual({
      provider: "nvidia",
      model: "meta/llama-3.3-70b-instruct",
    });
    expect(parseModelRef("mistral:mistral-large-latest")).toEqual({ provider: "mistral", model: "mistral-large-latest" });
  });

  it("checks free-ness the way each provider actually expresses it", () => {
    expect(isFreeRef("google/gemma-4-26b-a4b-it:free")).toBe(true);
    expect(isFreeRef("anthropic/claude-opus")).toBe(false);
    // Groq has no per-model free marker: the free tier is an account property.
    expect(isFreeRef("groq:openai/gpt-oss-120b")).toBe(true);
    expect(isFreeRef("nvidia:meta/llama-3.3-70b-instruct")).toBe(true);
    expect(isFreeRef("mistral:mistral-large-latest")).toBe(true);
  });
});

describe("RemoteProvider routing", () => {
  const provider = (fetchImpl: any, keys: Record<string, string | undefined> = { openrouter: "or", groq: "gq" }) =>
    new RemoteProvider({ apiKeys: keys as any, fetchImpl, sleepImpl: async () => {} });

  it("sends a Groq model to the Groq endpoint with the Groq key and the stripped id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const g: GeneralConfig = { factionId: "crimson", displayName: "C", model: "groq:openai/gpt-oss-120b", fallbacks: [] };
    await provider(fetchImpl).decide(VIEW, g);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(ENDPOINTS.groq.url);
    expect(init.headers.Authorization).toBe("Bearer gq");
    expect(JSON.parse(init.body).model).toBe("openai/gpt-oss-120b");
  });

  it("sends an OpenRouter model to the OpenRouter endpoint with the OpenRouter key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const g: GeneralConfig = { factionId: "crimson", displayName: "C", model: "google/gemma-4-26b-a4b-it:free", fallbacks: [] };
    await provider(fetchImpl).decide(VIEW, g);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(ENDPOINTS.openrouter.url);
    expect(init.headers.Authorization).toBe("Bearer or");
  });

  it("crosses providers mid-chain, which is the point of a mixed roster", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(ok());
    const g: GeneralConfig = {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["google/gemma-4-26b-a4b-it:free"],
    };
    const { telemetry } = await provider(fetchImpl).decide(VIEW, g);

    expect(fetchImpl.mock.calls[0]![0]).toBe(ENDPOINTS.groq.url);
    expect(fetchImpl.mock.calls[2]![0]).toBe(ENDPOINTS.openrouter.url);
    expect(telemetry.servedModel).toBe("google/gemma-4-26b-a4b-it:free");
    expect(telemetry.fellBack).toBe(true);
  });

  it("skips a provider it has no key for instead of sending an empty Authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const g: GeneralConfig = {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["google/gemma-4-26b-a4b-it:free"],
    };
    const { telemetry } = await provider(fetchImpl, { openrouter: "or", groq: undefined }).decide(VIEW, g);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe(ENDPOINTS.openrouter.url);
    expect(telemetry.servedModel).toBe("google/gemma-4-26b-a4b-it:free");
  });

  it("never puts a key anywhere but the Authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const g: GeneralConfig = { factionId: "crimson", displayName: "C", model: "groq:openai/gpt-oss-120b", fallbacks: [] };
    await provider(fetchImpl).decide(VIEW, g);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).not.toContain("gq");
    expect(init.body).not.toContain("gq");
    expect(init.body).not.toMatch(/gsk_|sk-or-/);
  });
});

describe("the mixed roster keeps its two structural promises", () => {
  it("never lets a primary appear anywhere in another faction's chain", async () => {
    // Stronger than the original rule, which only guarded the FIRST fallback:
    // a contender reachable deeper in someone else's chain can still turn one
    // general into a copy of another, which is defect D1 all over again.
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    const primaries = DEFAULT_GENERALS.map((g) => g.model);
    expect(new Set(primaries).size).toBe(4);
    for (const g of DEFAULT_GENERALS) {
      for (const fb of g.fallbacks) {
        expect(primaries, `${g.factionId} can fall back onto a rival's own model (${fb})`).not.toContain(fb);
      }
    }
  });

  it("keeps every primary off the exhausted provider", async () => {
    // NVIDIA returns 429 with no reset header, and minimax-m3 played 0 of 45
    // turns as a primary. A dead provider may cost a hop, never a contender.
    const { DEFAULT_GENERALS, parseModelRef: parse } = await import("@abs/agents");
    for (const g of DEFAULT_GENERALS) {
      expect(parse(g.model).provider, `${g.factionId} leads with NVIDIA`).not.toBe("nvidia");
    }
  });

  it("spans all three providers in every chain, so one exhausted quota strands nobody", async () => {
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    // The 12-rotation tournament collapsed to 0% service on a single tier.
    // Three independent quotas per chain is the structural answer.
    for (const g of DEFAULT_GENERALS) {
      const providers = new Set([g.model, ...g.fallbacks].map((m) => parseModelRef(m).provider));
      expect(providers, `${g.factionId} only reaches ${[...providers]}`).toEqual(
        new Set(["openrouter", "groq", "nvidia", "mistral"]),
      );
    }
  });

  it("gives the four primaries four different vendors", async () => {
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    const vendors = DEFAULT_GENERALS.map((g) => parseModelRef(g.model).model.split("/")[0]);
    expect(new Set(vendors).size).toBe(4);
  });

  it("keeps the whole roster inside the 0 EUR ceiling", async () => {
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    for (const g of DEFAULT_GENERALS) for (const m of [g.model, ...g.fallbacks]) expect(isFreeRef(m), m).toBe(true);
  });
});

/**
 * The first v2 battle ate twelve HTTP 429s from one Groq model. The cause was
 * ours: Groq reserves the whole `max_tokens` against its 8000-token minute
 * budget, so asking for 6000 allowed exactly one call per minute. And the
 * backoff was a flat 500ms against limits that reset on the minute.
 */
describe("rate limits are read and obeyed, not guessed at", () => {
  it("caps Groq well below the others, because Groq reserves what we ask for", async () => {
    const { ENDPOINTS } = await import("@abs/agents");
    expect(ENDPOINTS.groq.maxTokens).toBeLessThan(ENDPOINTS.openrouter.maxTokens);
    // 8000 TPM must allow several calls a minute, not one.
    expect(8000 / ENDPOINTS.groq.maxTokens).toBeGreaterThanOrEqual(3);
  });

  it("sends each provider its own ceiling", async () => {
    const { ENDPOINTS, RemoteProvider } = await import("@abs/agents");
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const provider = new RemoteProvider({ apiKeys: { openrouter: "or", groq: "gq" }, fetchImpl, sleepImpl: async () => {} });

    await provider.decide(VIEW, { factionId: "crimson", displayName: "C", model: "groq:openai/gpt-oss-120b", fallbacks: [] });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).max_tokens).toBe(ENDPOINTS.groq.maxTokens);

    fetchImpl.mockClear();
    await provider.decide(VIEW, { factionId: "crimson", displayName: "C", model: "google/gemma-4-26b-a4b-it:free", fallbacks: [] });
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).max_tokens).toBe(ENDPOINTS.openrouter.maxTokens);
  });

  it("parses the duration formats each provider actually uses", async () => {
    const { readRateLimit } = await import("@abs/agents");
    const groq = readRateLimit(
      new Headers({
        "x-ratelimit-remaining-requests": "999",
        "x-ratelimit-remaining-tokens": "1755",
        "x-ratelimit-reset-tokens": "46.837s",
        "x-ratelimit-reset-requests": "1m26.4s",
      }),
    );
    expect(groq.remainingTokens).toBe(1755);
    expect(groq.resetTokensMs).toBeCloseTo(46837, -1);
    expect(groq.resetRequestsMs).toBeCloseTo(86400, -1);

    // OpenRouter reports a plain daily counter and an absolute epoch reset.
    const or = readRateLimit(
      new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Date.now() + 3_600_000) }),
    );
    expect(or.remainingRequests).toBe(0);
    expect(or.resetRequestsMs!).toBeGreaterThan(3_000_000);
  });

  it("waits as long as the provider asked, instead of a flat half second", async () => {
    const { RemoteProvider } = await import("@abs/agents");
    const slept: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "x-ratelimit-reset-tokens": "46.837s", "x-ratelimit-remaining-tokens": "0" } }),
      )
      .mockResolvedValueOnce(ok());
    const provider = new RemoteProvider({
      apiKeys: { groq: "gq" },
      fetchImpl,
      sleepImpl: async (ms: number) => void slept.push(ms),
    });

    const { decision } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: [],
    });
    expect(decision).not.toBeNull();
    expect(slept[0]).toBeGreaterThan(40_000);
  });

  it("gives up on an absurd wait rather than idling through it", async () => {
    // "Come back in 24 hours" will still be true in 75 seconds. Sleeping the
    // cap and retrying would only earn a second 429.
    const { RemoteProvider } = await import("@abs/agents");
    const slept: number[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "86400" } }));
    const provider = new RemoteProvider({
      apiKeys: { groq: "gq" },
      fetchImpl,
      sleepImpl: async (ms: number) => void slept.push(ms),
    });
    const { decision } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: [],
    });
    expect(decision).toBeNull();
    expect(slept).toEqual([]);
  });

  it("waits out a drained bucket for the primary rather than hopping off it", async () => {
    // This test used to assert the opposite, and that rule cost a tournament:
    // hopping whenever a fallback existed meant a contender's own model was
    // never served once its bucket drained. Hopping is for fallbacks.
    const { RemoteProvider } = await import("@abs/agents");
    const slept: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "x-ratelimit-reset-tokens": "58s", "x-ratelimit-remaining-tokens": "0" } }),
      )
      .mockResolvedValueOnce(ok());
    const provider = new RemoteProvider({
      apiKeys: { groq: "gq", nvidia: "nv" },
      fetchImpl,
      sleepImpl: async (ms: number) => void slept.push(ms),
    });

    const { decision, telemetry } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["nvidia:meta/llama-3.3-70b-instruct"],
    });

    expect(decision).not.toBeNull();
    expect(telemetry.servedModel).toBe("groq:openai/gpt-oss-120b");
    expect(slept[0]).toBeGreaterThan(50_000);
  });
});

/**
 * The tournament that motivated this: three of four contenders played 0 of 48
 * turns on their own model. Nothing had failed — "hop instead of waiting" was
 * doing its job for throughput, and starving the primary as a side effect.
 * A ranking of models that never played is not a ranking.
 */
describe("a general's own model is worth waiting for", () => {
  const drained = () =>
    new Response("", { status: 429, headers: { "x-ratelimit-reset-tokens": "20s", "x-ratelimit-remaining-tokens": "0" } });

  it("waits out a drained bucket for the primary, even with a fallback available", async () => {
    const { RemoteProvider } = await import("@abs/agents");
    const slept: number[] = [];
    const fetchImpl = vi.fn().mockResolvedValueOnce(drained()).mockResolvedValueOnce(ok());
    const provider = new RemoteProvider({
      apiKeys: { groq: "gq", nvidia: "nv" },
      fetchImpl,
      sleepImpl: async (ms: number) => void slept.push(ms),
    });

    const { telemetry } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["nvidia:meta/llama-3.3-70b-instruct"],
    });

    // It waited, and it was served by its own model rather than the fallback.
    expect(slept[0]).toBeGreaterThan(15_000);
    expect(telemetry.servedModel).toBe("groq:openai/gpt-oss-120b");
    expect(telemetry.fellBack).toBe(false);
  });

  it("still hops rather than waiting for a fallback", async () => {
    const { RemoteProvider } = await import("@abs/agents");
    const slept: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 400 })) // primary out, permanently
      .mockResolvedValueOnce(drained()) // first fallback drained
      .mockResolvedValueOnce(ok()); // second fallback serves
    const provider = new RemoteProvider({
      apiKeys: { groq: "gq", nvidia: "nv", openrouter: "or" },
      fetchImpl,
      sleepImpl: async (ms: number) => void slept.push(ms),
    });

    await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["nvidia:meta/llama-3.3-70b-instruct", "google/gemma-4-26b-a4b-it:free"],
    });

    // Speed outranks identity once we are already off the contender's model.
    expect(slept.reduce((a, b) => a + b, 0)).toBeLessThan(3_000);
  });

  it("records why it fell back, even when the fallback succeeded", async () => {
    const { RemoteProvider } = await import("@abs/agents");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 400 }))
      .mockResolvedValueOnce(ok());
    const provider = new RemoteProvider({ apiKeys: { groq: "gq", nvidia: "nv" }, fetchImpl, sleepImpl: async () => {} });

    const { telemetry } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: ["nvidia:meta/llama-3.3-70b-instruct"],
    });

    expect(telemetry.fellBack).toBe(true);
    // The replay used to show a substitution with no reason recorded anywhere.
    expect(telemetry.error).toContain("400");
  });

  it("leaves error null when the general played its own model", async () => {
    const { RemoteProvider } = await import("@abs/agents");
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const provider = new RemoteProvider({ apiKeys: { groq: "gq" }, fetchImpl, sleepImpl: async () => {} });
    const { telemetry } = await provider.decide(VIEW, {
      factionId: "crimson",
      displayName: "C",
      model: "groq:openai/gpt-oss-120b",
      fallbacks: [],
    });
    expect(telemetry.error).toBeNull();
  });
});
