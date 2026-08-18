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
  });

  it("checks free-ness the way each provider actually expresses it", () => {
    expect(isFreeRef("google/gemma-4-26b-a4b-it:free")).toBe(true);
    expect(isFreeRef("anthropic/claude-opus")).toBe(false);
    // Groq has no per-model free marker: the free tier is an account property.
    expect(isFreeRef("groq:openai/gpt-oss-120b")).toBe(true);
    expect(isFreeRef("nvidia:meta/llama-3.3-70b-instruct")).toBe(true);
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
  it("gives every faction a distinct primary, never reused as another's first fallback", async () => {
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    const primaries = DEFAULT_GENERALS.map((g) => g.model);
    expect(new Set(primaries).size).toBe(4);
    for (const g of DEFAULT_GENERALS) {
      expect(primaries, `${g.fallbacks[0]} is some faction's primary`).not.toContain(g.fallbacks[0]);
    }
  });

  it("spans all three providers in every chain, so one exhausted quota strands nobody", async () => {
    const { DEFAULT_GENERALS } = await import("@abs/agents");
    // The 12-rotation tournament collapsed to 0% service on a single tier.
    // Three independent quotas per chain is the structural answer.
    for (const g of DEFAULT_GENERALS) {
      const providers = new Set([g.model, ...g.fallbacks].map((m) => parseModelRef(m).provider));
      expect(providers, `${g.factionId} only reaches ${[...providers]}`).toEqual(
        new Set(["openrouter", "groq", "nvidia"]),
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
