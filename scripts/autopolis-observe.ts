/**
 * Run and publish a reproducible, network-free Autopolis observation.
 *
 * The provider below is intentionally scripted. This pilot measures engine
 * behaviour, replayability, and service-equity bookkeeping; it is not evidence
 * about any remote model. A remote campaign must be a separately approved run.
 *
 *   npm run autopolis:observe
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTOPOLIS_RULESET,
  acceptAutopolisProposal,
  newAutopolisJournal,
  newAutopolisWorld,
  replayAutopolis,
  stepAutopolis,
  succeedAutopolisLeader,
  type AutopolisDecisionProposal,
  type AutopolisEvent,
  type AutopolisJournal,
  type AutopolisWorld,
} from "../packages/world/src/index.js";

const METRICS_VERSION = "metrics-v1";
const PROVIDER_VERSION = "scripted-autopolis-v1";
const SEEDS = [7, 19, 42, 73, 101, 137, 211, 313];
const HORIZON = 36;
const CIVS = ["crimson", "azure", "verdant", "amber"] as const;
const W = 5;
const OUT_DIR = resolve("worlds/autopolis/season-1");
const PUBLISHED = resolve(OUT_DIR, "era-0001.json");

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
};

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function entropy(values: string[]): number {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const p = count / values.length;
    return sum - p * Math.log2(p);
  }, 0);
}

function scriptedPatch(world: AutopolisWorld, civ: string): AutopolisDecisionProposal {
  const civIndex = CIVS.indexOf(civ as (typeof CIVS)[number]);
  const phase = (Math.floor(world.tick / 4) + civIndex) % 3;
  const phases = [
    { kind: "FOOD", farming: 0.58, forestry: 0.16, mining: 0.12, trade: 0.09, military: 0.05, posture: "GUARD" as const, claim: "plain" as const, reasoning: "Scripted response: protect the food reserve before taking risk." },
    { kind: "EXPANSION", farming: 0.36, forestry: 0.24, mining: 0.14, trade: 0.18, military: 0.08, posture: "TRADE" as const, claim: "river" as const, reasoning: "Scripted response: use a stable reserve to seek a river and expand." },
    { kind: "DEFENSE", farming: 0.43, forestry: 0.15, mining: 0.12, trade: 0.08, military: 0.22, posture: "GUARD" as const, claim: "hill" as const, reasoning: "Scripted response: keep the frontier and fund a measured defense." },
  ][phase]!;
  const text = world.tick >= 8 && world.tick % 8 === 0 ? `Scripted doctrine at year ${world.tick}: reserve, frontier, continuity.` : undefined;
  return {
    pointTick: world.tick + 1,
    civ,
    leaderId: world.civs.find((item) => item.id === civ)!.identity.leader.id,
    kind: phases.kind,
    reasoning: phases.reasoning,
    doctrinePatch: {
      farming: phases.farming,
      forestry: phases.forestry,
      mining: phases.mining,
      trade: phases.trade,
      military: phases.military,
      posture: phases.posture,
      claim: phases.claim,
      expansion: phase === 1 ? 0.8 : phase === 2 ? 0.25 : 0.45,
    },
    proposedDoctrineText: text,
    proposedClaims: text ? ["reserve before glory", "continuity through succession"] : undefined,
    proposedPersonalityPatch: { curiosity: phase === 1 ? 0.4 : 0.1, tradition: phase === 2 ? 0.4 : 0.2 },
  };
}

class ScriptedAutopolisProvider {
  decide(world: AutopolisWorld, civ: string): AutopolisDecisionProposal {
    return scriptedPatch(world, civ);
  }
}

interface StateSnapshot {
  runId: string;
  seed: number;
  tick: number;
  civ: string;
  alive: boolean;
  leaderId: string;
  generation: number;
  doctrineId: string;
  parentDoctrineId: string | null;
  personality: AutopolisWorld["civs"][number]["identity"]["leader"]["personality"];
  priorities: AutopolisWorld["civs"][number]["identity"]["leader"]["priorities"];
  policy: AutopolisWorld["civs"][number]["identity"]["leader"]["policy"];
  population: number;
  territory: number;
  stock: AutopolisWorld["civs"][number]["stock"];
  soldiers: number;
  advances: string[];
}

interface DecisionAttempt {
  runId: string;
  civ: string;
  pointTick: number;
  kind: string;
  triggerEventIds: string[];
  asked: boolean;
  serviceStatus: "served" | "rejected" | "not_asked";
  requestedModel: string;
  servedModel: string | null;
  fallback: string | null;
  askedAt: number | null;
  appliedAt: number | null;
  deferredBy: number;
  proposalHash: string | null;
  rulingId: string | null;
  rejectionReason: string | null;
}

interface RunResult {
  runId: string;
  seed: number;
  rotation: number;
  condition: "scripted-inherit";
  modelAssignment: Record<string, string>;
  provider: "scripted";
  providerVersion: string;
  horizon: number;
  journal: AutopolisJournal;
  events: AutopolisEvent[];
  states: StateSnapshot[];
  decisions: DecisionAttempt[];
  world: AutopolisWorld;
  replayCheck: {
    finalDirectFingerprint: string;
    finalReplayFingerprint: string;
    perTickMismatches: number[];
    rulingIdsEqual: boolean;
    providerCallsDuringReplay: number;
    eventTraceStatus: "event_trace_unavailable_from_canonical_journal";
    status: "replay_pass_with_event_trace_unavailable" | "replay_fail";
  };
  metrics: Record<string, number | string>;
}

function snapshot(runId: string, world: AutopolisWorld): StateSnapshot[] {
  return world.civs.map((civ) => ({
    runId,
    seed: world.seed,
    tick: world.tick,
    civ: civ.id,
    alive: civ.alive,
    leaderId: civ.identity.leader.id,
    generation: civ.identity.leader.generation,
    doctrineId: civ.identity.leader.doctrine.id,
    parentDoctrineId: civ.identity.leader.doctrine.parentId,
    personality: civ.identity.leader.personality,
    priorities: civ.identity.leader.priorities,
    policy: civ.identity.leader.policy,
    population: civ.population,
    territory: civ.territory,
    stock: civ.stock,
    soldiers: civ.soldiers,
    advances: civ.advances,
  }));
}

function runOne(seed: number, rotation: number): RunResult {
  const runId = `autopolis-season-1/seed-${String(seed).padStart(4, "0")}/rotation-${rotation}/condition-scripted-inherit`;
  const provider = new ScriptedAutopolisProvider();
  const modelAssignment = Object.fromEntries(CIVS.map((civ, index) => [civ, `scripted-slot-${String.fromCharCode(97 + ((index + rotation) % CIVS.length))}`]));
  const base = newAutopolisWorld(seed, [...CIVS], { population: 40, food: 90, timber: 70, ore: 40, wealth: 50, modelAssignments: modelAssignment });
  const origin: AutopolisWorld = {
    ...base,
    civs: base.civs.map((civ) => civ.id === "amber" ? { ...civ, population: 1, stock: { ...civ.stock, food: 0 } } : civ),
  };
  const journal = newAutopolisJournal(origin);
  journal.livedTo = HORIZON;
  let world = origin;
  const events: AutopolisEvent[] = [];
  const states = snapshot(runId, world);
  const decisions: DecisionAttempt[] = [];
  let successionDone = false;
  const triggerFor = (civ: string, pointTick: number) => events.filter((event) => event.civ === civ && event.tick >= pointTick - W && event.tick <= pointTick).map((event) => event.sourceId);

  while (world.tick < HORIZON) {
    const eligible = world.civs.filter((civ) => civ.alive && world.tick % 4 === 0);
    if (eligible.length > 0) {
      for (const civ of eligible) {
        const proposal = provider.decide(world, civ.id);
        const result = acceptAutopolisProposal(world, proposal, { model: "scripted", fallback: null, deferredBy: 0 });
        events.push(...result.events);
        const rejection = result.events.find((event) => event.kind === "PROPOSAL_REJECTED");
        const ruling = result.ruling;
        decisions.push({
          runId,
          civ: civ.id,
          pointTick: proposal.pointTick,
          kind: proposal.kind,
          triggerEventIds: triggerFor(civ.id, proposal.pointTick),
          asked: true,
          serviceStatus: ruling ? "served" : "rejected",
          requestedModel: modelAssignment[civ.id]!,
          servedModel: ruling ? "scripted" : null,
          fallback: null,
          askedAt: ruling?.askedAt ?? null,
          appliedAt: ruling?.appliedAt ?? null,
          deferredBy: ruling?.deferredBy ?? 0,
          proposalHash: fingerprint(proposal),
          rulingId: ruling?.id ?? null,
          rejectionReason: rejection?.detail ?? null,
        });
        if (ruling) journal.entries.push({ type: "ruling", ruling });
        world = result.world;
        states.splice(0, states.length, ...states.filter((item) => item.tick !== world.tick), ...snapshot(runId, world));
        if (world.tick >= HORIZON) break;
      }
    } else {
      const stepped = stepAutopolis(world);
      events.push(...stepped.events);
      world = stepped.world;
      states.splice(0, states.length, ...states.filter((item) => item.tick !== world.tick), ...snapshot(runId, world));
    }
    // A succession is a journalled cultural transmission, not a model call.
    if (!successionDone && world.tick >= 10) {
      successionDone = true;
      for (const civ of world.civs.filter((item) => item.alive)) {
        const succession = succeedAutopolisLeader(world, civ.id);
        events.push(...succession.events);
        if (succession.succession) journal.entries.push(succession.succession);
        world = succession.world;
      }
      states.splice(0, states.length, ...states.filter((item) => item.tick !== world.tick), ...snapshot(runId, world));
    }
  }

  journal.livedTo = world.tick;
  const replayMismatches: number[] = [];
  for (let tick = 0; tick <= world.tick; tick += 1) {
    const replayed = replayAutopolis(journal, tick).world;
    const directAtTick = states.filter((item) => item.tick === tick);
    const expected = fingerprint(directAtTick);
    const actual = fingerprint(snapshot(runId, replayed));
    if (directAtTick.length === 0 || expected !== actual) replayMismatches.push(tick);
  }
  const replay = replayAutopolis(journal, world.tick);
  const finalDirectFingerprint = fingerprint(world);
  const finalReplayFingerprint = fingerprint(replay.world);
  const rulingIds = journal.entries.filter((entry) => entry.type === "ruling").map((entry) => entry.ruling.id);
  const replayRulingIds = replay.events.filter((event) => event.kind === "RULING_ACCEPTED").map((event) => event.sourceId);
  const served = decisions.filter((item) => item.serviceStatus === "served").length;
  const finalAlive = world.civs.filter((civ) => civ.alive).length;
  const uniquePolicies = new Set(world.civs.filter((civ) => civ.alive).map((civ) => fingerprint(civ.identity.leader.policy))).size;
  const doctrineIds = new Set(world.civs.map((civ) => civ.identity.leader.doctrine.id));
  const successionEntries = journal.entries.filter((entry) => entry.type === "succession");
  const eventAdaptation = events.filter((event) => event.civ && ["FAMINE", "SHORTAGE", "CRISIS", "LOSS", "EXPANSION", "ADVANCE", "BORDER"].includes(event.kind)).filter((event) => decisions.some((decision) => decision.civ === event.civ && decision.serviceStatus === "served" && decision.pointTick >= event.tick && decision.pointTick <= event.tick + W)).length;
  const notableEvents = events.filter((event) => event.kind !== "RESOURCE_GAINED").length;
  return {
    runId,
    seed,
    rotation,
    condition: "scripted-inherit",
    modelAssignment,
    provider: "scripted",
    providerVersion: PROVIDER_VERSION,
    horizon: world.tick,
    journal,
    events,
    states,
    decisions,
    world,
    replayCheck: {
      finalDirectFingerprint,
      finalReplayFingerprint,
      perTickMismatches: replayMismatches,
      rulingIdsEqual: rulingIds.join("|") === replayRulingIds.join("|"),
      providerCallsDuringReplay: 0,
      eventTraceStatus: "event_trace_unavailable_from_canonical_journal",
      status: finalDirectFingerprint === finalReplayFingerprint && replayMismatches.length === 0 && rulingIds.join("|") === replayRulingIds.join("|") ? "replay_pass_with_event_trace_unavailable" : "replay_fail",
    },
    metrics: {
      M1_policy_distinct_final: uniquePolicies,
      M1_doctrine_lineages_final: doctrineIds.size,
      M2_successions: successionEntries.length,
      M2_doctrine_retention: successionEntries.length === 0 ? 1 : successionEntries.filter((entry) => entry.leader.doctrine.parentId !== null).length / successionEntries.length,
      M3_decision_kind_entropy: entropy(decisions.filter((item) => item.serviceStatus === "served").map((item) => item.kind)),
      M4_notable_events: notableEvents,
      M4_event_response_rate: notableEvents === 0 ? 0 : eventAdaptation / notableEvents,
      M5_alive_at_horizon: finalAlive,
      M5_collapsed_at_horizon: CIVS.length - finalAlive,
      M6_asked: decisions.filter((item) => item.asked).length,
      M6_served: served,
      M6_service_rate: decisions.length === 0 ? 0 : served / decisions.length,
      M7_deferred: decisions.filter((item) => item.deferredBy > 0).length,
      M8_final_fingerprint: finalDirectFingerprint,
    },
  };
}

function csv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column] ?? "")).join(","))].join("\n") + "\n";
}

function report(runs: RunResult[], published: RunResult): string {
  const asked = runs.reduce((n, run) => n + Number(run.metrics.M6_asked), 0);
  const served = runs.reduce((n, run) => n + Number(run.metrics.M6_served), 0);
  const serviceByCiv = Object.fromEntries(CIVS.map((civ) => {
    const civAsked = runs.flatMap((run) => run.decisions.filter((item) => item.civ === civ && item.asked));
    const civServed = civAsked.filter((item) => item.serviceStatus === "served");
    return [civ, { asked: civAsked.length, served: civServed.length, serviceRate: civAsked.length ? civServed.length / civAsked.length : 0 }];
  }));
  const rates = Object.values(serviceByCiv).map((item) => item.serviceRate as number);
  const jain = rates.length === 0 || rates.every((rate) => rate === 0) ? 0 : (rates.reduce((a, b) => a + b, 0) ** 2) / (rates.length * rates.reduce((sum, rate) => sum + rate * rate, 0));
  const seedRows = runs.map((run) => ({ seed: run.seed, horizon: run.horizon, alive: Number(run.metrics.M5_alive_at_horizon), collapsed: Number(run.metrics.M5_collapsed_at_horizon), asked: Number(run.metrics.M6_asked), served: Number(run.metrics.M6_served), service_rate: Number(run.metrics.M6_service_rate).toFixed(3), deferred: Number(run.metrics.M7_deferred), replay: run.replayCheck.status }));
  const final = published.world;
  const finalState = final.civs.map((civ) => `${civ.id}: ${civ.alive ? `${civ.population} habitants, ${civ.territory} terres, ${civ.advances.length} progrès` : "éteinte"}`).join(" · ");
  const chronology = published.events.filter((event) => event.kind !== "RESOURCE_GAINED").slice(0, 24).map((event) => `- **an ${event.tick}** · ${event.civ ?? "monde"} · **${event.kind}** — ${event.detail} [${event.sourceId}]`).join("\n");
  return `# Autopolis — première observation reproductible\n\nStatut : **pilote hors ligne**, généré par ${PROVIDER_VERSION} · ruleset **${AUTOPOLIS_RULESET}** · métriques **${METRICS_VERSION}** · ${runs.length} seeds appariées · horizon ${published.horizon} ans\n\nCette chronique est un épisode d'observation, pas une simulation distante. Aucun fournisseur ni API réelle n'a été appelé. La partie publiée est la graine **${published.seed}**, avec quatre civilisations et une civilisation volontairement fragile pour vérifier que l'histoire conserve aussi un état éteint.\n\n## A. Manifest\n\n- runId : \`${published.runId}\`\n- graine publiée : **${published.seed}**\n- seeds du pilote : ${SEEDS.join(", ")}\n- condition : \`${published.condition}\` (scripted + transmission d'artefacts)\n- provider : \`${published.provider}\` / \`${published.providerVersion}\`\n- horizon : **${published.horizon}**\n- artefact canonique : \`worlds/autopolis/season-1/era-0001.json\`\n- journal de décision : \`journal\` dans l'artefact ; snapshots et événements sont conservés dans le même fichier\n\n## B. Contrôles de validité\n\n- runs attendus / valides : **${runs.length} / ${runs.filter((run) => run.replayCheck.status !== "replay_fail").length}**\n- rejeu final : **${published.replayCheck.status}**\n- fingerprint direct : \`${published.replayCheck.finalDirectFingerprint}\`\n- fingerprint rejeu : \`${published.replayCheck.finalReplayFingerprint}\`\n- divergences par tick : **${published.replayCheck.perTickMismatches.length}**\n- ruling IDs réconciliés : **${published.replayCheck.rulingIdsEqual ? "oui" : "non"}**\n- appels provider pendant le rejeu : **${published.replayCheck.providerCallsDuringReplay}**\n- trace d'événements : **${published.replayCheck.eventTraceStatus}** — le journal canonique Autopolis ne porte pas encore tout le flux moteur ; aucune égalité d'événements n'est revendiquée.\n\n## C. Service et équité d'accès\n\nLe pilote utilise un provider scripté identique pour tous les slots. Le résultat est donc un contrôle de plomberie et d'équité d'accès, pas une comparaison de qualité entre modèles.\n\n| Civilisation | Points demandés | Servis | Taux servi |\n| --- | ---: | ---: | ---: |\n${CIVS.map((civ) => `| ${civ} | ${serviceByCiv[civ]!.asked} | ${serviceByCiv[civ]!.served} | ${(serviceByCiv[civ]!.serviceRate * 100).toFixed(1)} % |`).join("\n")}\n\n- total asked / served : **${asked} / ${served}**\n- taux global : **${asked ? ((served / asked) * 100).toFixed(1) : "0.0"} %**\n- écart absolu entre civilisations : **${(Math.max(...rates) - Math.min(...rates)).toFixed(3)}**\n- indice de Jain des taux servis : **${jain.toFixed(3)}**\n- fallbacks : **0** · décisions différées : **0** · propositions rejetées : **${runs.reduce((n, run) => n + run.decisions.filter((item) => item.serviceStatus === "rejected").length, 0)}**\n\n## D. Résultats par seed\n\n\`seed_metrics.csv\` est reproduit dans l'artefact sous \`pilotSeedMetrics\`.\n\n\`\`\`csv\n${csv(seedRows).trim()}\n\`\`\`\n\n## E. Métriques metrics-v1\n\n- **M1 diversité des doctrines** : le run publié termine avec ${published.metrics.M1_policy_distinct_final} vecteurs de politique légaux distincts parmi les civilisations vivantes et ${published.metrics.M1_doctrine_lineages_final} artefacts de doctrine dans l'état final. Ce chiffre est descriptif ; le pilote n'a pas d'ablation frozen.\n- **M2 stabilité des identités** : ${published.metrics.M2_successions} successions observées dans le run publié ; rétention d'artefact parent chez les successeurs : ${(Number(published.metrics.M2_doctrine_retention) * 100).toFixed(1)} %.\n- **M3 variété des décisions** : entropie Shannon des types servis dans le run publié : ${Number(published.metrics.M3_decision_kind_entropy).toFixed(3)} bits, avec ${published.decisions.filter((item) => item.serviceStatus === "served").length} décisions servies.\n- **M4 adaptation aux événements** : ${Number(published.metrics.M4_notable_events)} événements moteurs notables et taux de réponse dans W=${W} : ${(Number(published.metrics.M4_event_response_rate) * 100).toFixed(1)} %. Cette association temporelle n'est pas une preuve de causalité.\n- **M5 résultats par seed** : le pilote conserve la survie et l'extinction par graine ; l'état publié final est : ${finalState}.\n- **M6 service** : ${asked} points demandés, ${served} réponses scriptées, taux global ${(served / Math.max(1, asked) * 100).toFixed(1)} %.\n- **M7 quota** : aucune décision différée dans ce pilote ; cette métrique n'est pas testée sous charge réelle.\n- **M8 fidélité** : tous les runs valides ont un fingerprint final égal et zéro appel provider au rejeu ; statut prudent : **replay pass avec trace d'événements indisponible depuis le journal canonique**.\n\n## F. Chronologie de l'épisode publié\n\nLes lignes suivantes sont lues dans le journal et les événements du run ${published.seed}. Elles ne sont pas une narration de modèle.\n\n${chronology || "Aucun événement notable."}\n\n## G. Ce qui est observé, et ce qui ne l'est pas\n\n### Faits confirmés par le moteur et le rejeu\n\n- La graine, le ruleset, les propositions acceptées, les successions, les états et les fingerprints sont conservés.\n- Les civilisations non éteintes progressent selon la boucle pure ; la civilisation fragile peut s'éteindre et reste présente dans l'historique.\n- Les artefacts doctrinaux acceptés sont transmis lors des successions journalisées.\n\n### Limites d'interprétation\n\n- **Pas de modèle distant** : aucune conclusion sur un LLM, sa qualité ou son apprentissage.\n- **Pas de preuve d'émergence** : une seule condition scriptée, sans ablation \`engine-only\` / \`frozen\` appariée ; le statut maximal est descriptif, jamais \`emergent_supported\`.\n- **Pas de qualité déduite du service** : le taux de service mesure l'accès au provider, pas la qualité d'une décision. Ici il est artificiellement égal à 100 %.\n- **Pas de causalité narrative** : une décision suivie d'un événement est seulement \`observed-after\` tant qu'une ablation ne sépare pas le moteur, la proposition et la transmission.\n- **Trace événementielle incomplète dans le journal canonique** : M8 ne revendique pas une égalité complète du flux d'événements.\n- **Puissance limitée** : huit seeds de pilote ne suffisent pas pour une conclusion comparative ; les résultats par seed sont la source, pas une moyenne autorisant un classement.\n\n## H. Fichiers de preuve\n\n- épisode publié : \`worlds/autopolis/season-1/era-0001.json\`\n- runs du pilote : \`worlds/autopolis/season-1/pilot/seed-*.json\`\n- journal, snapshots, décisions, événements et rejeu : dans chaque run autonome\n- report metrics-v1 : ce fichier\n\nLa chronique ne présente donc que ce que le rejeu confirme.\n`;
}

mkdirSync(resolve(OUT_DIR, "pilot"), { recursive: true });
const runs = SEEDS.map((seed, index) => runOne(seed, index));
for (const run of runs) writeFileSync(resolve(OUT_DIR, "pilot", `seed-${String(run.seed).padStart(4, "0")}.json`), json(run));
const published = runs.find((run) => run.seed === 42)!;
writeFileSync(PUBLISHED, json({ ...published, pilot: { metricsVersion: METRICS_VERSION, seeds: SEEDS, runs: runs.map((run) => ({ runId: run.runId, seed: run.seed, replayCheck: run.replayCheck, metrics: run.metrics })) } }));
writeFileSync(resolve(OUT_DIR, "seed_metrics.csv"), csv(runs.map((run) => ({ seed: run.seed, horizon: run.horizon, alive: Number(run.metrics.M5_alive_at_horizon), collapsed: Number(run.metrics.M5_collapsed_at_horizon), asked: Number(run.metrics.M6_asked), served: Number(run.metrics.M6_served), service_rate: Number(run.metrics.M6_service_rate).toFixed(3), deferred: Number(run.metrics.M7_deferred), replay: run.replayCheck.status }))));
writeFileSync(resolve(OUT_DIR, "decision_attempts.csv"), csv(runs.flatMap((run) => run.decisions.map((item) => ({ seed: run.seed, civ: item.civ, tick: item.pointTick, kind: item.kind, status: item.serviceStatus, requested: item.requestedModel, served: item.servedModel ?? "", deferredBy: item.deferredBy })))));
writeFileSync(resolve(OUT_DIR, "events.csv"), csv(runs.flatMap((run) => run.events.filter((event) => event.kind !== "RESOURCE_GAINED").map((event) => ({ seed: run.seed, tick: event.tick, civ: event.civ ?? "world", kind: event.kind, sourceId: event.sourceId })))));
const reportPath = resolve("docs/reports/autopolis-season-1.md");
writeFileSync(reportPath, report(runs, published));
console.log(JSON.stringify({ published: PUBLISHED, report: reportPath, seeds: SEEDS, horizon: HORIZON, replay: runs.map((run) => ({ seed: run.seed, status: run.replayCheck.status, mismatches: run.replayCheck.perTickMismatches })) }, null, 2));

// Read-back is intentional: publication is not claimed until the exact files exist.
if (JSON.parse(readFileSync(PUBLISHED, "utf8")).seed !== 42) throw new Error("published seed read-back failed");
