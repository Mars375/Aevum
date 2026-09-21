import { describe, expect, it } from "vitest";
import { createSSRApp, h, type Component } from "vue";
import { renderToString } from "@vue/server-renderer";
import type { FactionId } from "@abs/contracts";
import { newSpectator } from "../../../packages/world/src/spectator";
import {
  emptyAgreement,
  type AgreementState,
} from "../../../packages/world/src/agreements";
import AgreementsPanel from "../src/components/AgreementsPanel.vue";

const render = (component: Component, props: Record<string, unknown>) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

describe("AgreementsPanel (spectator v10)", () => {
  const world = newSpectator(42, "spectator-10").world;
  const civId: FactionId = "amber";

  const offer = (over: Partial<AgreementState["offers"][number]> = {}) => ({
    id: "agreement-v1:3:azure:amber:transfer:1",
    from: "azure" as FactionId,
    to: "amber" as FactionId,
    kind: "transfer" as const,
    duration: null,
    give: { food: 0, timber: 0, ore: 30, wealth: 0 },
    receive: { food: 20, timber: 0, ore: 0, wealth: 0 },
    issuedRound: 3,
    expiresRound: 6,
    ...over,
  });

  it("dit clairement qu'il ne s'est rien promis", async () => {
    const html = await render(AgreementsPanel, {
      civId,
      world,
      agreement: emptyAgreement(),
      round: 1,
    });
    expect(html).toContain("Aucune promesse échangée");
  });

  it("détaille les deux contributions d'un échange reçu", async () => {
    const agreement = { ...emptyAgreement(), offers: [offer()] };
    const html = await render(AgreementsPanel, {
      civId,
      world,
      agreement,
      round: 4,
    });

    expect(html).toContain("Propositions reçues");
    // Un échange a deux côtés, et le panneau doit les montrer tous les deux.
    expect(html).toContain("donne 30 minerai");
    expect(html).toContain("demande 20 nourriture");
    expect(html).toContain("expire à la manche 6");
  });

  it("compte les manches restantes d'un pacte, et qualifie la relation", async () => {
    const agreement: AgreementState = {
      ...emptyAgreement(),
      pacts: [
        {
          id: "pact-1",
          a: "amber",
          b: "verdant",
          startRound: 2,
          endRound: 10,
        },
      ],
      trust: { amber: { verdant: 40, crimson: -50 } },
    };
    const html = await render(AgreementsPanel, {
      civId,
      world,
      agreement,
      round: 6,
    });

    expect(html).toContain("Non-agression avec verdant");
    expect(html).toContain("4 manches restantes");
    expect(html).toContain("bonne");
    expect(html).toContain("abîmée");
  });

  /**
   * Le spectateur regarde une négociation, il n'y participe pas : le choix du
   * projet est « spectateur uniquement », et un bouton ici le trahirait.
   */
  it("n'offre aucun moyen de gouverner", async () => {
    const agreement = { ...emptyAgreement(), offers: [offer()] };
    const html = await render(AgreementsPanel, {
      civId,
      world,
      agreement,
      round: 4,
    });
    for (const control of ["<button", "<input", "<select", "<form"])
      expect(html, control).not.toContain(control);
  });

  it("ne montre à une civilisation que ce qui la concerne", async () => {
    const agreement: AgreementState = {
      ...emptyAgreement(),
      offers: [
        offer(),
        offer({
          id: "agreement-v1:3:verdant:crimson:transfer:2",
          from: "verdant",
          to: "crimson",
          give: { food: 0, timber: 999, ore: 0, wealth: 0 },
        }),
      ],
    };
    const html = await render(AgreementsPanel, {
      civId,
      world,
      agreement,
      round: 4,
    });
    // L'offre entre deux tiers n'apparaît pas.
    expect(html).not.toContain("999");
  });
});
