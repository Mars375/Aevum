import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { newSpectator, localCouncil, resolveCouncil } from "../packages/world/src/spectator.js";
import { replayCampaign, stateSignature, type Campaign } from "../packages/world/src/campaign.js";

const rows = [];
for (const seed of [42, 7, 123]) {
  let state = newSpectator(seed, "spectator-3");
  const campaign: Campaign = { version: "spectator-3", id: randomUUID(), seed, mode: "local", models: {}, turns: [], pending: null };
  const completed = new Set<string>();
  let deliveries = 0;
  for (let turn = 0; turn < 120; turn++) {
    const decisions = state.world.civs.filter(c => c.fellOnTick === null).map(c => localCouncil(state, c.id));
    state = resolveCouncil(state, decisions).state;
    for (const [civ, plan] of Object.entries(state.plans ?? {}))
      if (plan.status === "completed") completed.add(`${civ}/${plan.startedAt}/${plan.kind}/${plan.targetCity}/${plan.targetTile}/${plan.targetTech}/${plan.targetBuilding}`);
    deliveries += (state.economy ?? []).reduce((sum, ledger) => sum + ledger.deliveries.length, 0);
    campaign.turns.push({ turn, signature: stateSignature(state), answers: decisions.map(decision => ({ civ: decision.civ, decision, source: "local", model: "local/deterministic-council-v3", service: null, error: null })) });
  }
  const replayed = replayCampaign(campaign);
  if (stateSignature(replayed.state) !== stateSignature(state)) throw new Error("Replay mismatch");
  rows.push({ seed, id: campaign.id, turns: 120, cities: state.world.simulation!.cities.length, deliveries, completedPlans: completed.size, replay: true });
  if (seed === 42) writeFileSync(`worlds/spectator/${campaign.id}.json`, JSON.stringify(campaign));
}
const legacy = [];
for (const id of ["67dadf23-8575-4425-afd2-b8b9999a060a", "df93b5b6-4b1f-4892-af96-3d16a1984de1", "fc120553-4a15-40c9-84a7-229e3bc0ad14"]) {
  const saved = JSON.parse(readFileSync(`worlds/spectator/${id}.json`, "utf8"));
  const result = replayCampaign(saved);
  legacy.push({ id, version: saved.version, turn: result.state.world.tick, replay: true });
}
writeFileSync("docs/reports/strategic-probe.json", JSON.stringify({ rows, legacy }, null, 2));
console.log(JSON.stringify({ rows, legacy }, null, 2));
