import { describe, it, expect } from "vitest";
import {
  newSpectator,
  localCouncil,
  resolveCouncil,
} from "../src/spectator.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";
describe("city economy rules version", () => {
  it("keeps legacy states untouched and replays the new economy exactly", () => {
    const legacy = resolveCouncil(newSpectator(), []).state;
    expect(legacy.economy).toBeUndefined();
    expect(legacy.caravans).toBeUndefined();
    let state = newSpectator(42, "spectator-2");
    const c: Campaign = {
      id: "economy-test",
      version: "spectator-2",
      seed: 42,
      mode: "local",
      models: {},
      turns: [],
      pending: null,
    };
    for (let i = 0; i < 120; i++) {
      const decisions = state.world.civs
        .filter((c) => c.fellOnTick === null)
        .map((c) => localCouncil(state, c.id));
      const result = resolveCouncil(state, decisions);
      c.turns.push({
        turn: i,
        answers: decisions.map((d) => ({
          civ: d.civ,
          decision: d,
          source: "local",
          model: null,
          service: null,
          error: null,
        })),
        signature: stateSignature(result.state),
      });
      state = result.state;
      expect(
        state.economy?.every((l) =>
          Object.values(l.production).every(
            (x) => Number.isFinite(x) && x >= 0,
          ),
        ),
      ).toBe(true);
    }
    expect(replayCampaign(c).state).toEqual(state);
    expect(
      state.world.civs.filter((c) => c.fellOnTick === null).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
