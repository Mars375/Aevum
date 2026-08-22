/** Offline adaptation report from one or more replayable world journals. */
import { readFileSync, realpathSync } from "node:fs";
import { basename } from "node:path";
import {
  buildLearningCurve,
  buildObservations,
  classifyLearningSignal,
  type LearningCurve,
  type LearningObservation,
} from "@abs/metrics";
import { JournalSchema, chronicle } from "@abs/world";

interface Arguments {
  paths: string[];
  format: "json" | "markdown";
  windowSize: number;
  minimumServiceRate: number;
  pairedRunKey?: string;
}

function parseArguments(args: string[]): Arguments {
  const paths: string[] = [];
  let format: Arguments["format"] = "json";
  let windowSize = 40;
  let minimumServiceRate = 0.7;
  let pairedRunKey: string | undefined;
  for (const arg of args) {
    if (arg === "--markdown" || arg === "--format=markdown") format = "markdown";
    else if (arg === "--json" || arg === "--format=json") format = "json";
    else if (arg.startsWith("--window=")) windowSize = Number(arg.slice("--window=".length));
    else if (arg.startsWith("--minimum-service=")) minimumServiceRate = Number(arg.slice("--minimum-service=".length));
    else if (arg.startsWith("--paired-run-key=")) pairedRunKey = arg.slice("--paired-run-key=".length);
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else paths.push(arg);
  }
  if (paths.length === 0) throw new Error("usage: npm run learning-curve -- <journal.json> [more.json] [--markdown] [--paired-run-key=KEY]");
  if (!Number.isInteger(windowSize) || windowSize <= 0) throw new Error("--window must be a positive integer");
  if (!Number.isFinite(minimumServiceRate) || minimumServiceRate < 0 || minimumServiceRate > 1) {
    throw new Error("--minimum-service must be between 0 and 1");
  }
  return { paths, format, windowSize, minimumServiceRate, pairedRunKey };
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

try {
  const args = parseArguments(process.argv.slice(2));
  const observations: LearningObservation[] = [];
  const canonicalPaths = args.paths.map((path) => realpathSync(path));
  if (new Set(canonicalPaths).size !== canonicalPaths.length) throw new Error("duplicate journal paths are not distinct runs");
  const runIds = canonicalPaths.map((path) => `run:${path}`);
  for (const [index, path] of canonicalPaths.entries()) {
    const journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    observations.push(...buildObservations(chronicle(journal), journal.rulings, runIds[index]!));
  }
  const byModel = new Map<string | null, LearningObservation[]>();
  for (const observation of observations) {
    byModel.set(observation.modelId, [...(byModel.get(observation.modelId) ?? []), observation]);
  }
  const curves = [...byModel].sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? "")).map(([, modelObservations]) => {
    const curve = buildLearningCurve(modelObservations, {
      windowSize: args.windowSize,
      minimumServiceRate: args.minimumServiceRate,
      pairedRunKey: args.pairedRunKey,
      pairedRunIds: runIds.length > 1 ? runIds : undefined,
    });
    return { ...curve, classification: classifyLearningSignal(curve) };
  });
  const sources = args.paths.map((path) => basename(path));
  const report = { protocol: "aevum-learning-curve-v1", sources, curves };
  process.stdout.write(args.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : markdown(curves, sources));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
