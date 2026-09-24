import { describe, expect, it } from "vitest";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
} from "../src/spectator.js";
import {
  extendReplay,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";

/** Une partie locale de `turns` tours, jouée par le dirigeant déterministe. */
function play(turns: number, seed = 42): Campaign {
  let state = newSpectator(seed, "spectator-10");
  const campaign: Campaign = {
    version: "spectator-10",
    id: `extend-${seed}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  for (let n = 0; n < turns; n++) {
    const decision = localCouncil(state, activeCiv(state)!);
    state = resolveCouncil(state, [decision]).state;
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ: decision.civ,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }
  return campaign;
}
const prefix = (campaign: Campaign, turns: number): Campaign => ({
  ...campaign,
  turns: campaign.turns.slice(0, turns),
});

describe("rejeu incrémental d'une partie suivie en direct", () => {
  it("donne exactement le rejeu complet", () => {
    const full = play(24);
    const early = prefix(full, 10);
    const extended = extendReplay(
      { campaign: early, replay: replayCampaign(early) },
      full,
    );
    const reference = replayCampaign(full);
    expect(extended.history).toEqual(reference.history);
    expect(extended.outcomes).toEqual(reference.outcomes);
    expect(extended.state).toEqual(reference.state);
  });

  it("ne réutilise pas un rejeu qui n'est pas le début de la partie", () => {
    const other = play(10, 7);
    const full = play(12);
    const extended = extendReplay(
      {
        campaign: { ...other, id: full.id, seed: full.seed },
        replay: replayCampaign(other),
      },
      full,
    );
    expect(extended.state).toEqual(replayCampaign(full).state);
  });

  it("vérifie les tours ajoutés comme les autres (W4)", () => {
    const full = play(12);
    const early = prefix(full, 6);
    const forged = structuredClone(full);
    forged.turns[9]!.signature = "falsifiée";
    expect(() =>
      extendReplay({ campaign: early, replay: replayCampaign(early) }, forged),
    ).toThrow(/tour/);
  });
});
