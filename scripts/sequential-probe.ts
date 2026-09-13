import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import {
  newSpectator,
  localCouncil,
  resolveCouncil,
  activeCiv,
} from "../packages/world/src/spectator.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../packages/world/src/campaign.js";
import { campaignSummary } from "../packages/world/src/campaign-summary.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const remote = process.argv.includes("--remote");
if (remote) loadWindowsNousEnvironment();
const rows = [];
for (const seed of remote ? [42] : [42, 7, 123]) {
  let state = newSpectator(seed, "spectator-4");
  const campaign: Campaign = {
    version: "spectator-4",
    id: remote ? "sequential-nous-pilot" : `sequential-local-${seed}`,
    seed,
    mode: remote ? "remote" : "local",
    models: remote ? defaultCouncilModels() : {},
    maxTurns: 40,
    turns: [],
    pending: null,
  };
  let delivered = 0,
    rejected = 0;
  const outcomes = [];
  for (let action = 0; action < (remote ? 4 : 160); action++) {
    if (campaignSummary(campaign, state).finished) break;
    const civ = activeCiv(state)!;
    const answer = remote
      ? await requestValidatedCouncil(
          state,
          civ,
          "remote",
          campaign.models[civ]!,
        )
      : {
          civ,
          decision: localCouncil(state, civ),
          source: "local" as const,
          model: "local/deterministic-council-v4",
          service: null,
          error: null,
        };
    if (!answer.decision) {
      console.log(JSON.stringify({ civ, unavailable: answer.error }));
      break;
    }
    const result = resolveCouncil(state, [answer.decision]);
    state = result.state;
    outcomes.push(result);
    rejected += result.rejected.length;
    delivered += (state.economy ?? [])
      .filter((l) =>
        state.world.simulation!.cities.some(
          (c) => c.id === l.city && c.owner === civ,
        ),
      )
      .reduce((n, l) => n + l.deliveries.length, 0);
    campaign.turns.push({
      turn: action,
      answers: [answer],
      signature: stateSignature(state),
    });
    if (remote)
      console.log(
        JSON.stringify({
          action,
          civ,
          source: answer.source,
          orders: answer.decision.orders.length,
          rejected: result.rejected.length,
        }),
      );
  }
  const restored = replayCampaign(campaign);
  if (stateSignature(restored.state) !== stateSignature(state))
    throw new Error("Replay mismatch");
  const summary = campaignSummary(campaign, state, outcomes);
  rows.push({
    id: campaign.id,
    seed,
    actions: state.world.tick,
    completedRounds: summary.turns,
    alive: summary.aliveCount,
    cities: state.world.simulation!.cities.length,
    delivered,
    rejected,
    replay: true,
  });
  if (seed === 42)
    writeFileSync(
      `worlds/spectator/${campaign.id}.json`,
      JSON.stringify(campaign),
    );
}
const legacy = [];
if (!remote)
  for (const file of readdirSync("worlds/spectator").filter((f) =>
    f.endsWith(".json"),
  )) {
    const campaign = JSON.parse(
      readFileSync(`worlds/spectator/${file}`, "utf8"),
    );
    if (campaign.version === "spectator-4") continue;
    const result = replayCampaign(campaign);
    legacy.push({
      id: campaign.id,
      version: campaign.version,
      actions: result.state.world.tick,
    });
  }
writeFileSync(
  `docs/sequential-${remote ? "remote" : "local"}-verification.json`,
  JSON.stringify({ rows, legacy }, null, 2),
);
console.log(JSON.stringify({ rows, legacy }, null, 2));
