import { describe, expect, it } from "vitest";
import { createSSRApp, h, type Component } from "vue";
import { renderToString } from "@vue/server-renderer";
import type { FactionId } from "@abs/contracts";
import type { PlanBearingState } from "../../../packages/world/src/plan-history";
import type { TrackedPlan } from "../../../packages/world/src/strategic-plans";
import PlanHistory from "../src/components/PlanHistory.vue";

/**
 * Vue échappe les apostrophes droites du texte en `&#39;`. On décode le rendu
 * plutôt que d'écrire l'entité à la main dans chaque attente : le test doit
 * parler du texte que le lecteur voit, pas de son encodage.
 */
const render = async (component: Component, props: Record<string, unknown>) =>
  (await renderToString(createSSRApp({ render: () => h(component, props) })))
    .split("&#39;")
    .join("'");

const civId: FactionId = "amber";

const plan = (over: Partial<TrackedPlan> = {}): TrackedPlan => ({
  kind: "settle",
  targetTile: 42,
  targetCity: null,
  targetTech: null,
  targetBuilding: null,
  rationale: "Fonder à l'ouest, près de la rivière.",
  status: "active",
  progress: 0,
  stagnation: 0,
  startedAt: 3,
  updatedAt: 3,
  detail: "Plan adopté.",
  ...over,
});

const at = (tick: number, current: TrackedPlan): PlanBearingState => ({
  world: { tick },
  sequence: { round: tick },
  plans: { amber: current },
});

describe("PlanHistory : décision, action, conséquence", () => {
  const history = [
    at(3, plan()),
    at(5, plan({ progress: 0.4, detail: "Colons à 1 case(s) de l'objectif." })),
    at(
      7,
      plan({
        progress: 1,
        status: "completed",
        detail: "La ville est fondée sur la case prévue.",
      }),
    ),
  ];

  it("cite le dirigeant et le moteur sans les confondre", async () => {
    const html = await render(PlanHistory, { civId, history, upTo: 2 });
    // Les mots du dirigeant, tels quels.
    expect(html).toContain("Fonder à l'ouest, près de la rivière.");
    // Le constat du moteur, tel quel.
    expect(html).toContain("Colons à 1 case(s) de l'objectif.");
    expect(html).toContain("La ville est fondée sur la case prévue.");
    expect(html).toContain("tenu");
  });

  /**
   * Le lecteur parcourt une campagne : lui montrer la suite d'un plan qu'il
   * n'a pas encore atteinte reviendrait à divulguer la fin.
   */
  it("ne montre pas l'avenir du curseur", async () => {
    const html = await render(PlanHistory, { civId, history, upTo: 1 });
    expect(html).toContain("Colons à 1 case(s) de l'objectif.");
    expect(html).not.toContain("La ville est fondée");
    expect(html).toContain("en cours");
  });

  it("compte ce qui a été tenu", async () => {
    const html = await render(PlanHistory, { civId, history, upTo: 2 });
    expect(html).toContain("1 plan adopté");
    expect(html).toContain("1 tenu");
  });

  it("dit l'absence sans meubler", async () => {
    const html = await render(PlanHistory, { civId, history: [], upTo: 0 });
    expect(html).toContain("Aucun plan adopté");
  });

  it("n'offre aucun moyen de gouverner", async () => {
    const html = await render(PlanHistory, { civId, history, upTo: 2 });
    for (const control of ["<button", "<input", "<select", "<form"])
      expect(html, control).not.toContain(control);
  });

  it("ne montre que la civilisation demandée", async () => {
    const html = await render(PlanHistory, {
      civId,
      history: [
        {
          world: { tick: 3 },
          plans: {
            azure: plan({ rationale: "Secret d'azure.", targetTile: 777 }),
          },
        },
      ],
      upTo: 0,
    });
    expect(html).not.toContain("Secret");
    expect(html).not.toContain("777");
  });
});
