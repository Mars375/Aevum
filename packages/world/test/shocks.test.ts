import { describe, expect, it } from "vitest";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
} from "../src/spectator.js";
import { applyShock, shockFor, shockForecast, SHOCKS } from "../src/shocks.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";
import type { FactionId } from "@abs/contracts";

const CIVS: FactionId[] = ["amber", "azure", "crimson", "verdant"];

describe("les chocs régionaux de spectator-12", () => {
  it("se tirent de la graine seule, et frappent une civilisation vivante", () => {
    const seen: string[] = [];
    for (let round = 0; round < 300; round++) {
      const a = shockFor(42, round, CIVS);
      expect(a).toEqual(shockFor(42, round, CIVS));
      if (a) {
        expect(CIVS).toContain(a.target);
        seen.push(a.id);
      }
    }
    // Un par bloc de huit manches, sauf les deux premiers.
    expect(new Set(seen).size).toBeGreaterThan(300 / SHOCKS.block - 4);
    expect(shockFor(42, 5, CIVS)).toBeNull();
    expect(shockFor(42, 40, [])).toBeNull();
  });

  it("sont annoncés avant de commencer", () => {
    for (let round = 16; round < 120; round++) {
      const shock = shockFor(42, round, CIVS);
      if (!shock || shock.start !== round) continue;
      const warned = shockForecast(42, round - 1, CIVS);
      expect(warned?.id).toBe(shock.id);
    }
  });

  it("font payer l'entassement à l'épidémie", () => {
    const outcome = (population: number, capacity: number) => {
      const world = newSpectator(42, "spectator-12").world;
      world.civs[0]!.population = population;
      applyShock(
        world,
        {
          id: "t",
          kind: "epidemic",
          title: "",
          description: "",
          target: world.civs[0]!.id as FactionId,
          start: 20,
          end: 20,
          strength: 0,
        },
        capacity,
      );
      return population - world.civs[0]!.population;
    };
    expect(outcome(400, 400)).toBe(100);
    expect(outcome(200, 400)).toBe(12);
  });

  it("laissent les pillards repartir les mains vides devant assez de soldats", () => {
    const world = newSpectator(42, "spectator-12").world;
    const civ = world.civs[0]!;
    civ.stock = { food: 900, timber: 300, ore: 300, wealth: 600 };
    const raid = {
      id: "r",
      kind: "raid" as const,
      title: "",
      description: "",
      target: civ.id as FactionId,
      start: 20,
      end: 20,
      strength: civ.soldiers + 1,
    };
    expect(applyShock(world, raid, 400)?.kind).toBe("RAIDED");
    expect(civ.stock.food).toBe(600);
    expect(
      applyShock(world, { ...raid, strength: civ.soldiers }, 400)?.kind,
    ).toBe("REPELLED");
    expect(civ.stock.food).toBe(600);
  });

  it("se rejouent à l'identique, et laissent spectator-11 tel qu'il était", () => {
    const play = (rules: "spectator-11" | "spectator-12") => {
      let state = newSpectator(7, rules);
      const campaign: Campaign = {
        version: rules,
        id: `chocs-${rules}`,
        seed: 7,
        mode: "local",
        models: {},
        maxTurns: 300,
        turns: [],
        pending: null,
      };
      const kinds: string[] = [];
      for (let n = 0; n < 320; n++) {
        const civ = activeCiv(state);
        if (!civ) break;
        const decision = localCouncil(state, civ);
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
    };
    const twelve = play("spectator-12");
    expect(replayCampaign(twelve.campaign).state).toEqual(twelve.state);
    expect(
      twelve.kinds.some((k) =>
        ["RAIDED", "REPELLED", "DISASTER", "HARD_YEAR"].includes(k),
      ),
    ).toBe(true);
    const eleven = play("spectator-11");
    expect(eleven.kinds.some((k) => ["RAIDED", "REPELLED"].includes(k))).toBe(
      false,
    );
  });
});
