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

export interface LearningReportOptions {
  windowSize: number;
  minimumServiceRate: number;
  pairedRunKey?: string;
  executionAssertion?: ExecutionProvenance["mode"];
}

interface Arguments extends LearningReportOptions {
  paths: string[];
  format: "json" | "markdown";
  out?: string;
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
}).strict().superRefine((series, context) => {
  if (series.numerator > series.denominator) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "numerator exceeds denominator", path: ["numerator"] });
  }
  const expectedValue = series.denominator === 0 ? null : series.numerator / series.denominator;
  if (series.value !== expectedValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "value does not equal numerator / denominator", path: ["value"] });
  }
  if ((series.uncertainty.lower === null) !== (series.uncertainty.upper === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "uncertainty bounds must both be null or both be numbers", path: ["uncertainty"] });
  }
});
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

/**
 * Explicit semantic validation of the published curves, kept apart from the
 * schema on purpose. The first release verifier trusted the schema plus one
 * whole-report equality check; a review showed that a payload could drift in
 * one field and only be caught by an opaque "does not match the journal" error
 * — or, for relationships the schema never expressed, not be caught at all.
 * Each invariant below names its own drift so a mutation test can prove the
 * check fires, independently of the rebuild-and-compare that follows it.
 */
export function verifyCurveSemantics(
  report: LearningReport,
  journals: Journal[],
  protocol: { windowSize: number; minimumServiceRate: number },
): void {
  const fail = (detail: string): never => {
    throw new Error(`published curve semantics: ${detail}`);
  };
  // Wilson 95% must be recomputed with the exact constants and operation order
  // of packages/metrics/src/curves.ts — the comparison is bitwise, which is the
  // point: any change to the published formula must fail here until the
  // sidecar is deliberately rebuilt.
  const wilson95 = (numerator: number, denominator: number): { lower: number | null; upper: number | null } => {
    if (denominator === 0) return { lower: null, upper: null };
    const z = 1.959963984540054;
    const p = numerator / denominator;
    const z2 = z * z;
    const centre = (p + z2 / (2 * denominator)) / (1 + z2 / denominator);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * denominator)) / denominator) / (1 + z2 / denominator);
    return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
  };

  const singleJournal = journals.length === 1 ? journals[0]! : null;
  const journalEvents = new Map(
    singleJournal
      ? chronicle(singleJournal).flatMap((year) => year.events).map((event) => [event.id, event])
      : [],
  );

  report.curves.forEach((curve, curveIndex) => {
    const label = curve.modelId ?? `#${curveIndex}`;
    if (classifyLearningSignal(curve) !== curve.classification) {
      fail(`curve ${label}: classification ${curve.classification} does not follow from its series, options and unranked reasons`);
    }
    if (curve.options.windowSize !== protocol.windowSize || curve.options.minimumServiceRate !== protocol.minimumServiceRate) {
      fail(`curve ${label}: published protocol is window ${protocol.windowSize} with minimum service rate ${protocol.minimumServiceRate}`);
    }
    if (singleJournal) {
      if (curve.runIds.length !== 1 || curve.runIds[0] === undefined) {
        fail(`curve ${label}: declares ${curve.runIds.length} runs for one journal`);
      }
      if (curve.pairedRunKey !== null) fail(`curve ${label}: carries a paired run key without multiple runs`);
      if (JSON.stringify(curve.seeds) !== JSON.stringify([singleJournal.origin.seed])) {
        fail(`curve ${label}: seeds do not match the journal seed ${singleJournal.origin.seed}`);
      }
    }

    const seenSourceIds = new Set<string>();
    let previousSource: { tick: number; id: string } | null = null;
    for (const source of curve.eventSources) {
      if (seenSourceIds.has(source.id)) fail(`curve ${label}: duplicate event source ${source.id}`);
      seenSourceIds.add(source.id);
      const journalEvent = journalEvents.get(source.id);
      if (!journalEvent
        || journalEvent.tick !== source.tick
        || journalEvent.kind !== source.kind
        || journalEvent.detail !== source.detail) {
        fail(`curve ${label}: event source ${source.id} does not match the published journal`);
      }
      if (previousSource && (source.tick < previousSource.tick
        || (source.tick === previousSource.tick && source.id <= previousSource.id))) {
        fail(`curve ${label}: event sources are not ordered by tick then id`);
      }
      previousSource = source;
    }

    const seriesEntries = Object.entries(curve.series);
    let referenceWindows: Array<{ startTick: number; endTick: number }> | null = null;
    for (const [seriesName, series] of seriesEntries) {
      let sampleTotal = 0;
      let previousStart: number | null = null;
      for (const point of series) {
        if (point.numerator > point.denominator) fail(`${seriesName}/${label}: numerator exceeds denominator`);
        const expectedValue = point.denominator === 0 ? null : point.numerator / point.denominator;
        if (point.value !== expectedValue) {
          fail(`${seriesName}/${label}: value does not equal numerator over denominator in window ${point.window.startTick}-${point.window.endTick}`);
        }
        if (point.denominator > point.sampleCount) {
          fail(`${seriesName}/${label}: denominator exceeds sample count in window ${point.window.startTick}-${point.window.endTick}`);
        }
        if (point.unknownServiceCount > point.sampleCount) {
          fail(`${seriesName}/${label}: unknown service count exceeds sample count`);
        }
        const noKnownEvidence = point.unknownServiceCount === point.sampleCount;
        if ((point.serviceRate === null) !== noKnownEvidence || (point.fallbackRate === null) !== noKnownEvidence) {
          fail(`${seriesName}/${label}: service rates are inconsistent with the unknown-evidence count`);
        }
        const expectedInterval = wilson95(point.numerator, point.denominator);
        if (point.uncertainty.lower !== expectedInterval.lower || point.uncertainty.upper !== expectedInterval.upper) {
          fail(`${seriesName}/${label}: uncertainty interval is not the Wilson 95% band of ${point.numerator}/${point.denominator}`);
        }
        if (point.uncertainty.seedCount < 1 || point.uncertainty.seedCount > curve.seeds.length) {
          fail(`${seriesName}/${label}: uncertainty seed count lies outside the curve's seeds`);
        }
        if (point.uncertainty.runCount < 1 || point.uncertainty.runCount > Math.max(1, curve.runIds.length)) {
          fail(`${seriesName}/${label}: uncertainty run count lies outside the curve's runs`);
        }
        const cited = new Set<string>();
        let previousCitedId: string | null = null;
        for (const id of point.eventSourceIds) {
          if (!seenSourceIds.has(id)) fail(`${seriesName}/${label}: window cites unknown event source ${id}`);
          if (cited.has(id)) fail(`${seriesName}/${label}: window cites event source ${id} twice`);
          cited.add(id);
          if (previousCitedId !== null && id <= previousCitedId) {
            fail(`${seriesName}/${label}: cited event sources are not sorted or contain duplicates`);
          }
          previousCitedId = id;
        }
        if (point.window.startTick % protocol.windowSize !== 0
          || point.window.endTick !== point.window.startTick + protocol.windowSize - 1) {
          fail(`${seriesName}/${label}: window ${point.window.startTick}-${point.window.endTick} is not aligned to the published window size`);
        }
        if (previousStart !== null && point.window.startTick <= previousStart) {
          fail(`${seriesName}/${label}: windows repeat or go backwards`);
        }
        previousStart = point.window.startTick;
        sampleTotal += point.sampleCount;
      }
      if (sampleTotal !== curve.sampleCount) {
        fail(`${seriesName}/${label}: window samples sum to ${sampleTotal} but the curve declares ${curve.sampleCount}`);
      }
      if (referenceWindows === null) referenceWindows = series.map((point) => point.window);
      else if (JSON.stringify(referenceWindows) !== JSON.stringify(series.map((point) => point.window))) {
        fail(`curve ${label}: ${seriesName} does not share the windows of the other metrics`);
      }
    }

    for (const key of ["serviceRate", "fallbackRate"] as const) {
      const noKnownEvidence = curve.unknownServiceCount === curve.sampleCount;
      if ((curve[key] === null) !== noKnownEvidence) {
        fail(`curve ${label}: ${key} is inconsistent with the unknown-evidence count`);
      }
    }
  });
}

export function buildLearningReportFromJournals(
  journals: Journal[],
  sources: string[],
  options: LearningReportOptions,
): LearningReport {
  if (journals.length === 0 || journals.length !== sources.length) {
    throw new Error("journals and sources must be non-empty and have the same length");
  }
  if (new Set(sources).size !== sources.length) throw new Error("duplicate journal sources are not distinct runs");
  const observations: LearningObservation[] = [];
  // Published sidecars must not change when the same journal is generated in a
  // different checkout. Source ordinals are the stable public run identity.
  const runIds = sources.map((source, index) => `run:${index + 1}:${source}`);
  for (const [index, journal] of journals.entries()) {
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

export function buildLearningReport(paths: string[], options: LearningReportOptions): LearningReport {
  const canonicalPaths = paths.map((path) => realpathSync(path));
  if (new Set(canonicalPaths).size !== canonicalPaths.length) throw new Error("duplicate journal paths are not distinct runs");
  const journals = canonicalPaths.map((path) => JournalSchema.parse(JSON.parse(readFileSync(path, "utf8"))));
  return buildLearningReportFromJournals(journals, paths.map((path) => basename(path)), options);
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
