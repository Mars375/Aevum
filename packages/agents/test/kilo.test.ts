import { describe, expect, it, vi } from "vitest";
import { FACTION_IDS, GRID_SIZE, type GeneralConfig } from "@abs/contracts";
import { createInitialState, localViewFor } from "@abs/engine";
import {
  ENDPOINTS,
  RemoteProvider,
  canCall,
  isFreeRef,
  parseModelRef,
} from "@abs/agents";
import { defaultCouncilModels } from "../src/default-models.js";

/**
 * Kilo sert ses modèles gratuits sans clé ni compte — c'est documenté par la
 * passerelle, et c'est ce qui en fait le fournisseur mesuré le plus stable du
 * banc apparié. Mais seulement ses modèles `:free` : un modèle payant ne doit
 * jamais partir sans clé, et aucun autre fournisseur ne devient anonyme.
 */
const VIEW = localViewFor(
  createInitialState(FACTION_IDS),
  "crimson",
  12,
  GRID_SIZE,
);
const ORDERS = {
  reasoning: "Advance.",
  orders: [
    { squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } },
    { squadId: "crimson-ranged", action: "HOLD", target: { x: 1, y: 3 } },
  ],
};
const ok = () =>
  new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(ORDERS) } },
      ],
      usage: {},
    }),
    { status: 200 },
  );
const DOTS = "kilo:dots-studio/dots-3-note-preview:free";
const general = (model: string): GeneralConfig => ({
  factionId: "crimson",
  displayName: "C",
  model,
  fallbacks: [],
});

describe("Kilo, fournisseur sans clé pour ses modèles gratuits", () => {
  it("se reconnaît à son préfixe, qui est retiré avant l'envoi", () => {
    expect(parseModelRef(DOTS)).toEqual({
      provider: "kilo",
      model: "dots-studio/dots-3-note-preview:free",
    });
    expect(ENDPOINTS.kilo.url).toBe(
      "https://api.kilo.ai/api/gateway/chat/completions",
    );
  });

  it("marque ses modèles gratuits comme OpenRouter, par `:free`", () => {
    expect(isFreeRef(DOTS)).toBe(true);
    expect(isFreeRef("kilo:openai/gpt-6-sol")).toBe(false);
  });

  it("n'autorise l'appel sans clé que pour un modèle gratuit de Kilo", () => {
    expect(canCall(DOTS, {})).toBe(true);
    expect(canCall("kilo:openai/gpt-6-sol", {})).toBe(false);
    expect(canCall("kilo:openai/gpt-6-sol", { kilo: "k" })).toBe(true);
    // Les autres fournisseurs restent exactement comme avant : pas de clé, pas d'appel.
    expect(canCall("google/gemma-4-26b-a4b-it:free", {})).toBe(false);
    expect(canCall("groq:openai/gpt-oss-120b", {})).toBe(false);
  });

  it("envoie un modèle gratuit sans en-tête d'autorisation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const provider = new RemoteProvider({
      apiKeys: {},
      fetchImpl,
      sleepImpl: async () => {},
    });
    await provider.decide(VIEW, general(DOTS));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(ENDPOINTS.kilo.url);
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(init.body).model).toBe(
      "dots-studio/dots-3-note-preview:free",
    );
  });

  /**
   * Sans ce champ, le même conseil dépassait 45 s ; avec, il répondait en 6 s.
   * Seuls les modèles mesurés le reçoivent : un fournisseur qui ne le connaît
   * pas pourrait refuser l'appel.
   */
  it("demande de ne pas raisonner aux seuls modèles mesurés", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => ok());
    const provider = new RemoteProvider({
      apiKeys: { groq: "g" },
      fetchImpl,
      sleepImpl: async () => {},
    });
    await provider.decide(VIEW, general(DOTS));
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body).reasoning).toEqual({
      effort: "none",
    });
    await provider.decide(VIEW, general("groq:openai/gpt-oss-120b"));
    expect(JSON.parse(fetchImpl.mock.calls[1]![1].body)).not.toHaveProperty(
      "reasoning",
    );
  });

  it("garde la clé quand il y en a une", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const provider = new RemoteProvider({
      apiKeys: { kilo: "k" },
      fetchImpl,
      sleepImpl: async () => {},
    });
    await provider.decide(VIEW, general(DOTS));
    expect(fetchImpl.mock.calls[0]![1].headers.Authorization).toBe("Bearer k");
  });

  it("ne fait jamais partir un modèle payant sans clé", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const provider = new RemoteProvider({
      apiKeys: {},
      fetchImpl,
      sleepImpl: async () => {},
      freeModelsOnly: false,
    });
    await provider
      .decide(VIEW, general("kilo:openai/gpt-6-sol"))
      .catch(() => undefined);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("le modèle des conseils se choisit sans toucher au code", () => {
  it("prend une référence complète, chez n'importe quel fournisseur", () => {
    expect(defaultCouncilModels({ AEVUM_COUNCIL_MODEL: DOTS }).amber).toBe(
      DOTS,
    );
  });

  it("donne un modèle à chaque civilisation, pour les apparier", () => {
    const models = defaultCouncilModels({
      AEVUM_COUNCIL_MODEL: DOTS,
      AEVUM_COUNCIL_MODELS:
        "azure=nous:meituan/longcat-2.0:free, verdant=kilo:nex-agi/nex-n2.5-mini:free",
    });
    expect(models).toEqual({
      amber: DOTS,
      azure: "nous:meituan/longcat-2.0:free",
      crimson: DOTS,
      verdant: "kilo:nex-agi/nex-n2.5-mini:free",
    });
  });

  it("refuse une civilisation mal écrite plutôt que de l'ignorer", () => {
    expect(() =>
      defaultCouncilModels({ AEVUM_COUNCIL_MODELS: "ambre=kilo:x:free" }),
    ).toThrow(/invalide/);
  });

  it("garde NOUS_MODEL et le défaut tels quels", () => {
    expect(
      defaultCouncilModels({ NOUS_MODEL: "poolside/laguna-s-2.1:free" }).azure,
    ).toBe("nous:poolside/laguna-s-2.1:free");
    // Le défaut n'est plus longcat : il perd un tour sur sept en durée.
    expect(defaultCouncilModels({}).crimson).toBe(DOTS);
  });
});
