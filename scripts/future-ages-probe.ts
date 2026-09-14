import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
} from "../packages/world/src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../packages/world/src/campaign.js";

// Deterministic offline evidence; never calls a model or changes existing campaigns.
const directory = "worlds/spectator";
let archives = 0;
if (existsSync(directory))
  for (const file of readdirSync(directory).filter((f) =>
    f.endsWith(".json"),
  )) {
    const parsed = CampaignSchema.safeParse(
      JSON.parse(readFileSync(`${directory}/${file}`, "utf8")),
    );
    if (parsed.success) {
      replayCampaign(parsed.data);
      archives++;
    }
  }
const rows = [];
for (const seed of [42, 7, 123]) {
  let state = newSpectator(seed, "spectator-6");
  const campaign: Campaign = {
    version: "spectator-6",
    id: `future-ages-local-${seed}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  let rejected = 0;
  for (let i = 0; i < 1100 && (state.sequence?.round ?? 1) <= 300; i++) {
    const civ = activeCiv(state);
    if (!civ) break;
    const decision = localCouncil(state, civ);
    const result = resolveCouncil(state, [decision]);
    rejected += result.rejected.length;
    state = result.state;
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
  replayCampaign(CampaignSchema.parse(campaign));
  rows.push({
    seed,
    actions: state.world.tick,
    round: state.sequence!.round,
    rejected,
    replayVerified: true,
    ages: state.ages,
    modernization: state.modernization,
  });
  const path = `${directory}/${campaign.id}.json`;
  if (process.argv.includes("--write-demo") && seed === 42 && !existsSync(path))
    writeFileSync(path, JSON.stringify(campaign));
}
const evidence = {
  mode: "local",
  remoteCalls: 0,
  archivesVerified: archives,
  rows,
};
writeFileSync(
  "docs/future-ages-verification.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
if (rows.some((r) => r.rejected)) process.exitCode = 1;
