import { readFileSync, writeFileSync } from "node:fs";
import {
  CampaignSchema,
  replayCampaign,
} from "../packages/world/src/campaign.js";
const id = process.argv[2];
if (!id || !/^[a-z0-9-]{1,80}$/.test(id)) throw Error("Campaign ID required");
const campaign = CampaignSchema.parse(
  JSON.parse(readFileSync(`worlds/spectator/${id}.json`, "utf8")),
);
const { state, outcomes } = replayCampaign(campaign);
const perModel = Object.entries(campaign.models).map(([civ, model]) => {
  const answers = campaign.turns.flatMap((t) =>
    t.answers.filter((a) => a.civ === civ),
  );
  const final = campaign.turns
    .slice(14)
    .flatMap((t) => t.answers.filter((a) => a.civ === civ));
  const decisions = answers.flatMap((a) => (a.decision ? [a.decision] : []));
  return {
    civ,
    model,
    responses: answers.length,
    valid: answers.filter((a) => a.source === "remote").length,
    afterIntegration: {
      responses: final.length,
      valid: final.filter((a) => a.source === "remote").length,
    },
    orders: decisions.flatMap((d) => d.orders).length,
    settlementOrders: decisions
      .flatMap((d) => d.orders)
      .filter((o) => o.action === "settle").length,
    errors: answers.filter((a) => a.error).map((a) => a.error),
  };
});
const rejected = outcomes.flatMap((o) => o.rejected);
const counts: Record<string, number> = {};
for (const r of rejected) counts[r.detail] = (counts[r.detail] ?? 0) + 1;
const report = {
  id,
  turns: campaign.turns.length,
  replayVerified: true,
  perModel,
  rejected: counts,
  cities: state.world.simulation!.cities.length,
  civilizations: state.world.civs.map((c) => ({
    id: c.id,
    population: c.population,
    territory: c.territory,
    soldiers: c.soldiers,
    advances: c.advances,
    alive: c.fellOnTick === null,
  })),
  eventCounts: outcomes
    .flatMap((o) => o.events)
    .reduce(
      (a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a),
      {} as Record<string, number>,
    ),
};
writeFileSync(
  "docs/reports/nous-pilot-analysis.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
