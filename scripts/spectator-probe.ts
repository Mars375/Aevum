import {
  newSpectator,
  localCouncil,
  resolveCouncil,
  SpectatorStateSchema,
} from "../packages/world/src/spectator.js";
import {
  stateSignature,
  replayCampaign,
  type Campaign,
} from "../packages/world/src/campaign.js";
import { atomicWrite } from "./world-storage.js";
import { resolve } from "node:path";
const rows = [];
for (const seed of [42, 7, 12, 21, 33, 56, 77, 99, 123, 256, 512, 1024]) {
  let state = newSpectator(seed);
  const journal: Campaign = {
    version: "spectator-1",
    id: `probe-${seed}`,
    seed,
    mode: "local",
    models: {},
    turns: [],
    pending: null,
  };
  let combats = 0,
    foundations = 0,
    weather = 0,
    rejections = 0;
  const rejectionTypes: Record<string, number> = {};
  for (let turn = 0; turn < 300; turn++) {
    const decisions = state.world.civs
      .filter((c) => c.fellOnTick === null)
      .map((c) => localCouncil(state, c.id));
    const result = resolveCouncil(state, decisions);
    state = result.state;
    SpectatorStateSchema.parse(state);
    combats += result.events.filter((e) => e.kind === "ROUTED").length;
    foundations += result.events.filter((e) => e.kind === "FOUNDED").length;
    weather += result.incident ? 1 : 0;
    rejections += result.rejected.length;
    for (const r of result.rejected)
      rejectionTypes[r.detail] = (rejectionTypes[r.detail] ?? 0) + 1;
    journal.turns.push({
      turn,
      answers: decisions.map((d) => ({
        civ: d.civ,
        decision: d,
        source: "local",
        model: "local/deterministic-council-v1",
        service: null,
        error: null,
      })),
      signature: stateSignature(state),
    });
  }
  if (
    stateSignature(
      replayCampaign(JSON.parse(JSON.stringify(journal))).state,
    ) !== stateSignature(state)
  )
    throw new Error(`Rejeu divergent : ${seed}`);
  rows.push({
    seed,
    turns: 300,
    alive: state.world.civs.filter((c) => c.fellOnTick === null).length,
    cities: state.world.simulation!.cities.length,
    combats,
    foundations,
    weather,
    rejections,
    replay: "verified",
    rejectionTypes,
  });
}
atomicWrite(
  resolve("docs/reports/spectator-probe.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
console.table(rows);
