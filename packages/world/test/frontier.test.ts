import { describe, expect, it } from "vitest";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorRules,
} from "../src/spectator.js";
import { FRONTIER, frontierTarget } from "../src/frontier.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";

// Le dirigeant passif ne donne aucun ordre : c'est ce que font les modèles au
// plafond (deux villes, 387 habitants, des centaines d'actions sans bouger), et
// le dirigeant local, qui fonde et conquiert, n'y arrive jamais.
function play(
  rules: SpectatorRules,
  seed: number,
  actions: number,
  passive = false,
) {
  let state = newSpectator(seed, rules);
  const campaign: Campaign = {
    version: rules,
    id: `frontiere-${rules}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  const kinds: string[] = [];
  for (let n = 0; n < actions; n++) {
    const civ = activeCiv(state);
    if (!civ) break;
    const local = localCouncil(state, civ);
    const decision = passive
      ? {
          ...local,
          orders: [],
          recruitSettler: false,
          diplomacy: [],
          construction: [],
        }
      : local;
    const result = resolveCouncil(state, [decision]);
    state = result.state;
    kinds.push(...result.events.map((e) => e.kind));
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }
  return { state, campaign, kinds };
}

const manhattan = (size: number, a: number, b: number) =>
  Math.abs((a % size) - (b % size)) +
  Math.abs(Math.floor(a / size) - Math.floor(b / size));

describe("les frontières de spectator-13", () => {
  it("prennent une case libre, voisine, à portée d'une ville", () => {
    const { world } = newSpectator(42, "spectator-13");
    const target = frontierTarget(world, "amber")!;
    expect(world.board[target]!.owner).toBeNull();
    const cities = world
      .simulation!.cities.filter((c) => c.owner === "amber")
      .map((c) => c.position);
    expect(
      Math.min(...cities.map((c) => manhattan(world.size, c, target))),
    ).toBeLessThanOrEqual(FRONTIER.radius);
  });

  it("vont d'abord vers la terre qui manque", () => {
    const { world } = newSpectator(42, "spectator-13");
    const owned = new Set(
      world.board.filter((t) => t.owner === "amber").map((t) => t.kind),
    );
    const target = frontierTarget(world, "amber")!;
    const reachableMissing = world.board.some(
      (t, i) =>
        t.owner === null &&
        !owned.has(t.kind) &&
        world.board.some(
          (o, j) => o.owner === "amber" && manhattan(world.size, i, j) === 1,
        ),
    );
    if (reachableMissing)
      expect(owned.has(world.board[target]!.kind)).toBe(false);
  });

  it("font grandir les territoires, et le disent", () => {
    const thirteen = play("spectator-13", 42, 400, true);
    const twelve = play("spectator-12", 42, 400, true);
    const land = (s: typeof thirteen.state) =>
      s.world.board.filter((t) => t.owner !== null).length;
    expect(land(thirteen.state)).toBeGreaterThan(land(twelve.state));
    expect(thirteen.kinds).toContain("EXPANDED");
    expect(twelve.kinds).not.toContain("EXPANDED");
  });

  it("finissent par se toucher, et ne disent la terre pleine qu'une fois", () => {
    const { state, kinds } = play("spectator-13", 42, 700, true);
    const { board, size } = state.world;
    const touching = board.some(
      (t, i) =>
        t.owner !== null &&
        [i + 1, i - 1, i + size, i - size].some(
          (n) =>
            board[n] &&
            board[n]!.owner !== null &&
            board[n]!.owner !== t.owner &&
            Math.abs((n % size) - (i % size)) <= 1,
        ),
    );
    expect(touching).toBe(true);
    expect(kinds.filter((k) => k === "LAND_FULL").length).toBeLessThanOrEqual(
      state.world.civs.length * 2,
    );
  });

  it("se rejouent à l'identique", () => {
    const { campaign, state } = play("spectator-13", 7, 400, true);
    expect(replayCampaign(campaign).state).toEqual(state);
  });
});
