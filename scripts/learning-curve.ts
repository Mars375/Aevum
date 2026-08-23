/** Offline adaptation report from one or more replayable world journals. */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  buildLearningCurve,
  buildObservations,
  classifyLearningSignal,
  type LearningCurve,
  type LearningObservation,
} from "@abs/metrics";
import {
  ExecutionProvenanceSchema,
  JournalSchema,
  chronicle,
  type ExecutionProvenance,
  type Journal,
} from "@abs/world";

export const METRIC_VERSION = "aevum-learning-curve-v1";

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
  execution: ExecutionProvenance & { remoteModelCalls: number | null };
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
  executionAssertion?: ExecutionProvenance["mode"];
}

const nullableRate = z.number().min(0).max(1).nullable();
const nonnegativeInteger = z.number().int().min(0);
const ServiceSummarySchema = z.object({
  recordedRulings: nonnegativeInteger,
  knownEvidence: nonnegativeInteger,
  unknownEvidence: nonnegativeInteger,
  selfServed: nonnegativeInteger,
  servedByFallback: nonnegativeInteger,
  deferredRulings: nonnegativeInteger,
  retriedRulings: nonnegativeInteger,
  serviceRate: nullableRate,
  fallbackRate: nullableRate,
}).strict();
const EventSourceSchema = z.object({
  id: z.string().min(1),
  tick: nonnegativeInteger,
  kind: z.string().min(1),
  detail: z.string(),
}).strict();
const MetricSeriesSchema = z.object({
  metric: z.enum(["consequence-recognition", "error-correction", "doctrine-coherence", "narrative-fidelity"]),
  window: z.object({ startTick: nonnegativeInteger, endTick: nonnegativeInteger }).strict(),
  numerator: nonnegativeInteger,
  denominator: nonnegativeInteger,
  value: nullableRate,
  sampleCount: nonnegativeInteger,
  serviceRate: nullableRate,
  fallbackRate: nullableRate,
  unknownServiceCount: nonnegativeInteger,
  uncertainty: z.object({
    method: z.literal("WILSON_95"),
    lower: nullableRate,
    upper: nullableRate,
    seedCount: nonnegativeInteger,
    runCount: nonnegativeInteger,
  }).strict(),
  eventSourceIds: z.array(z.string().min(1)),
}).strict();
const LearningCurveSchema = z.object({
  modelId: z.string().nullable(),
  runIds: z.array(z.string().min(1)),
  seeds: z.array(z.number().int()),
  pairedRunKey: z.string().nullable(),
  options: z.object({
    windowSize: z.number().int().positive(),
    minimumServiceRate: z.number().min(0).max(1),
    maximumFallbackRate: z.number().min(0).max(1),
    minimumSamples: nonnegativeInteger,
    minimumWindows: nonnegativeInteger,
    minimumImprovement: z.number().min(0),
  }).strict(),
  sampleCount: nonnegativeInteger,
  serviceRate: nullableRate,
  fallbackRate: nullableRate,
  unknownServiceCount: nonnegativeInteger,
  eventSources: z.array(EventSourceSchema),
  series: z.object({
    consequenceRecognition: z.array(MetricSeriesSchema),
    errorCorrection: z.array(MetricSeriesSchema),
    doctrineCoherence: z.array(MetricSeriesSchema),
    narrativeFidelity: z.array(MetricSeriesSchema),
  }).strict(),
  unrankedReasons: z.array(z.string()),
  classification: z.enum(["ADAPTATION_OBSERVED", "NO_EVIDENCE", "INSUFFICIENT_DATA", "UNRANKED"]),
}).strict();

export const LearningReportSchema = z.object({
  protocol: z.literal(METRIC_VERSION),
  metricVersion: z.literal(METRIC_VERSION),
  sources: z.array(z.string().min(1)).min(1),
  world: z.object({
    worldVersion: z.string().min(1),
    seed: z.number().int(),
    era: nonnegativeInteger,
    livedYears: nonnegativeInteger,
    fingerprint: z.string().nullable(),
  }).strict().nullable(),
  execution: z.intersection(ExecutionProvenanceSchema, z.object({ remoteModelCalls: nonnegativeInteger.nullable() })),
  serviceSummary: ServiceSummarySchema,
  limitations: z.array(z.string().min(1)),
  curves: z.array(LearningCurveSchema),
}).strict();

function parseArguments(args: string[]): Arguments {
  const paths: string[] = [];
  let format: Arguments["format"] = "json";
  let windowSize = 40;
  let minimumServiceRate = 0.7;
  let pairedRunKey: string | undefined;
  let out: string | undefined;
  let executionAssertion: ExecutionProvenance["mode"] | undefined;
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
      executionAssertion = value;
    }
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else paths.push(arg);
  }
  if (paths.length === 0) throw new Error("usage: npm run learning-curve -- <journal.json> [more.json] [--markdown] [--paired-run-key=KEY]");
  if (!Number.isInteger(windowSize) || windowSize <= 0) throw new Error("--window must be a positive integer");
  if (!Number.isFinite(minimumServiceRate) || minimumServiceRate < 0 || minimumServiceRate > 1) {
    throw new Error("--minimum-service must be between 0 and 1");
  }
  return { paths, format, windowSize, minimumServiceRate, pairedRunKey, out, executionAssertion };
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

export function serviceSummary(journals: Journal[]): ServiceSummary {
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

export function executionFor(journals: Journal[]): ExecutionProvenance {
  const executions = journals.map((journal) => journal.execution);
  if (executions.some((execution) => execution === null)) {
    throw new Error("journal has no immutable execution provenance");
  }
  const execution = executions[0]!;
  if (executions.some((candidate) => JSON.stringify(candidate) !== JSON.stringify(execution))) {
    throw new Error("journals do not share one execution provenance");
  }
  for (const journal of journals) {
    if (execution.mode === "SILENT_ENGINE_ONLY" && journal.rulings.length !== 0) {
      throw new Error("silent execution cannot contain rulings");
    }
    if (execution.mode === "SCRIPTED_NO_REMOTE_MODEL") {
      if (journal.rulings.length === 0
        || journal.rulings.some((ruling) => ruling.model !== "scripted/no-remote-model" || ruling.service !== null)) {
        throw new Error("scripted execution requires scripted rulings without remote service evidence");
      }
    }
    if (execution.mode === "REMOTE_MODELS"
      && (journal.rulings.length === 0 || journal.rulings.some((ruling) => !ruling.model || ruling.model === "scripted/no-remote-model"))) {
      throw new Error("remote execution requires actual provider rulings");
    }
  }
  return execution;
}

export function validateLearningReport(report: LearningReport, journals: Journal[]): void {
  LearningReportSchema.parse(report);
  const execution = executionFor(journals);
  if (report.execution.mode !== execution.mode || report.execution.fixtureDigest !== execution.fixtureDigest) {
    throw new Error("metric execution metadata does not match journal");
  }
  const expectedCalls = execution.mode === "REMOTE_MODELS" ? null : 0;
  if (report.execution.remoteModelCalls !== expectedCalls) throw new Error("metric remote call metadata is inconsistent");
  if (JSON.stringify(report.serviceSummary) !== JSON.stringify(serviceSummary(journals))) {
    throw new Error("metric service summary does not match journal");
  }
}

export function buildLearningReport(
  paths: string[],
  options: Pick<Arguments, "windowSize" | "minimumServiceRate" | "pairedRunKey" | "executionAssertion">,
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
  const execution = executionFor(journals);
  if (options.executionAssertion && options.executionAssertion !== execution.mode) {
    throw new Error(`requested execution ${options.executionAssertion} does not match journal ${execution.mode}`);
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
      ...execution,
      remoteModelCalls: execution.mode === "REMOTE_MODELS" ? null : 0,
    },
    serviceSummary: serviceSummary(journals),
    limitations: [
      "Une seule trajectoire ne permet aucun classement de modèles.",
      execution.mode === "SCRIPTED_NO_REMOTE_MODEL"
        ? "Décisions scriptées localement; aucun modèle distant n'a été consulté."
        : execution.mode === "SILENT_ENGINE_ONLY"
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
