import { describe, expect, it } from "vitest";
import {
  CouncilDecisionSchema,
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";

/**
 * Les invariants que le module seul ne pouvait pas prouver.
 *
 * `agreements.test.ts` borne les règles ; ici on vérifie ce qui n'existe qu'une
 * fois branché : l'ordre des dépenses dans un tour, le rejeu (W4), le fait
 * qu'aucune réserve ne passe en négatif (W6), et surtout que les versions
 * antérieures ne bougent pas d'un iota.
 */
const stockOf = (state: SpectatorState, id: string) =>
  state.world.civs.find((c) => c.id === id)!.stock;

const enrich = (state: SpectatorState, id: string) => {
  state.world.civs.find((c) => c.id === id)!.stock = {
    food: 400,
    timber: 400,
    ore: 400,
    wealth: 400,
  };
};

/** Joue des tours locaux jusqu'à ce que `civ` soit l'acteur. */
function playUntil(state: SpectatorState, civ: string, guard = 12) {
  const turns: Campaign["turns"] = [];
  for (let n = 0; n < guard && activeCiv(state) !== civ; n++) {
    const actor = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, actor));
    state = resolveCouncil(state, [decision]).state;
    turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ: actor,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }
  return { state, turns };
}

/** Une décision locale de l'acteur, enrichie d'un accord. */
function withAgreement(state: SpectatorState, agreement: unknown) {
  const actor = activeCiv(state)!;
  return {
    actor,
    decision: CouncilDecisionSchema.parse({
      ...localCouncil(state, actor),
      agreement,
    }),
  };
}

describe("la v10 s'ajoute sans rien déplacer", () => {
  it("crée son état, et seulement à partir de la v10", () => {
    expect(newSpectator(42, "spectator-10").agreement).toEqual({
      offers: [],
      pacts: [],
      history: [],
      trust: {},
      seq: {},
    });
    expect(newSpectator(42, "spectator-9").agreement).toBeUndefined();
  });

  /**
   * La régression qui compte : une campagne v9 jouée à travers le moteur
   * modifié ne doit pas gagner un champ, ni changer de signature.
   */
  it("laisse une campagne v9 exactement où elle était", () => {
    let state = newSpectator(7, "spectator-9");
    const signatures: string[] = [];
    for (let n = 0; n < 6; n++) {
      const actor = activeCiv(state)!;
      state = resolveCouncil(state, [
        CouncilDecisionSchema.parse(localCouncil(state, actor)),
      ]).state;
      signatures.push(stateSignature(state));
      expect(state.agreement).toBeUndefined();
    }
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("refuse un état v10 sans ses registres", () => {
    const state = newSpectator(42, "spectator-10");
    const broken = { ...state, agreement: undefined };
    expect(() => resolveCouncil(broken as SpectatorState, [])).toThrow();
  });
});

describe("un accord traverse le moteur", () => {
  it("propose, accepte, déplace les réserves et le raconte", () => {
    let state = newSpectator(42, "spectator-10");
    enrich(state, "amber");
    enrich(state, "azure");

    const first = playUntil(state, "amber");
    state = first.state;
    const proposal = withAgreement(state, {
      action: "propose",
      kind: "transfer",
      target: "azure",
      give: { food: 0, timber: 0, ore: 40, wealth: 0 },
      receive: { food: 25, timber: 0, ore: 0, wealth: 0 },
    });
    const proposed = resolveCouncil(state, [proposal.decision]);
    expect(proposed.rejected.filter((r) => r.civ === "amber")).toEqual([]);
    state = proposed.state;
    const offer = state.agreement!.offers.at(-1)!;
    expect(proposed.events.some((e) => e.kind === "OFFERED")).toBe(true);

    const second = playUntil(state, "azure");
    state = second.state;
    const oreBefore = stockOf(state, "azure").ore;
    const acceptance = withAgreement(state, {
      action: "accept",
      offerId: offer.id,
    });
    const accepted = resolveCouncil(state, [acceptance.decision]);
    state = accepted.state;

    expect(accepted.events.some((e) => e.kind === "TRANSFER")).toBe(true);
    expect(stockOf(state, "azure").ore).toBeGreaterThan(oreBefore);
    expect(state.agreement!.offers).toHaveLength(0);
  });

  /**
   * L'accord se règle avant toute dépense du tour, donc un échange qui vide une
   * réserve la vide pour de bon : rien ne peut la dépenser une seconde fois, et
   * aucun stock ne passe en négatif (W6).
   */
  it("ne laisse aucune réserve passer en négatif après un échange qui la vide", () => {
    let state = newSpectator(42, "spectator-10");
    enrich(state, "amber");
    state = playUntil(state, "amber").state;
    const azure = state.world.civs.find((c) => c.id === "azure")!;
    const all = { ...azure.stock };

    const proposal = withAgreement(state, {
      action: "propose",
      kind: "transfer",
      target: "azure",
      give: { food: 0, timber: 0, ore: 0, wealth: 0 },
      // amber demande tout le minerai d'azure : la réserve part en entier.
      receive: {
        food: 0,
        timber: 0,
        ore: Math.floor(all.ore),
        wealth: 0,
      },
    });
    state = resolveCouncil(state, [proposal.decision]).state;
    const offer = state.agreement!.offers.at(-1)!;

    state = playUntil(state, "azure").state;
    const accepted = resolveCouncil(state, [
      withAgreement(state, { action: "accept", offerId: offer.id }).decision,
    ]);
    state = accepted.state;

    for (const civ of state.world.civs)
      for (const [name, amount] of Object.entries(civ.stock))
        expect(amount, `${civ.id}.${name}`).toBeGreaterThanOrEqual(0);
  });

  it("enregistre un accord refusé au lieu de le réécrire", () => {
    let state = newSpectator(42, "spectator-10");
    state = playUntil(state, "amber").state;
    const refused = resolveCouncil(state, [
      withAgreement(state, { action: "renounce", target: "azure" }).decision,
    ]);
    expect(
      refused.rejected.some(
        (r) => r.civ === "amber" && /Accord refusé/.test(r.detail),
      ),
    ).toBe(true);
    expect(refused.state.agreement!.pacts).toHaveLength(0);
  });
});

describe("rejeu (W4)", () => {
  it("une campagne v10 portant un accord se rejoue à l'identique", () => {
    /**
     * Aucun enrichissement ici, et c'est le point : un rejeu repart d'un monde
     * neuf. Trafiquer les réserves après la création rendait la campagne
     * irrejouable — ce test l'a signalé au premier tour, ce qui est exactement
     * ce que W4 doit faire. Les réserves initiales suffisent à l'échange.
     */
    let state = newSpectator(42, "spectator-10");
    const campaign: Campaign = {
      version: "spectator-10",
      id: "agreements-replay",
      seed: 42,
      mode: "local",
      models: {},
      maxTurns: 40,
      turns: [],
      pending: null,
    };

    const record = (actor: string, decision: unknown, next: SpectatorState) => {
      campaign.turns.push({
        turn: (decision as { turn: number }).turn,
        signature: stateSignature(next),
        answers: [
          {
            civ: actor as Campaign["turns"][number]["answers"][number]["civ"],
            decision: decision as never,
            source: "local",
            model: null,
            service: null,
            error: null,
          },
        ],
      });
    };

    // Quelques tours locaux, puis une proposition, puis son acceptation.
    for (let n = 0; n < 10; n++) {
      const actor = activeCiv(state)!;
      const pending = state.agreement!.offers.find((o) => o.to === actor);
      const agreement = pending
        ? { action: "accept", offerId: pending.id }
        : actor === "amber" && state.agreement!.offers.length === 0
          ? {
              action: "propose",
              kind: "transfer",
              target: "azure",
              give: { food: 0, timber: 0, ore: 20, wealth: 0 },
              receive: { food: 10, timber: 0, ore: 0, wealth: 0 },
            }
          : null;
      const decision = CouncilDecisionSchema.parse({
        ...localCouncil(state, actor),
        ...(agreement ? { agreement } : {}),
      });
      const result = resolveCouncil(state, [decision]);
      state = result.state;
      record(actor, decision, state);
    }

    expect(campaign.turns.length).toBe(10);
    const parsed = CampaignSchema.parse(campaign);
    const replayed = replayCampaign(parsed);
    expect(stateSignature(replayed.state)).toBe(stateSignature(state));
    // Et l'accord a réellement eu lieu pendant ces dix tours.
    expect(
      replayed.state.agreement!.history.some((e) => e.kind === "TRANSFER"),
    ).toBe(true);
  });
});
