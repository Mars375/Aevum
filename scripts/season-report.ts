/** Build the published Season report from a journal and its offline metric sidecar. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JournalSchema, chronicle, fingerprint, identityOf, replay, turningPoints } from "@abs/world";
import {
  LearningReportSchema,
  validateLearningReport,
  type LearningReport,
  type ServiceSummary,
} from "./learning-curve.js";

const percent = (value: number | null): string => value === null ? "inconnu" : `${(value * 100).toFixed(1)} %`;

function serviceLines(service: ServiceSummary): string[] {
  return [
    `| Décisions enregistrées | ${service.recordedRulings} |`,
    `| Preuves de service connues | ${service.knownEvidence} |`,
    `| Preuves de service inconnues | ${service.unknownEvidence} |`,
    `| Servies par le modèle demandé | ${service.selfServed} |`,
    `| Servies par repli | ${service.servedByFallback} |`,
    `| Décisions différées | ${service.deferredRulings} |`,
    `| Décisions avec nouvel essai | ${service.retriedRulings} |`,
    `| Taux de service propre | ${percent(service.serviceRate)} |`,
    `| Taux de repli | ${percent(service.fallbackRate)} |`,
  ];
}

export function buildSeasonReport(journalPath: string, metricPath: string): string {
  const journal = JournalSchema.parse(JSON.parse(readFileSync(journalPath, "utf8")));
  const replayed = replay(journal.origin, journal.rulings, journal.livedTo).world;
  if (journal.fingerprint === null || fingerprint(replayed) !== journal.fingerprint) {
    throw new Error("journal fingerprint does not match replay");
  }
  const report = LearningReportSchema.parse(JSON.parse(readFileSync(metricPath, "utf8"))) as LearningReport;
  validateLearningReport(report, [journal]);
  if (!report.world) throw new Error("metric report requires one world");
  const metricWorld = report.world;
  if (report.sources.length !== 1 || report.sources[0] !== basename(journalPath)) throw new Error("metric source does not match journal");
  if (metricWorld.worldVersion !== journal.worldVersion
    || metricWorld.seed !== journal.origin.seed
    || metricWorld.era !== journal.era
    || metricWorld.livedYears !== journal.livedTo
    || metricWorld.fingerprint !== journal.fingerprint) {
    throw new Error("metric world metadata does not match journal");
  }
  const expectedMetric = basename(journalPath).replace(/\.json$/, ".learning.json");
  if (resolve(dirname(metricPath)) !== resolve(dirname(journalPath)) || basename(metricPath) !== expectedMetric) {
    throw new Error("metric sidecar path does not match journal");
  }

  const years = chronicle(journal);
  const turns = turningPoints(years);
  const identities = journal.origin.civs.map((civ) => identityOf(civ, years)).filter((identity) => identity !== null);
  const worldName = basename(dirname(journalPath));
  const journalLink = `/worlds/${worldName}/${basename(journalPath)}`;
  const metricLink = `/worlds/${worldName}/${basename(metricPath)}`;
  const mode = report.execution.mode === "SCRIPTED_NO_REMOTE_MODEL"
    ? "scripted/no remote model"
    : report.execution.mode === "SILENT_ENGINE_ONLY" ? "silent engine only" : "remote models";
  const lines = [
    "# Aevum Season 1 — première ère reproductible",
    "",
    "Statut : artefact hors ligne reproductible, non classable comme course de modèles.",
    "",
    `Cette ère est rejouable depuis son [journal](${journalLink}); ses [métriques](${metricLink}) sont calculées hors ligne par le paquet pur \`@abs/metrics\`.`,
    "",
    "## Protocole",
    "",
    "| Champ | Valeur |",
    "| --- | --- |",
    `| Version du monde | \`${journal.worldVersion}\` |`,
    `| Version métrique | \`${report.metricVersion}\` |`,
    `| Graine | \`${journal.origin.seed}\` |`,
    `| Ère | ${journal.era} |`,
    `| Années vécues | ${journal.livedTo} |`,
    `| Fingerprint | \`${journal.fingerprint ?? "absent"}\` |`,
    `| Exécution | \`${mode}\` |`,
    `| Empreinte de fixture | \`${report.execution.fixtureDigest ?? "aucune"}\` |`,
    `| Appels de modèles distants | ${report.execution.remoteModelCalls ?? "inconnu"} |`,
    "",
    "## Résumé de service",
    "",
    "| Mesure | Valeur |",
    "| --- | ---: |",
    ...serviceLines(report.serviceSummary),
    "",
    "> Le service inconnu reste inconnu : il n'est ni compté comme un succès, ni transformé en zéro.",
    "",
    "## Tournants",
    "",
    ...turns.map((turn) => `- An ${turn.tick}, **${turn.kind}** : ${turn.text}${turn.sourceEventId ? ` (source \`${turn.sourceEventId}\`)` : ""}`),
    "",
    "## États historiques",
    "",
    "| Civilisation | Nom | État | Empreinte doctrinale |",
    "| --- | --- | --- | --- |",
    ...identities.map((identity) => `| ${identity.civId} | ${identity.displayName} | ${identity.fellOnTick === null ? "survit" : `tombe en l'an ${identity.fellOnTick}`} | \`${identity.doctrineFingerprint}\` |`),
    "",
    "## Limites connues",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "- Le résumé de service porte sur les décisions persistées, pas sur les appels définitivement échoués qui ne figurent pas au journal.",
    "",
  ];
  return lines.join("\n");
}

async function main(): Promise<void> {
  const [journalPath, metricPath, ...options] = process.argv.slice(2);
  if (!journalPath || !metricPath) throw new Error("usage: npm run season-report -- <journal.json> <metrics.json> [--out=report.md]");
  if (options.some((option) => !option.startsWith("--out="))) throw new Error(`unknown option: ${options.find((option) => !option.startsWith("--out="))}`);
  if (options.filter((option) => option.startsWith("--out=")).length > 1) throw new Error("duplicate option: --out");
  const out = options.find((option) => option.startsWith("--out="))?.slice("--out=".length);
  if (options.length > 0 && !out) throw new Error("--out requires a value");
  const report = buildSeasonReport(journalPath, metricPath);
  if (out) writeFileSync(out, report);
  else process.stdout.write(`${report}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
