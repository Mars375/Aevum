import { describe, expect, it } from "vitest";
import {
  newSpectator,
  localCouncil,
  resolveCouncil,
  type SpectatorState,
} from "../../world/src/spectator.js";
import {
  replayCampaign,
  stateSignature,
  CampaignSchema,
} from "../../world/src/campaign.js";
import {
  INFRASTRUCTURE,
  queueInfrastructure,
} from "../../world/src/infrastructure.js";
import { neighbours } from "../../world/src/state.js";
import { councilObservation, requestCouncil } from "../src/council.js";
import { councilOptions } from "../src/council-options.js";
import { INFRASTRUCTURE_COUNCIL_JSON_SCHEMA } from "../src/council-schema.js";
import type { FactionId } from "@abs/contracts";

function amberCity(state: SpectatorState) {
  return state.world.simulation!.cities.find((c) => c.owner === "amber")!.id;
}

function fund(state: SpectatorState, civ: "amber" | "azure" = "amber") {
  const ruler = state.world.civs.find((c) => c.id === civ)!;
  ruler.stock = { food: 10000, timber: 10000, ore: 10000, wealth: 10000 };
  ruler.science = 10000;
  return ruler;
}

function farTile(state: SpectatorState) {
  const from = state.world.civs.find((c) => c.id === "amber")!.capital!;
  let best = -1;
  let bestDistance = -1;
  for (let i = 0; i < state.world.board.length; i++) {
    if (state.world.board[i]!.kind === "river") continue;
    const owner = state.world.board[i]!.owner;
    if (owner !== null && owner !== "amber") continue;
    const d =
      Math.abs((i % state.world.size) - (from % state.world.size)) +
      Math.abs(
        Math.floor(i / state.world.size) - Math.floor(from / state.world.size),
      );
    if (d > bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}

function addAmberOutpost(state: SpectatorState) {
  const position = farTile(state);
  for (const i of [position, ...neighbours(state.world.size, position)])
    if (state.world.board[i]!.kind !== "river")
      state.world.board[i]!.owner = "amber";
  const city = "city-outpost";
  state.world.simulation!.cities.push({
    id: city,
    owner: "amber",
    position,
    founded: 0,
    buildings: [],
    queue: null,
  });
  return city;
}

function baseDecision(state: SpectatorState, civ: "amber" | "azure") {
  return {
    civ,
    turn: state.world.tick,
    objective: "Préparer les infrastructures",
    focus: "growth" as const,
    research: null as string | null,
    construction: [],
    diplomacy: [],
    recruitSettler: false,
    orders: [],
  };
}

function recordAnswer(
  i: number,
  civ: FactionId,
  decision: ReturnType<typeof localCouncil>,
  signature: string,
) {
  return {
    turn: i,
    answers: [
      {
        civ,
        decision,
        source: "local" as const,
        model: "local/test",
        service: null,
        error: null,
      },
    ],
    signature,
  };
}

describe("spectator-9 infrastructure engine integration", () => {
  it("advances only the actor's construction and energy, with readable events", () => {
    const state = newSpectator(42, "spectator-9");
    fund(state);
    const azure = fund(state, "azure");
    state.modernization!.amber!.completed = ["mechanization"];
    state.modernization!.azure!.completed = ["mechanization"];
    const city = amberCity(state);
    const azureCityId = state.world.simulation!.cities.find(
      (c) => c.owner === "azure",
    )!.id;
    const azurePollutionBefore =
      state.infrastructure!.pollution[azureCityId] ?? 0;

    const result = resolveCouncil(state, [
      { ...baseDecision(state, "amber"), infrastructure: { city, kind: "foundry" } },
    ]);

    expect(result.rejected).toEqual([]);
    const queue = result.state.infrastructure!.queues.find(
      (q) => q.owner === "amber",
    );
    expect(queue).toBeDefined();
    // Advanced once AFTER development, from the first personal turn.
    expect(queue!.remaining).toBe(INFRASTRUCTURE.foundry.turns - 1);
    expect(
      result.state.infrastructure!.queues.filter((q) => q.owner === "azure"),
    ).toEqual([]);
    expect(result.state.infrastructure!.pollution[azureCityId] ?? 0).toBe(
      azurePollutionBefore,
    );
    expect(azure.stock.ore).toBe(10000);
    expect(
      result.events.some(
        (e) =>
          e.kind === "BUILT" && e.detail.includes("Chantier infrastructure lancé"),
      ),
    ).toBe(true);
    // No site exists yet, so no fabricated energy deficit either.
    expect(
      result.events.some(
        (e) => e.kind === "SHORTAGE" && e.detail.includes("Déficit énergétique"),
      ),
    ).toBe(false);
  });

  it("emits a readable shortage event on a real energy deficit", () => {
    const state = newSpectator(42, "spectator-9");
    fund(state);
    const city = amberCity(state);
    state.infrastructure!.sites.push({ city, kind: "foundry", builtAt: 0 });
    const result = resolveCouncil(state, [baseDecision(state, "amber")]);
    expect(
      result.events.some(
        (e) => e.kind === "SHORTAGE" && e.detail === "Déficit énergétique : 3",
      ),
    ).toBe(true);
  });

  it("refuses infrastructure even at zero cost, without hidden payment", () => {
    const state = newSpectator(42, "spectator-9");
    const civ = fund(state);
    const city = amberCity(state);
    const rule = INFRASTRUCTURE.foundry;
    const saved = { ...rule.cost };
    rule.cost = { ore: 0, wealth: 0 };
    try {
      const ctx = {
        world: state.world,
        modernization: state.modernization,
        infrastructure: state.infrastructure,
      };
      expect(queueInfrastructure(ctx, "amber", "foundry", city)).toBe(
        "Déblocage manquant",
      );
      state.modernization!.amber!.completed = ["mechanization"];
      const before = { ...civ.stock };
      expect(queueInfrastructure(ctx, "amber", "foundry", city)).toBeNull();
      expect(ctx.infrastructure!.queues).toEqual([
        { city, kind: "foundry", remaining: rule.turns, owner: "amber" },
      ]);
      expect(civ.stock.ore).toBe(before.ore);
      expect(civ.stock.wealth).toBe(before.wealth);
    } finally {
      rule.cost = saved;
    }
  });

  it("does not propose infrastructure the budget cannot pay after modernization", () => {
    const state = newSpectator(42, "spectator-9");
    const civ = state.world.civs.find((c) => c.id === "amber")!;
    civ.stock = { food: 10000, timber: 1000, ore: 200, wealth: 500 };
    civ.science = 120;
    civ.advances.push("scholarship");
    state.ages!.amber!.current = "industrial";
    state.modernization!.amber!.completed = ["mechanization"];
    state.world
      .simulation!.cities.find((c) => c.owner === "amber")!
      .buildings.push("academy");
    const before = structuredClone(state);
    const decision = localCouncil(state, "amber");
    expect(state).toEqual(before);
    expect(decision.modernization).toBe("power_grid");
    expect(decision.infrastructure).toBeNull();
    const result = resolveCouncil(state, [decision]);
    expect(
      result.rejected.some((r) => r.detail.includes("Infrastructure")),
    ).toBe(false);
  });

  it("builds power supply only in the deficient component", () => {
    const state = newSpectator(42, "spectator-9");
    fund(state);
    const outpost = addAmberOutpost(state);
    state.modernization!.amber!.completed = ["mechanization", "power_grid"];
    state.infrastructure!.sites.push({
      city: outpost,
      kind: "foundry",
      builtAt: 0,
    });
    const decision = localCouncil(state, "amber");
    expect(decision.infrastructure).toEqual({
      city: outpost,
      kind: "thermal_plant",
    });
  });

  it("does not grant a site's bonus on the turn it completes", () => {
    const mk = () => {
      const state = newSpectator(42, "spectator-9");
      const city = amberCity(state);
      fund(state);
      state.modernization!.amber!.completed = ["clean_energy", "computing"];
      state.infrastructure!.sites.push({
        city,
        kind: "solar_array",
        builtAt: 0,
      });
      return { state, city };
    };
    const queued = mk();
    queued.state.infrastructure!.queues.push({
      city: queued.city,
      kind: "research_center",
      remaining: 1,
      owner: "amber",
    });
    const built = mk();
    built.state.infrastructure!.sites.push({
      city: built.city,
      kind: "research_center",
      builtAt: 0,
    });
    const afterQueued = resolveCouncil(queued.state, [
      baseDecision(queued.state, "amber"),
    ]).state;
    const afterBuilt = resolveCouncil(built.state, [
      baseDecision(built.state, "amber"),
    ]).state;
    const civA = afterQueued.world.civs.find((c) => c.id === "amber")!;
    const civB = afterBuilt.world.civs.find((c) => c.id === "amber")!;
    expect(
      afterQueued.infrastructure!.sites.some(
        (s) => s.kind === "research_center",
      ),
    ).toBe(true);
    // The freshly completed site is already placed, but its powered science
    // bonus only starts on the next personal turn.
    expect((civB.science ?? 0) - (civA.science ?? 0)).toBe(1);
  });

  it("keeps spectator-8 campaigns free of infrastructure", () => {
    const state = newSpectator(42, "spectator-8");
    expect(state.infrastructure).toBeUndefined();
    const result = resolveCouncil(state, [baseDecision(state, "amber")]);
    expect(result.state.infrastructure).toBeUndefined();
    expect(JSON.stringify(result.state)).not.toContain('"infrastructure"');

    let s = newSpectator(42, "spectator-8");
    const turns = [];
    for (let i = 0; i < 3; i++) {
      const actor = s.sequence!.activeCiv;
      const decision = localCouncil(s, actor);
      const outcome = resolveCouncil(s, [decision]);
      turns.push(recordAnswer(i, actor, decision, stateSignature(outcome.state)));
      s = outcome.state;
    }
    const campaign = {
      version: "spectator-8" as const,
      id: "v8-baseline",
      seed: 42,
      mode: "local" as const,
      models: {},
      turns,
      pending: null,
    };
    CampaignSchema.parse(campaign);
    const replay = replayCampaign(campaign);
    expect(replay.state.rules).toBe("spectator-8");
    expect(replay.state.infrastructure).toBeUndefined();
  });

  it("replays a spectator-9 campaign with infrastructure decisions", () => {
    const baseline = newSpectator(42, "spectator-9");
    fund(baseline);
    baseline.modernization!.amber!.completed = ["mechanization"];
    let s = structuredClone(baseline);
    const turns = [];
    for (let i = 0; i < 4; i++) {
      const actor = s.sequence!.activeCiv;
      const decision = localCouncil(s, actor);
      expect(decision.infrastructure).not.toBeUndefined();
      const outcome = resolveCouncil(s, [decision]);
      turns.push(recordAnswer(i, actor, decision, stateSignature(outcome.state)));
      s = outcome.state;
    }
    const campaign = {
      version: "spectator-9" as const,
      id: "v9-replay",
      seed: 42,
      mode: "local" as const,
      models: {},
      turns,
      pending: null,
    };
    CampaignSchema.parse(campaign);
    let replayState = structuredClone(baseline);
    for (const turn of turns) {
      const outcome = resolveCouncil(
        replayState,
        turn.answers.flatMap((a) => (a.decision ? [a.decision] : [])),
      );
      expect(stateSignature(outcome.state)).toBe(turn.signature);
      replayState = outcome.state;
    }
    expect(replayState.infrastructure).toBeDefined();
    expect(stateSignature(replayState)).toBe(stateSignature(s));
  });

  it("exposes a valid infrastructure command through options and provider schema", async () => {
    const state = newSpectator(42, "spectator-9");
    const city = amberCity(state);
    fund(state);
    state.modernization!.amber!.completed = ["mechanization"];

    const options = councilOptions(state, "amber");
    const entry = options.infrastructure!.available.find(
      (o) => o.kind === "foundry" && o.city === city,
    );
    expect(entry).toBeDefined();
    expect(entry!.available).toBe(true);
    expect(entry!.cost).toEqual(INFRASTRUCTURE.foundry.cost);
    expect(entry!.unlock).toBe("mechanization");

    const observation = councilObservation(state, "amber");
    expect(observation.energy).toBeDefined();
    expect(observation.energy!.components.length).toBeGreaterThanOrEqual(1);
    expect(
      observation.infrastructure!.available.some((o) => o.kind === "foundry"),
    ).toBe(true);

    expect(INFRASTRUCTURE_COUNCIL_JSON_SCHEMA.required).toContain(
      "infrastructure",
    );
    expect(
      INFRASTRUCTURE_COUNCIL_JSON_SCHEMA.properties.infrastructure,
    ).toBeDefined();

    let sent:
      | { messages: { role: string; content: string }[] }
      | undefined;
    const answer = await requestCouncil(
      state,
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async (url, init) => {
        if (String(url).endsWith("/models"))
          return Response.json({
            data: [
              {
                id: "test",
                pricing: { prompt: "0", completion: "0" },
                supported_parameters: [],
              },
            ],
          });
        sent = JSON.parse(String(init?.body));
        return Response.json({
          model: "test",
          choices: [
            { message: { content: JSON.stringify(localCouncil(state, "amber")) } },
          ],
        });
      },
    );
    expect(answer.source).toBe("remote");
    const userContent = JSON.parse(
      sent!.messages.find((m) => m.role === "user")!.content,
    ) as {
      responseContract: unknown;
      energy: unknown;
      infrastructure: { available: { kind: string }[] };
    };
    expect(userContent.responseContract).toEqual(
      INFRASTRUCTURE_COUNCIL_JSON_SCHEMA,
    );
    expect(
      userContent.infrastructure.available.some((o) => o.kind === "foundry"),
    ).toBe(true);
    expect(userContent.energy).toBeDefined();
    const systemContent =
      sent!.messages.find((m) => m.role === "system")!.content;
    expect(systemContent).toContain(
      "Only soldier units may defend, attack or escort",
    );
    expect(systemContent).toContain(
      "To leave a civilian idle, omit it from orders; omission preserves its current mission",
    );
    expect(answer.decision!.infrastructure).toBeDefined();
  });
});