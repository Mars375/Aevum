import { describe, expect, it } from "vitest";
import { createSSRApp, h, type Component } from "vue";
import { renderToString } from "@vue/server-renderer";
import type { FactionId } from "@abs/contracts";
import { newSpectator } from "../../../packages/world/src/spectator";
import type { InfrastructureState } from "../../../packages/world/src/infrastructure";
import InfrastructurePanel from "../src/components/InfrastructurePanel.vue";

const render = (component: Component, props: Record<string, unknown>) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

describe("InfrastructurePanel (spectator v9)", () => {
  const state = newSpectator(42, "spectator-8");
  const world = state.world;
  const civId: FactionId = "amber";
  const city = world.simulation!.cities.find((c) => c.owner === civId)!;
  const cityName = world.board[city.position]!.name;

  it("renders an empty state explaining the national modernization unlock", async () => {
    const html = await render(InfrastructurePanel, {
      civId,
      world,
      infrastructure: null,
    });

    expect(html).toContain("Aucune infrastructure avancée");
    expect(html).toContain("modernisation");
    expect(html).not.toContain("Chantier en cours");
  });

  it("lists city sites by board name with pollution, food penalty and science bonus", async () => {
    const infrastructure: InfrastructureState = {
      sites: [
        { city: city.id, kind: "solar_array", builtAt: 5 },
        { city: city.id, kind: "research_center", builtAt: 12 },
      ],
      queues: [],
      pollution: { [city.id]: 80 },
    };
    const html = await render(InfrastructurePanel, {
      civId,
      world,
      infrastructure,
    });

    expect(html).toContain(cityName);
    expect(html).toContain("Parc solaire");
    expect(html).toContain("Centre de recherche");
    expect(html).toContain("80 / 80");
    expect(html).toContain("−25 %");
    expect(html).toContain("Bonus science");
    expect(html).toContain("+1 / tour personnel");
  });

  it("reports the remaining personal turns of the national construction", async () => {
    const infrastructure: InfrastructureState = {
      sites: [],
      queues: [
        { city: city.id, kind: "automated_factory", remaining: 7, owner: civId },
      ],
      pollution: {},
    };
    const html = await render(InfrastructurePanel, {
      civId,
      world,
      infrastructure,
    });

    expect(html).toContain("Usine automatisée");
    expect(html).toContain("7 tours personnels restants");
  });


  it("rounds fractional pollution and science to one decimal, never raw", async () => {
    const infrastructure: InfrastructureState = {
      sites: [
        { city: city.id, kind: "solar_array", builtAt: 3 },
        { city: city.id, kind: "research_center", builtAt: 6 },
        { city: city.id, kind: "automated_factory", builtAt: 9 },
      ],
      queues: [],
      pollution: { [city.id]: 17.237 },
    };
    const html = await render(InfrastructurePanel, {
      civId,
      world,
      infrastructure,
    });

    expect(html).toContain("17.2 / 80");
    expect(html).not.toContain("17.237");
    expect(html).toContain("+0.6 / tour personnel");
  });
});