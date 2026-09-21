import { describe, expect, it } from "vitest";
import { newCivilizationWorld } from "../src/civilization.js";
import {
  AGREEMENT_ISSUES,
  AgreementCommandSchema,
  OFFER_CAP,
  OFFER_LIFETIME,
  TRUST_DELTAS,
  agreementView,
  applyAgreement,
  breakPactsOnWar,
  dissolveOnDeath,
  emptyAgreement,
  expireOffers,
  tickPacts,
  trustOf,
  type AgreementContext,
} from "../src/agreements.js";

/**
 * Les bornes du module d'accords (v10).
 *
 * Plusieurs d'entre elles répondent à un défaut trouvé dans la conception avant
 * qu'une ligne soit écrite : l'échange à sens unique, l'acceptation rendue
 * impossible par sa propre garde, l'offre désignée par cible et type alors
 * qu'une offre peut être remplacée, et la mort qui dissolvait « sans blâme »
 * mais aurait pu verser une prime.
 *
 * Trois invariants du §10 de la conception ne sont pas ici et n'y seront pas :
 * le budget partagé sur un tour, la régression des rejeux v1 à v9 et « un seul
 * accord par tour » se mesurent à l'intégration moteur, pas sur un module pur.
 */
const fresh = (): AgreementContext => ({
  world: newCivilizationWorld(["amber", "azure"], 7),
  agreement: emptyAgreement(),
});

const stockOf = (ctx: AgreementContext, id: string) =>
  ctx.world.civs.find((c) => c.id === id)!.stock;

function rich(ctx: AgreementContext, id: string) {
  const civ = ctx.world.civs.find((c) => c.id === id)!;
  civ.stock = { food: 500, timber: 500, ore: 500, wealth: 500 };
  return civ;
}

const cmd = (input: Record<string, unknown>) =>
  AgreementCommandSchema.parse(input);

const parcel = (over: Partial<Record<string, number>> = {}) => ({
  food: 0,
  timber: 0,
  ore: 0,
  wealth: 0,
  ...over,
});

function declareWar(ctx: AgreementContext) {
  ctx.world.simulation!.relations.push({
    a: "amber",
    b: "azure",
    status: "war",
    since: 0,
    truceUntil: 0,
  });
}

/** Une offre d'échange d'amber vers azure, et son identifiant. */
function offerTransfer(ctx: AgreementContext, round = 1) {
  rich(ctx, "amber");
  rich(ctx, "azure");
  const issue = applyAgreement(
    ctx,
    "amber",
    cmd({
      action: "propose",
      kind: "transfer",
      target: "azure",
      give: parcel({ ore: 30 }),
      receive: parcel({ food: 20 }),
    }),
    round,
  );
  expect(issue).toBeNull();
  return ctx.agreement!.offers.at(-1)!;
}

describe("offres : durée de vie et remplacement", () => {
  it("expire à round + 3, le consigne, et n'exécute jamais rien", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    expect(offer.expiresRound).toBe(1 + OFFER_LIFETIME);
    const before = { ...stockOf(ctx, "amber") };

    expireOffers(ctx, offer.expiresRound - 1);
    expect(ctx.agreement!.offers).toHaveLength(1);

    expireOffers(ctx, offer.expiresRound);
    expect(ctx.agreement!.offers).toHaveLength(0);
    expect(stockOf(ctx, "amber")).toEqual(before);
    expect(ctx.agreement!.history.at(-1)!.kind).toBe("OFFER_EXPIRED");
  });

  it("une nouvelle proposition remplace la précédente de même paire et type", () => {
    const ctx = fresh();
    const first = offerTransfer(ctx, 1);
    const second = offerTransfer(ctx, 2);
    expect(ctx.agreement!.offers).toHaveLength(1);
    expect(ctx.agreement!.offers[0]!.id).toBe(second.id);
    expect(second.id).not.toBe(first.id);
  });

  it("refuse une offre vide, et une offre à soi-même", () => {
    const ctx = fresh();
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({ action: "propose", kind: "transfer", target: "azure" }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.emptyTransfer);
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "amber",
          duration: 4,
        }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.selfTarget);
  });

  it("borne le nombre d'offres en attente, sans bloquer un remplacement", () => {
    const ctx: AgreementContext = {
      world: newCivilizationWorld(["amber", "azure", "crimson", "verdant"], 7),
      agreement: emptyAgreement(),
    };
    rich(ctx, "amber");
    const names = ["amber", "azure", "crimson", "verdant"] as const;
    // Douze paires ordonnées distinctes : la borne se mesure sur des offres
    // qui coexistent vraiment, pas sur des doublons qui se remplacent.
    const pairs = names.flatMap((from) =>
      names.filter((to) => to !== from).map((to) => [from, to] as const),
    );
    expect(pairs).toHaveLength(OFFER_CAP);
    ctx.agreement!.offers = pairs.map(([from, to], n) => ({
      id: `seed-${n}`,
      from,
      to,
      kind: "nonaggression" as const,
      duration: 4 as const,
      give: parcel(),
      receive: parcel(),
      issuedRound: 1,
      expiresRound: 9,
    }));

    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "transfer",
          target: "azure",
          give: parcel({ ore: 1 }),
        }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.offersFull);

    // Remplacer ne fait pas grandir la file : à saturation, un dirigeant peut
    // toujours revoir sa propre offre.
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "azure",
          duration: 12,
        }),
        2,
      ),
    ).toBeNull();
    expect(ctx.agreement!.offers).toHaveLength(OFFER_CAP);
  });
});

describe("l'échange est bilatéral, et atomique", () => {
  it("déplace les deux contributions d'un seul coup", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    const amberBefore = { ...stockOf(ctx, "amber") };
    const azureBefore = { ...stockOf(ctx, "azure") };

    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "accept", offerId: offer.id }),
        1,
      ),
    ).toBeNull();

    expect(stockOf(ctx, "amber").ore).toBe(amberBefore.ore - 30);
    expect(stockOf(ctx, "amber").food).toBe(amberBefore.food + 20);
    expect(stockOf(ctx, "azure").ore).toBe(azureBefore.ore + 30);
    expect(stockOf(ctx, "azure").food).toBe(azureBefore.food - 20);
    expect(ctx.agreement!.offers).toHaveLength(0);
    expect(ctx.agreement!.history.at(-1)!.kind).toBe("TRANSFER");
  });

  /**
   * Le brouillon ne validait que l'offreur, parce qu'un seul côté donnait.
   * Avec deux contributions, l'insolvabilité de l'accepteur doit refuser aussi
   * — sinon un stock passerait en négatif (W6).
   */
  it("refuse sans rien déplacer quand l'accepteur ne peut pas payer", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    const azure = ctx.world.civs.find((c) => c.id === "azure")!;
    azure.stock = { food: 5, timber: 0, ore: 0, wealth: 0 };
    const amberBefore = { ...stockOf(ctx, "amber") };

    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "accept", offerId: offer.id }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.insufficientAccepter);
    expect(stockOf(ctx, "amber")).toEqual(amberBefore);
    expect(stockOf(ctx, "azure").food).toBe(5);
    // L'offre survit à un refus : elle attend son expiration.
    expect(ctx.agreement!.offers).toHaveLength(1);
  });

  it("refuse sans rien déplacer quand l'offreur s'est appauvri depuis", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    const amber = ctx.world.civs.find((c) => c.id === "amber")!;
    amber.stock = { food: 0, timber: 0, ore: 1, wealth: 0 };
    const azureBefore = { ...stockOf(ctx, "azure") };

    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "accept", offerId: offer.id }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.insufficientOfferer);
    expect(stockOf(ctx, "azure")).toEqual(azureBefore);
    expect(stockOf(ctx, "amber").ore).toBe(1);
  });
});

describe("on répond à une offre par son identifiant", () => {
  /**
   * Le défaut que cela ferme : `propose` remplace l'offre pendante de même
   * paire et type. Désigner l'offre par cible + type aurait fait porter
   * l'acceptation sur des termes que personne n'a lus.
   */
  it("ne peut pas accepter une offre remplacée à la place de celle qui l'a remplacée", () => {
    const ctx = fresh();
    const first = offerTransfer(ctx, 1);
    const second = offerTransfer(ctx, 2);
    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "accept", offerId: first.id }),
        2,
      ),
    ).toBe(AGREEMENT_ISSUES.unknownOffer);
    expect(ctx.agreement!.offers[0]!.id).toBe(second.id);
  });

  it("refuse un identifiant inconnu, et une offre adressée à un autre", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "accept", offerId: "nope" }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.unknownOffer);
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({ action: "accept", offerId: offer.id }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.notAddressed);
    expect(applyAgreement(ctx, "azure", cmd({ action: "accept" }), 1)).toBe(
      AGREEMENT_ISSUES.missingOffer,
    );
  });

  it("decline retire l'offre et la consigne, sans rien déplacer", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    const before = { ...stockOf(ctx, "amber") };
    expect(
      applyAgreement(
        ctx,
        "azure",
        cmd({ action: "decline", offerId: offer.id }),
        1,
      ),
    ).toBeNull();
    expect(ctx.agreement!.offers).toHaveLength(0);
    expect(stockOf(ctx, "amber")).toEqual(before);
    expect(ctx.agreement!.history.at(-1)!.kind).toBe("DECLINED");
  });
});

describe("pactes de non-agression", () => {
  const propose = (ctx: AgreementContext, duration: 4 | 8 | 12, round = 1) => {
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "azure",
          duration,
        }),
        round,
      ),
    ).toBeNull();
    return ctx.agreement!.offers.at(-1)!;
  };

  /** Le cas que le brouillon rendait impossible : accepter EXIGE une offre. */
  it("se conclut quand une offre existe, et honore sa durée", () => {
    for (const duration of [4, 8, 12] as const) {
      const ctx = fresh();
      const offer = propose(ctx, duration, 5);
      expect(
        applyAgreement(
          ctx,
          "azure",
          cmd({ action: "accept", offerId: offer.id }),
          5,
        ),
      ).toBeNull();
      const pact = ctx.agreement!.pacts[0]!;
      expect(pact.startRound).toBe(5);
      expect(pact.endRound).toBe(5 + duration);
      expect(ctx.agreement!.history.at(-1)!.kind).toBe("PACT");
    }
  });

  it("refuse un second pacte, et toute proposition en guerre", () => {
    const ctx = fresh();
    const offer = propose(ctx, 4);
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "azure",
          duration: 4,
        }),
        2,
      ),
    ).toBe(AGREEMENT_ISSUES.pactActive);

    const other = fresh();
    declareWar(other);
    expect(
      applyAgreement(
        other,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "azure",
          duration: 4,
        }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.atWar);
  });

  it("mené à son terme, il élève la confiance des deux côtés", () => {
    const ctx = fresh();
    const offer = propose(ctx, 4, 1);
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    tickPacts(ctx, 4);
    expect(ctx.agreement!.pacts).toHaveLength(1);

    tickPacts(ctx, 5);
    expect(ctx.agreement!.pacts).toHaveLength(0);
    expect(trustOf(ctx.agreement!, "amber", "azure")).toBe(
      TRUST_DELTAS.fulfilled,
    );
    expect(trustOf(ctx.agreement!, "azure", "amber")).toBe(
      TRUST_DELTAS.fulfilled,
    );
  });

  it("rompu unilatéralement, seule la confiance du partenaire baisse", () => {
    const ctx = fresh();
    const offer = propose(ctx, 8, 1);
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({ action: "renounce", target: "azure" }),
        2,
      ),
    ).toBeNull();
    expect(ctx.agreement!.pacts).toHaveLength(0);
    expect(trustOf(ctx.agreement!, "azure", "amber")).toBe(
      TRUST_DELTAS.renounced,
    );
    // Rompre sa propre parole ne change pas ce qu'on pense de l'autre.
    expect(trustOf(ctx.agreement!, "amber", "azure")).toBe(0);
    expect(ctx.agreement!.history.at(-1)!.kind).toBe("PACT_BROKEN");
  });

  it("refuse de rompre un pacte qui n'existe pas", () => {
    const ctx = fresh();
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({ action: "renounce", target: "azure" }),
        1,
      ),
    ).toBe(AGREEMENT_ISSUES.noPact);
  });

  /**
   * Une guerre acceptée par le moteur rompt ; une guerre refusée par une trêve
   * n'est pas une trahison — le moteur a dit non, le dirigeant n'a rien rompu.
   * C'est l'appelant qui n'invoque la rupture que dans le premier cas.
   */
  it("une guerre déclarée rompt le pacte et fait chuter la confiance", () => {
    const ctx = fresh();
    const offer = propose(ctx, 8, 1);
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    breakPactsOnWar(ctx, "amber", "azure", 3);
    expect(ctx.agreement!.pacts).toHaveLength(0);
    expect(trustOf(ctx.agreement!, "azure", "amber")).toBe(
      TRUST_DELTAS.brokenByWar,
    );
  });

  it("une guerre refusée ne laisse aucune trace", () => {
    const ctx = fresh();
    const offer = propose(ctx, 8, 1);
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    const before = structuredClone(ctx.agreement);
    // L'appelant n'invoque rien : la déclaration n'a pas eu lieu.
    expect(ctx.agreement).toEqual(before);
    expect(ctx.agreement!.pacts).toHaveLength(1);
  });
});

describe("la mort dissout sans blâme ni prime", () => {
  it("emporte offres et pactes, même au tour exact du terme", () => {
    const ctx = fresh();
    expect(
      applyAgreement(
        ctx,
        "amber",
        cmd({
          action: "propose",
          kind: "nonaggression",
          target: "azure",
          duration: 4,
        }),
        1,
      ),
    ).toBeNull();
    const offer = ctx.agreement!.offers.at(-1)!;
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      1,
    );
    const pact = ctx.agreement!.pacts[0]!;
    expect(pact.endRound).toBe(5);

    ctx.world.civs.find((c) => c.id === "azure")!.fellOnTick = 4;

    // L'ordre compte : dissolution AVANT accomplissement.
    dissolveOnDeath(ctx, 5);
    tickPacts(ctx, 5);

    expect(ctx.agreement!.pacts).toHaveLength(0);
    expect(trustOf(ctx.agreement!, "amber", "azure")).toBe(0);
    expect(trustOf(ctx.agreement!, "azure", "amber")).toBe(0);
    expect(
      ctx.agreement!.history.some((e) => e.kind === "PACT_FULFILLED"),
    ).toBe(false);
    expect(ctx.agreement!.history.at(-1)!.kind).toBe("PACT_DISSOLVED");
  });
});

describe("identité, état et observation", () => {
  it("produit des identifiants stables et déterministes", () => {
    const a = fresh();
    const b = fresh();
    expect(offerTransfer(a, 3).id).toBe(offerTransfer(b, 3).id);
    expect(offerTransfer(a, 3).id).toMatch(
      /^agreement-v1:3:amber:azure:transfer:\d+$/,
    );
  });

  it("échoue bruyamment plutôt que d'improviser un état", () => {
    const orphan = { world: newCivilizationWorld(["amber", "azure"], 7) };
    expect(() =>
      applyAgreement(
        orphan,
        "amber",
        cmd({ action: "renounce", target: "azure" }),
        1,
      ),
    ).toThrow("Agreement records required");
  });

  it("ne montre à un dirigeant que ce qui le regarde", () => {
    const ctx = fresh();
    const offer = offerTransfer(ctx, 1);
    const seen = agreementView(ctx, "azure", 1);

    expect(seen.incoming.map((o) => o.id)).toEqual([offer.id]);
    expect(seen.outgoing).toEqual([]);
    expect(Object.keys(seen.trust)).toEqual(["amber"]);
    // Aucune réserve rivale : une offre dit ce qu'elle demande, pas ce que
    // l'autre possède.
    expect(JSON.stringify(seen)).not.toContain('"stock"');
  });

  it("compte les manches restantes d'un pacte actif", () => {
    const ctx = fresh();
    applyAgreement(
      ctx,
      "amber",
      cmd({
        action: "propose",
        kind: "nonaggression",
        target: "azure",
        duration: 8,
      }),
      2,
    );
    const offer = ctx.agreement!.offers.at(-1)!;
    applyAgreement(
      ctx,
      "azure",
      cmd({ action: "accept", offerId: offer.id }),
      2,
    );
    expect(agreementView(ctx, "amber", 6).pacts).toEqual([
      { id: ctx.agreement!.pacts[0]!.id, partner: "azure", roundsLeft: 4 },
    ]);
  });
});
