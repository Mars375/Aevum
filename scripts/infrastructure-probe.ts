/**
 * infrastructure-probe v9 — bounded verification of localised infrastructure.
 * Derives from scripts/release-probe.ts (v8) without modifying it:
 *  - replays every CampaignSchema-valid saved campaign unchanged,
 *  - simulates spectator-9 locally on seeds 42/7/123 (at most 300 rounds /
 *    1200 actions, stops as soon as <=1 civilisation is alive), saving
 *    answers/signatures and replaying the produced campaign,
 *  - reports actions, rejected orders, sites by kind and by civilisation,
 *    max/current pollution, energy balances, ages and active queues in
 *    docs/infrastructure-verification.json.
 * Zero-rejection is required per seed (rejections are itemised in the report):
 * valid evidence requires every row to replay cleanly with no rejected order
 * and at least one actually built site across seeds, plus exactly one valid
 * remote decision when --remote is requested.
 * --write-demo writes worlds/spectator/infrastructure-local-42.json only if
 * absent, never overwriting. --remote is an explicit opt-in: it warms a local
 * v9 run until localCouncil chooses infrastructure, then makes exactly one
 * requestValidatedCouncil with the default model and records
 * requested/served/source/chosen infrastructure/rejections/valid. No silent
 * local fallback: a null infrastructure choice is reported honestly and no
 * full remote campaign is claimed. Nothing secret is ever printed.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { FactionId } from "@abs/contracts";
import {
  CouncilDecisionSchema,
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
import {
  INFRASTRUCTURE_KINDS,
  energyReport,
  type InfrastructureKind,
} from "../packages/world/src/infrastructure.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const RULES = "spectator-9";
const SEEDS = [42, 7, 123];
const directory = "worlds/spectator";
const emptyKinds = () =>
  Object.fromEntries(INFRASTRUCTURE_KINDS.map((kind) => [kind, 0])) as Record<
    InfrastructureKind,
    number
  >;

interface EnergySummary {
  components: number;
  cities: number;
  supply: number;
  cleanSupply: number;
  thermalSupply: number;
  demand: number;
  fossilUsed: number;
  deficit: number;
}

interface SeedRow {
  seed: number;
  actions: number;
  round: number;
  rejected: number;
  rejectDetails: string[];
  replayVerified: boolean;
  builtSites: number;
  sitesByKind: Record<InfrastructureKind, number>;
  sitesByCiv: Record<string, { total: number; byKind: Record<InfrastructureKind, number> }>;
  pollution: { maxObserved: number; currentMax: number; currentTotal: number; affectedCities: number };
  energy: Record<string, EnergySummary>;
  ages: Record<string, string | null>;
  queues: { city: string; kind: InfrastructureKind; remaining: number; owner: string }[];
}

interface RemoteReport {
  warmed: boolean;
  warmTurn: number | null;
  warmCiv: string | null;
  requested: { city: string; kind: InfrastructureKind } | null;
  turn: number | null;
  civ: string | null;
  served: unknown;
  source: string;
  chosen: { city: string; kind: InfrastructureKind } | null;
  rejections: unknown;
  valid: boolean;
  error: string | null;
}

// 1) Verify that every existing CampaignSchema-valid saved campaign replays.
let archives = 0;
let invalidArchives = 0;
let archiveFailures = 0;
for (const file of existsSync(directory) ? readdirSync(directory) : []) {
  if (!file.endsWith(".json")) continue;
  const parsed = CampaignSchema.safeParse(JSON.parse(readFileSync(`${directory}/${file}`, "utf8")));
  if (!parsed.success) {
    invalidArchives++;
    continue;
  }
  try {
    replayCampaign(parsed.data);
    archives++;
  } catch (error) {
    archiveFailures++;
  }
}

// 2) Local spectator-9 runs on the three seeds, answers/signatures saved.
const rows: SeedRow[] = [];
let builtAcrossSeeds = 0;
for (const seed of SEEDS) {
  let state = newSpectator(seed, RULES);
  let lastRound = 1;
  const campaign: Campaign = {
    version: RULES,
    id: `infrastructure-local-${seed}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  let rejected = 0;
  const rejectDetails: string[] = [];
  let maxObserved = 0;
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0).length;
  while (lastRound <= 300 && state.world.tick < 1200 && alive() > 1) {
    const civ = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, civ));
    const result = resolveCouncil(state, [decision]);
    rejected += result.rejected.length;
    for (const issue of result.rejected)
      rejectDetails.push((issue.unit ?? "Conseil") + ": " + issue.detail);
    state = result.state;
    lastRound = state.sequence?.round ?? lastRound;
    for (const value of Object.values(state.infrastructure?.pollution ?? {}))
      if (value > maxObserved) maxObserved = value;
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [{ civ, decision, source: "local", model: null, service: null, error: null }],
    });
  }
  let replayVerified = true;
  try {
    replayCampaign(CampaignSchema.parse(campaign));
  } catch {
    replayVerified = false;
  }
  const infra = state.infrastructure!;
  const cities = state.world.simulation?.cities ?? [];
  const ownerOf = (cityId: string) => cities.find((c) => c.id === cityId)?.owner ?? null;
  const sitesByKind = emptyKinds();
  const sitesByCiv: Record<string, { total: number; byKind: Record<InfrastructureKind, number> }> =
    {};
  for (const site of infra.sites) {
    sitesByKind[site.kind]++;
    const owner = ownerOf(site.city);
    if (!owner) continue;
    const bucket = (sitesByCiv[owner] ??= { total: 0, byKind: emptyKinds() });
    bucket.total++;
    bucket.byKind[site.kind]++;
  }
  const pollutionValues = Object.values(infra.pollution);
  const energy: Record<string, EnergySummary> = {};
  for (const civ of state.world.civs) {
    const report = energyReport(
      { world: state.world, modernization: state.modernization, infrastructure: infra },
      civ.id,
    );
    const summary: EnergySummary = {
      components: report.components.length,
      cities: report.cities.length,
      supply: 0,
      cleanSupply: 0,
      thermalSupply: 0,
      demand: 0,
      fossilUsed: 0,
      deficit: 0,
    };
    for (const component of report.components) {
      summary.supply += component.supply;
      summary.cleanSupply += component.cleanSupply;
      summary.thermalSupply += component.thermalSupply;
      summary.demand += component.demand;
      summary.fossilUsed += component.fossilUsed;
      summary.deficit += component.deficit;
    }
    energy[civ.id] = summary;
  }
  const ages = Object.fromEntries(
    state.world.civs.map((c) => [c.id, state.ages?.[c.id]?.current ?? null]),
  ) as Record<string, string | null>;
  const queues = infra.queues.map((q) => ({
    city: q.city,
    kind: q.kind,
    remaining: q.remaining,
    owner: q.owner,
  }));
  builtAcrossSeeds += infra.sites.length;
  rows.push({
    seed,
    actions: state.world.tick,
    round: lastRound,
    rejected,
    rejectDetails,
    replayVerified,
    builtSites: infra.sites.length,
    sitesByKind,
    sitesByCiv,
    pollution: {
      maxObserved,
      currentMax: pollutionValues.length ? Math.max(...pollutionValues) : 0,
      currentTotal: pollutionValues.reduce((sum, value) => sum + value, 0),
      affectedCities: pollutionValues.filter((value) => value > 0).length,
    },
    energy,
    ages,
    queues,
  });
  const path = `${directory}/${campaign.id}.json`;
  if (process.argv.includes("--write-demo") && seed === 42 && rejected === 0 && replayVerified && !existsSync(path))
    writeFileSync(path, JSON.stringify(campaign));
}

// 3) Remote opt-in: one requestValidatedCouncil with the default model after
//    a local warm-up that actually reaches an infrastructure choice.
const remote: RemoteReport[] = [];
if (process.argv.includes("--remote")) {
  loadWindowsNousEnvironment();
  let state = newSpectator(42, RULES);
  let lastRound = 1;
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0).length;
  let warmed = false;
  let warmTurn: number | null = null;
  let warmCiv: FactionId | null = null;
  let requested: { city: string; kind: InfrastructureKind } | null = null;
  while (lastRound <= 300 && state.world.tick < 1200 && alive() > 1) {
    const civ = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, civ));
    if (decision.infrastructure) {
      warmed = true;
      warmTurn = state.world.tick;
      warmCiv = civ;
      requested = decision.infrastructure;
      // Freeze the pre-decision state: the local infrastructure candidate stays
      // unexecuted so the remote model decides instead.
      break;
    }
    state = resolveCouncil(state, [decision]).state;
    lastRound = state.sequence?.round ?? lastRound;
  }
  if (!warmed) {
    remote.push({
      warmed: false,
      warmTurn: null,
      warmCiv: null,
      requested: null,
      turn: null,
      civ: null,
      served: null,
      source: "unavailable",
      chosen: null,
      rejections: [],
      valid: false,
      error: "localCouncil never chose infrastructure within bounds",
    });
  } else {
    const civ = warmCiv!;
    if (activeCiv(state) !== civ || state.world.tick !== warmTurn)
      throw new Error(
        "Remote warm-up drift: acting civ or turn moved before the remote request",
      );
    const answer = await requestValidatedCouncil(state, civ, "remote", defaultCouncilModels()[civ]!);
    const result = answer.decision ? resolveCouncil(state, [answer.decision]) : null;
    remote.push({
      warmed: true,
      warmTurn,
      warmCiv,
      requested,
      turn: answer.decision?.turn ?? null,
      civ,
      served: answer.service,
      source: answer.source,
      chosen: answer.decision?.infrastructure ?? null,
      rejections: result?.rejected ?? [],
      valid: !!result && result.rejected.length === 0 && answer.source === "remote",
      error: answer.error,
    });
  }
}

const evidence = {
  checkedAt: new Date().toISOString(),
  rules: RULES,
  archivesVerified: archives,
  invalidArchives,
  archiveFailures,
  rows,
  remote,
  builtAcrossSeeds,
  // Zero rejected orders, clean replayed rows, built sites, remote gate.
  valid:
    archiveFailures === 0 &&
    rows.length === SEEDS.length &&
    rows.every((row) => row.replayVerified && row.rejected === 0) &&
    builtAcrossSeeds > 0 &&
    (!process.argv.includes("--remote") || (remote.length === 1 && remote.every((r) => r.valid))),
};
writeFileSync("docs/infrastructure-verification.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(
  JSON.stringify({
    archives,
    archiveFailures,
    rows: rows.map((row) => ({
      seed: row.seed,
      actions: row.actions,
      rejected: row.rejected,
      replayVerified: row.replayVerified,
      builtSites: row.builtSites,
    })),
    builtAcrossSeeds,
    remote: remote.map((entry) => ({
      warmed: entry.warmed,
      source: entry.source,
      chosen: entry.chosen,
      valid: entry.valid,
    })),
    valid: evidence.valid,
  }),
);
if (!evidence.valid) process.exitCode = 1;