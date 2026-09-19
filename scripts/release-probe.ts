import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { activeCiv, forecastFor, localCouncil, newSpectator, resolveCouncil } from "../packages/world/src/spectator.js";
import { CampaignSchema, replayCampaign, stateSignature, type Campaign } from "../packages/world/src/campaign.js";
import { latestClimateReport } from "../packages/world/src/climate-report.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const directory = "worlds/spectator";
let archives = 0;
for (const file of existsSync(directory) ? readdirSync(directory) : []) {
  if (!file.endsWith(".json")) continue;
  const parsed = CampaignSchema.safeParse(JSON.parse(readFileSync(`${directory}/${file}`, "utf8")));
  if (parsed.success) {
    replayCampaign(parsed.data);
    archives++;
  }
}
const rows = [];
for (const seed of [42, 7, 123]) {
  let state = newSpectator(seed, "spectator-8");
  const history = [state];
  const campaign: Campaign = {
    version: "spectator-8", id: `climate-local-${seed}`, seed,
    mode: "local", models: {}, maxTurns: 300, turns: [], pending: null,
  };
  let rejected = 0;
  while (state.sequence!.round <= 300 && state.world.tick < 1200 &&
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0).length > 1) {
    const civ = activeCiv(state)!;
    const decision = localCouncil(state, civ);
    const result = resolveCouncil(state, [decision]);
    rejected += result.rejected.length;
    state = result.state;
    history.push(state);
    campaign.turns.push({
      turn: decision.turn, signature: stateSignature(state),
      answers: [{ civ, decision, source: "local", model: null, service: null, error: null }],
    });
  }
  replayCampaign(CampaignSchema.parse(campaign));
  rows.push({ seed, actions: state.world.tick, round: state.sequence!.round,
    rejected, replayVerified: true, ages: state.ages,
    lastClimateReport: latestClimateReport(history) });
  const path = `${directory}/${campaign.id}.json`;
  if (process.argv.includes("--write-demo") && seed === 42 && !existsSync(path))
    writeFileSync(path, JSON.stringify(campaign));
}
// Explicit opt-in, at most four provider decisions (bounded correction/retries in gateway).
const remote = [];
if (process.argv.includes("--remote")) {
  loadWindowsNousEnvironment();
  let state = newSpectator(42, "spectator-8");
  while ((forecastFor(42, state.sequence!.round - 1)?.foodMultiplier ?? 1) >= 1 &&
    state.world.tick < 200) {
    state = resolveCouncil(state, [localCouncil(state, activeCiv(state)!)]).state;
  }
  if (!forecastFor(42, state.sequence!.round - 1)) throw new Error("No forecast reached");
  for (let i = 0; i < 4; i++) {
    const civ = activeCiv(state)!;
    const answer = await requestValidatedCouncil(state, civ, "remote", defaultCouncilModels()[civ]!);
    const result = answer.decision ? resolveCouncil(state, [answer.decision]) : null;
    const valid = !!result && !result.rejected.length && answer.source === "remote";
    remote.push({ civ, turn: state.world.tick, forecast: forecastFor(42, state.sequence!.round - 1),
      source: answer.source, service: answer.service, objective: answer.decision?.objective,
      error: answer.error, rejected: result?.rejected, valid });
    if (!valid) break;
    state = result!.state;
  }
}
const evidence = { rules: "spectator-8", archivesVerified: archives, rows, remote,
  valid: rows.every((r) => r.rejected === 0) &&
    (!process.argv.includes("--remote") || (remote.length === 4 && remote.every((r) => r.valid))) };
writeFileSync("docs/release-verification.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ archives, rows: rows.map(({ seed, actions, rejected }) =>
  ({ seed, actions, rejected })), remoteDecisions: remote.length, valid: evidence.valid }));
if (!evidence.valid) process.exitCode = 1;
