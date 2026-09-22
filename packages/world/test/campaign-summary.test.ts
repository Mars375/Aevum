import { describe, expect, it } from "vitest";
import { CampaignSchema, type Campaign } from "../src/campaign.js";
import { campaignSummary } from "../src/campaign-summary.js";
import { newSpectator } from "../src/spectator.js";
import { startPlan } from "../src/strategic-plans.js";
const campaign: Campaign = {
  version: "spectator-3",
  id: "summary-test",
  seed: 42,
  mode: "local",
  models: {},
  turns: [],
  pending: null,
};
describe("finite campaign reporting", () => {
  it("keeps legacy campaigns unchanged and validates optional limits", () => {
    expect(CampaignSchema.parse(campaign)).not.toHaveProperty("maxTurns");
    for (const maxTurns of [12, 300])
      expect(CampaignSchema.parse({ ...campaign, maxTurns }).maxTurns).toBe(
        maxTurns,
      );
    for (const maxTurns of [11, 301, 12.5])
      expect(CampaignSchema.safeParse({ ...campaign, maxTurns }).success).toBe(
        false,
      );
  });
  it("ends at the requested horizon or at most one surviving civilization", () => {
    const state = newSpectator(42, "spectator-3");
    expect(campaignSummary(campaign, state).finished).toBe(false);
    state.world.tick = 12;
    expect(campaignSummary({ ...campaign, maxTurns: 12 }, state)).toMatchObject(
      { finished: true, reason: "turn-limit", remainingTurns: 0 },
    );
    state.world.civs.slice(1).forEach((civ) => {
      civ.fellOnTick = 12;
      civ.population = 0;
    });
    expect(campaignSummary(campaign, state)).toMatchObject({
      finished: true,
      reason: "last-civilization",
      aliveCount: 1,
      maxTurns: null,
    });
    state.world.civs[0]!.population = 0;
    expect(campaignSummary(campaign, state).aliveCount).toBe(0);
  });
  it("reports independent tied ranks without mutating input", () => {
    const state = newSpectator(42, "spectator-3");
    state.world.civs.forEach((civ) => {
      civ.population = 100;
      civ.advances = [];
    });
    state.world.civs[0]!.population = 200;
    const before = JSON.stringify(state);
    const result = campaignSummary(campaign, state);
    expect(
      result.standings
        .filter((civ) => civ.population === 100)
        .every((civ) => civ.ranks.population === 2),
    ).toBe(true);
    expect(result.standings.every((civ) => civ.ranks.advances === 1)).toBe(
      true,
    );
    expect(JSON.stringify(state)).toBe(before);
    expect(result).not.toHaveProperty("winner");
  });
  it("counts completed historical plans once and ignores snapshots beyond the current year", () => {
    const first = newSpectator(42, "spectator-3");
    first.world.tick = 1;
    first.plans!.amber = {
      ...startPlan(
        {
          kind: "research",
          targetTech: "irrigation",
          targetTile: null,
          targetCity: null,
          targetBuilding: null,
          rationale: "",
        },
        0,
      ),
      status: "completed",
      progress: 1,
    };
    const second = structuredClone(first);
    second.world.tick = 2;
    second.plans!.amber = {
      ...second.plans!.amber!,
      startedAt: 1,
      targetTech: "metallurgy",
    };
    expect(
      campaignSummary(campaign, second, [
        { state: first },
        { state: first },
        { state: second },
      ]).standings.find((civ) => civ.civ === "amber")!.completedPlans,
    ).toBe(2);
    expect(
      campaignSummary(campaign, first, [{ state: second }]).standings.find(
        (civ) => civ.civ === "amber",
      )!.completedPlans,
    ).toBe(1);
    expect(campaignSummary(campaign, second).plansScope).toBe("current-plan");
  });

  /**
   * Le meme seuil recopie en clair : sous « spectator-10 », le bilan comptait
   * `world.tick` — un tour par dirigeant — en l'appelant « manches ». Quatre
   * fois trop, donc une campagne declaree finie bien avant son horizon.
   */
  it("compte des manches, et non des tours, sous la version suivante", () => {
    const state = newSpectator(42, "spectator-10");
    state.sequence!.round = 13;
    state.world.tick = 48;
    const v10 = { ...campaign, version: "spectator-10" as const, maxTurns: 20 };
    expect(campaignSummary(v10, state)).toMatchObject({
      finished: false,
      remainingTurns: 8,
    });
  });
});
