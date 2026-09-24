/**
 * campaign-report — le bilan d'une partie, civilisation par civilisation.
 *
 * Ce que chaque dirigeant a fait, et d'abord **qui** l'a fait : un modèle
 * dont un autre a joué les tours n'a pas gouverné (CLAUDE.md, point 3). La
 * part servie par le modèle lui-même vient donc en tête ; sous 70 %, le
 * dirigeant n'est pas classable.
 *
 * Aucun score composite, aucun vainqueur désigné : des rangs indépendants,
 * comme le bilan de l'observatoire (`campaignSummary`). Une seule partie ne
 * compare pas des modèles — le plateau y pèse autant qu'eux ; elle dit ce qui
 * s'est passé.
 *
 * Usage : npx tsx scripts/campaign-report.ts <id> [--source=worlds/spectator]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CampaignSchema,
  replayCampaign,
} from "../packages/world/src/campaign.js";
import { campaignSummary } from "../packages/world/src/campaign-summary.js";

const id = process.argv[2];
if (!id || id.startsWith("--")) throw new Error("Usage : campaign-report <id>");
const source =
  process.argv.find((a) => a.startsWith("--source="))?.slice(9) ??
  "worlds/spectator";
const campaign = CampaignSchema.parse(
  JSON.parse(readFileSync(resolve(source, `${id}.json`), "utf8")),
);
const { state, outcomes } = replayCampaign(campaign);
const summary = campaignSummary(campaign, state, outcomes);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : null;
};

const civs = state.world.civs.map((civ) => {
  const answers = campaign.turns.flatMap((turn, i) =>
    turn.answers
      .filter((a) => a.civ === civ.id)
      .map((a) => ({
        ...a,
        rejected: outcomes[i]!.rejected.filter((r) => r.civ === civ.id).length,
      })),
  );
  const service = answers.map(
    (a) =>
      a.service as {
        servedByFallback?: boolean;
        latencyMs?: number;
        attempts?: number;
      } | null,
  );
  const servedItself = answers.filter(
    (a, i) => a.source === "remote" && service[i]?.servedByFallback === false,
  ).length;
  const share = answers.length ? servedItself / answers.length : 0;
  const decisions = answers.flatMap((a) => (a.decision ? [a.decision] : []));
  const focus = new Map<string, number>();
  for (const d of decisions) focus.set(d.focus, (focus.get(d.focus) ?? 0) + 1);
  const proposals = new Map<string, number>();
  for (const d of decisions)
    for (const p of d.diplomacy ?? [])
      proposals.set(p.proposal, (proposals.get(p.proposal) ?? 0) + 1);
  const standing = summary.standings.find((s) => s.civ === civ.id)!;
  return {
    civ: civ.id,
    model: campaign.models[civ.id] ?? null,
    turns: answers.length,
    servedByModelItself: servedItself,
    servedShare: Number(share.toFixed(3)),
    rankable: share >= 0.7,
    rejectedOrders: answers.reduce((sum, a) => sum + a.rejected, 0),
    turnsWithoutRejection: answers.filter((a) => a.rejected === 0).length,
    medianLatencyMs: median(
      service.flatMap((s) =>
        typeof s?.latencyMs === "number" ? [s.latencyMs] : [],
      ),
    ),
    age: state.ages?.[civ.id]?.current ?? null,
    alive: standing.alive,
    population: standing.population,
    cities: standing.cities,
    territory: state.world.board.filter((p) => p.owner === civ.id).length,
    advances: standing.advances,
    completedPlans: standing.completedPlans,
    ranks: standing.ranks,
    settlersRecruited: decisions.filter((d) => d.recruitSettler).length,
    focus: Object.fromEntries(focus),
    diplomacyProposals: Object.fromEntries(proposals),
  };
});

const events = new Map<string, number>();
for (const o of outcomes)
  for (const e of o.events) events.set(e.kind, (events.get(e.kind) ?? 0) + 1);
const report = {
  checkedAt: new Date().toISOString(),
  campaign: id,
  rules: campaign.version,
  seed: campaign.seed,
  actions: campaign.turns.length,
  rounds: summary.turns,
  finished: summary.finished,
  reason: summary.reason,
  replayVerified: true,
  freeLand: state.world.board.filter(
    (p) => p.owner === null && p.kind !== "river",
  ).length,
  board: state.world.board.length,
  events: Object.fromEntries(
    [
      "FOUNDED",
      "BUILT",
      "ADVANCE",
      "WAR",
      "PEACE",
      "PACT",
      "PACT_FULFILLED",
      "PACT_BROKEN",
      "TRANSFER",
      "SEIZED",
      "ROUTED",
      "STARVED",
    ].map((k) => [k, events.get(k) ?? 0]),
  ),
  civilizations: civs,
  method: summary.rankingMethod,
};
const out = `docs/reports/${id}-bilan.json`;
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${id} : ${report.actions} actions, ${report.rounds} manches, ${report.finished ? "terminée" : "en cours"} ; rejeu vérifié ; ${report.freeLand}/${report.board} cases libres`,
);
for (const c of civs)
  console.log(
    `  ${c.civ.padEnd(8)} ${String(c.model).slice(0, 44).padEnd(44)} servi ${c.servedByModelItself}/${c.turns}${c.rankable ? "" : " (non classable)"} · rejets ${c.rejectedOrders} · ${c.age} · pop ${c.population} · villes ${c.cities} · cases ${c.territory} · avancées ${c.advances} · plans ${c.completedPlans} · colons ${c.settlersRecruited}`,
  );
console.log(`rapport : ${out}`);
