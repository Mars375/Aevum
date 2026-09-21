import { describe, expect, it } from "vitest";
import { councilObservation, requestCouncil } from "../src/council.js";
import { AGREEMENT_COUNCIL_JSON_SCHEMA } from "../src/council-schema.js";
import {
  CouncilDecisionSchema,
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../../world/src/spectator.js";

/**
 * Le contrat v10 vu du dirigeant.
 *
 * Deux risques distincts : annoncer des possibilités que le moteur refuse
 * ensuite — la leçon de `settlementPlanSites` — et laisser fuir ce qu'une
 * civilisation n'a pas à savoir de ses voisines.
 */
const play = (state: SpectatorState, civ: string, guard = 12) => {
  for (let n = 0; n < guard && activeCiv(state) !== civ; n++) {
    const actor = activeCiv(state)!;
    state = resolveCouncil(state, [
      CouncilDecisionSchema.parse(localCouncil(state, actor)),
    ]).state;
  }
  return state;
};

describe("l'observation v10 porte les accords", () => {
  it("montre offres, pactes, confiance et options légales", () => {
    let state = newSpectator(42, "spectator-10");
    state = play(state, "amber");
    state = resolveCouncil(state, [
      CouncilDecisionSchema.parse({
        ...localCouncil(state, "amber"),
        agreement: {
          action: "propose",
          kind: "transfer",
          target: "azure",
          give: { food: 0, timber: 0, ore: 10, wealth: 0 },
          receive: { food: 5, timber: 0, ore: 0, wealth: 0 },
        },
      }),
    ]).state;

    const seen = councilObservation(state, "azure") as {
      agreements: {
        incoming: { id: string }[];
        outgoing: unknown[];
        options: { civ: string; nonaggression: boolean; transfer: boolean }[];
      };
    };
    expect(seen.agreements.incoming).toHaveLength(1);
    expect(seen.agreements.incoming[0]!.id).toMatch(/^agreement-v1:/);
    expect(seen.agreements.outgoing).toEqual([]);
    expect(seen.agreements.options.map((o) => o.civ)).not.toContain("azure");
    expect(seen.agreements.options.every((o) => o.transfer)).toBe(true);
  });

  it("n'expose rien de tel avant la v10", () => {
    const state = newSpectator(42, "spectator-9");
    expect(
      (councilObservation(state, "amber") as { agreements?: unknown })
        .agreements,
    ).toBeUndefined();
  });

  /**
   * Une offre dit ce qu'elle demande, jamais ce que l'autre possède : un
   * dirigeant apprend l'insolvabilité d'un partenaire en essuyant un refus.
   */
  it("ne laisse pas fuir les réserves d'une rivale", () => {
    let state = newSpectator(42, "spectator-10");
    const azure = state.world.civs.find((c) => c.id === "azure")!;
    azure.stock = { food: 1234, timber: 4321, ore: 999, wealth: 777 };
    state = play(state, "amber");

    const seen = JSON.stringify(
      (councilObservation(state, "amber") as { agreements: unknown })
        .agreements,
    );
    for (const secret of ["1234", "4321", "999", "777"])
      expect(seen, secret).not.toContain(secret);
  });

  it("annonce la confiance que l'acteur porte, pas celle qu'on lui porte", () => {
    const state = newSpectator(42, "spectator-10");
    const seen = councilObservation(state, "amber") as {
      agreements: { trust: Record<string, number> };
    };
    expect(Object.keys(seen.agreements.trust).sort()).toEqual([
      "azure",
      "crimson",
      "verdant",
    ]);
  });
});

describe("le contrat fournisseur v10", () => {
  it("décrit une commande plate, à champs nuls, et deux contributions", () => {
    const agreement = AGREEMENT_COUNCIL_JSON_SCHEMA.properties.agreement as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(agreement.properties).sort()).toEqual([
      "action",
      "duration",
      "give",
      "kind",
      "offerId",
      "receive",
      "target",
    ]);
    // offerId est exigé dans la forme : c'est par lui qu'on répond.
    expect(agreement.required).toContain("offerId");
    expect(agreement.required).toContain("give");
    expect(agreement.required).toContain("receive");
  });

  it("conserve tout le contrat v9", () => {
    for (const field of ["infrastructure", "modernization", "plan", "orders"])
      expect(AGREEMENT_COUNCIL_JSON_SCHEMA.properties).toHaveProperty(field);
  });

  it("est bien le schéma transmis sous la v10", async () => {
    const state = newSpectator(42, "spectator-10");
    const bodies: unknown[] = [];
    await requestCouncil(
      state,
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async (url, init) => {
        if (String(url).endsWith("/models"))
          return new Response(
            JSON.stringify({
              data: [{ id: "test", pricing: { prompt: "0", completion: "0" } }],
            }),
          );
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            model: "test",
            choices: [{ message: { content: "{}" } }],
          }),
        );
      },
    );
    const sent = JSON.stringify(bodies);
    expect(sent).toContain("nonaggression");
    expect(sent).toContain("offerId");
    // La consigne doit dire ce qui coule une réponse, sinon elle se découvre
    // en production.
    expect(sent).toContain("sinks the whole answer");
  });
});
