/** Offline adaptation report from one or more replayable world journals. */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildLearningCurve,
  buildObservations,
  classifyLearningSignal,
  type LearningCurve,
  type LearningObservation,
} from "@abs/metrics";
import { JournalSchema, chronicle, type Journal } from "@abs/world";

export const METRIC_VERSION = "aevum-learning-curve-v1";
export type ExecutionMode = "REMOTE_MODELS" | "SCRIPTED_NO_REMOTE_MODEL" | "SILENT_ENGINE_ONLY";

export interface ServiceSummary {
  recordedRulings: number;
  knownEvidence: number;
  unknownEvidence: number;
  selfServed: number;
  servedByFallback: number;
  deferredRulings: number;
  retriedRulings: number;
  serviceRate: number | null;
  fallbackRate: number | null;
}

export interface LearningReport {
  protocol: typeof METRIC_VERSION;
  metricVersion: typeof METRIC_VERSION;
  sources: string[];
  world: {
    worldVersion: string;
    seed: number;
    era: number;
    livedYears: number;
    fingerprint: string | null;
  } | null;
  execution: { mode: ExecutionMode; remoteModelCalls: number | null };
  serviceSummary: ServiceSummary;
  limitations: string[];
  curves: Array<LearningCurve & { classification: ReturnType<typeof classifyLearningSignal> }>;
}

interface Arguments {
  paths: string[];
  format: "json" | "markdown";
  windowSize: number;
  minimumServiceRate: number;
  pairedRunKey?: string;
  out?: string;
  execution: ExecutionMode;
}

function parseArguments(args: string[]): Arguments {
  const paths: string[] = [];
  let format: Arguments["format"] = "json";
  let windowSize = 40;
  let minimumServiceRate = 0.7;
  let pairedRunKey: string | undefined;
  let out: string | undefined;
  let execution: ExecutionMode = "REMOTE_MODELS";
  for (const arg of args) {
    if (arg === "--markdown" || arg === "--format=markdown") format = "markdown";
    else if (arg === "--json" || arg === "--format=json") format = "json";
    else if (arg.startsWith("--window=")) windowSize = Number(arg.slice("--window=".length));
    else if (arg.startsWith("--minimum-service=")) minimumServiceRate = Number(arg.slice("--minimum-service=".length));
    else if (arg.startsWith("--paired-run-key=")) pairedRunKey = arg.slice("--paired-run-key=".length);
    else if (arg.startsWith("--out=")) out = arg.slice("--out=".length);
    else if (arg.startsWith("--execution=")) {
      const value = arg.slice("--execution=".length).toUpperCase().replaceAll("-", "_");
      if (value !== "REMOTE_MODELS" && value !== "SCRIPTED_NO_REMOTE_MODEL" && value !== "SILENT_ENGINE_ONLY") {
        throw new Error(`unknown execution mode: ${value}`);
      }
      execution = value;
    }
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else paths.push(arg);
  }
  if (paths.length === 0) throw new Error("usage: npm run learning-curve -- <journal.json> [more.json] [--markdown] [--paired-run-key=KEY]");
  if (!Number.isInteger(windowSize) || windowSize <= 0) throw new Error("--window must be a positive integer");
  if (!Number.isFinite(minimumServiceRate) || minimumServiceRate < 0 || minimumServiceRate > 1) {
    throw new Error("--minimum-service must be between 0 and 1");
  }
  return { paths, format, windowSize, minimumServiceRate, pairedRunKey, out, execution };
}

function percent(value: number | null): string {
  return value === null ? "inconnu" : `${(value * 100).toFixed(1)}%`;
}

function markdown(curves: Array<LearningCurve & { classification: ReturnType<typeof classifyLearningSignal> }>, sources: string[]): string {
  const lines = [
    "# Courbes d'adaptation observables",
    "",
    `Journaux: ${sources.map((source) => `\`${source}\``).join(", ")}`,
    "",
  ];
  for (const curve of curves) {
    lines.push(
      `## ${curve.modelId ?? "aucun modele"}`,
      "",
      `- Etat: **${curve.classification}**`,
      `- Service propre: ${percent(curve.serviceRate)}; replis: ${percent(curve.fallbackRate)}; preuves inconnues: ${curve.unknownServiceCount}; echantillon: ${curve.sampleCount}`,
      `- Courses: ${curve.runIds.join(", ") || "aucune"}; graines: ${curve.seeds.join(", ") || "aucune"}; appariement: ${curve.pairedRunKey ?? "aucun"}`,
      `- Motifs non classables: ${curve.unrankedReasons.join(", ") || "aucun"}`,
      "",
      "| Serie | Fenetre | Numerateur | Denominateur | Valeur | IC Wilson 95% | Service | Repli |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const series of Object.values(curve.series).flat()) {
      const value = series.value === null ? "null" : series.value.toFixed(3);
      const interval = series.uncertainty.lower === null
        ? "n/a"
        : `${series.uncertainty.lower.toFixed(3)}-${series.uncertainty.upper!.toFixed(3)}`;
      lines.push(`| ${series.metric} | ${series.window.startTick}-${series.window.endTick} | ${series.numerator} | ${series.denominator} | ${value} | ${interval} | ${percent(series.serviceRate)} | ${percent(series.fallbackRate)} |`);
    }
    lines.push("", "### Evenements sources", "");
    if (curve.eventSources.length === 0) lines.push("Aucun evenement source enregistre.");
    else for (const event of curve.eventSources) lines.push(`- \`${event.id}\` (an ${event.tick}, ${event.kind}): ${event.detail}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

const selfServed = (journal: Journal) => journal.rulings.filter((ruling) => {
  const service = ruling.service;
  return service !== null && service !== undefined
    && service.requestedModel === service.servedModel
    && !service.servedByFallback
    && service.fallbackCount === 0;
}).length;

function serviceSummary(journals: Journal[]): ServiceSummary {
  const rulings = journals.flatMap((journal) => journal.rulings);
  const knownEvidence = rulings.filter((ruling) => ruling.service !== null && ruling.service !== undefined).length;
  const self = journals.reduce((total, journal) => total + selfServed(journal), 0);
  const fallback = rulings.filter((ruling) => ruling.service?.servedByFallback).length;
  return {
    recordedRulings: rulings.length,
    knownEvidence,
    unknownEvidence: rulings.length - knownEvidence,
    selfServed: self,
    servedByFallback: fallback,
    deferredRulings: rulings.filter((ruling) => ruling.deferredBy > 0).length,
    retriedRulings: rulings.filter((ruling) => (ruling.service?.attempts ?? 1) > 1).length,
    serviceRate: knownEvidence > 0 ? self / rulings.length : null,
    fallbackRate: knownEvidence > 0 ? fallback / rulings.length : null,
  };
}

export function buildLearningReport(
  paths: string[],
  options: Pick<Arguments, "windowSize" | "minimumServiceRate" | "pairedRunKey" | "execution">,
): LearningReport {
  const observations: LearningObservation[] = [];
  const canonicalPaths = paths.map((path) => realpathSync(path));
  if (new Set(canonicalPaths).size !== canonicalPaths.length) throw new Error("duplicate journal paths are not distinct runs");
  // Published sidecars must not change when the same journal is generated in a
  // different checkout. Canonical paths detect duplicates; source ordinals are
  // the stable public run identity.
  const runIds = paths.map((path, index) => `run:${index + 1}:${basename(path)}`);
  const journals: Journal[] = [];
  for (const [index, path] of canonicalPaths.entries()) {
    const journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    journals.push(journal);
    observations.push(...buildObservations(chronicle(journal), journal.rulings, runIds[index]!));
  }
  const byModel = new Map<string | null, LearningObservation[]>();
  for (const observation of observations) {
    byModel.set(observation.modelId, [...(byModel.get(observation.modelId) ?? []), observation]);
  }
  const curves = [...byModel].sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? "")).map(([, modelObservations]) => {
    const curve = buildLearningCurve(modelObservations, {
      windowSize: options.windowSize,
      minimumServiceRate: options.minimumServiceRate,
      pairedRunKey: options.pairedRunKey,
      pairedRunIds: runIds.length > 1 ? runIds : undefined,
    });
    return { ...curve, classification: classifyLearningSignal(curve) };
  });
  const sources = paths.map((path) => basename(path));
  const journal = journals.length === 1 ? journals[0]! : null;
  return {
    protocol: METRIC_VERSION,
    metricVersion: METRIC_VERSION,
    sources,
    world: journal ? {
      worldVersion: journal.worldVersion,
      seed: journal.origin.seed,
      era: journal.era,
      livedYears: journal.livedTo,
      fingerprint: journal.fingerprint,
    } : null,
    execution: {
      mode: options.execution,
      remoteModelCalls: options.execution === "REMOTE_MODELS" ? null : 0,
    },
    serviceSummary: serviceSummary(journals),
    limitations: [
      "Une seule trajectoire ne permet aucun classement de modèles.",
      options.execution === "SCRIPTED_NO_REMOTE_MODEL"
        ? "Décisions scriptées localement; aucun modèle distant n'a été consulté."
        : options.execution === "SILENT_ENGINE_ONLY"
          ? "Le moteur a vécu sans dirigeant et sans appel de modèle."
          : "Le journal ne conserve pas les appels définitivement échoués.",
      "L'attribution observed-after établit un ordre temporel, pas une causalité.",
      "Les métriques décrivent un comportement observable, pas une modification des poids.",
    ],
    curves,
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArguments(process.argv.slice(2));
    const report = buildLearningReport(args.paths, args);
    const output = args.format === "json"
      ? `${JSON.stringify(report, null, 2)}\n`
      : markdown(report.curves, report.sources);
    if (args.out) writeFileSync(args.out, output);
    else process.stdout.write(output);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
