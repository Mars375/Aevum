/** Offline release-candidate verification for the published Aevum Season 1 era. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JournalSchema, fingerprint, replay, type Journal } from "@abs/world";
import { LearningReportSchema, validateLearningReport, type LearningReport } from "./learning-curve.js";
import { buildSeasonReport } from "./season-report.js";

const PRODUCT = "Aevum — Chronique des mondes";
const JOURNAL = "worlds/aevum-season-1/era-0001.json";
const METRIC = "worlds/aevum-season-1/era-0001.learning.json";
const REPORT = "docs/reports/aevum-season-1.md";
const TEXT_EXTENSIONS = new Set(["", ".css", ".html", ".js", ".json", ".jsonl", ".md", ".mjs", ".sh", ".ts", ".vue", ".yml", ".yaml"]);

function parseJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${relative(process.cwd(), path)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireFile(path: string, label: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${label} is missing: ${path}`);
}

function verifyWorldMetadata(journal: Journal, metric: LearningReport): void {
  if (metric.sources.length !== 1 || metric.sources[0] !== basename(JOURNAL)) {
    throw new Error("metric source does not name the published journal");
  }
  if (!metric.world
    || metric.world.worldVersion !== journal.worldVersion
    || metric.world.seed !== journal.origin.seed
    || metric.world.era !== journal.era
    || metric.world.livedYears !== journal.livedTo
    || metric.world.fingerprint !== journal.fingerprint) {
    throw new Error("metric world metadata does not match the published journal");
  }
}

function publicTarget(root: string, href: string): string {
  if (!href.startsWith("/") || href.includes("..")) throw new Error(`report link is not a safe public path: ${href}`);
  return resolve(root, "apps/player/public", href.slice(1));
}

export function verifyPublishedSeason(root: string): void {
  const journalPath = resolve(root, JOURNAL);
  const metricPath = resolve(root, METRIC);
  const reportPath = resolve(root, REPORT);
  requireFile(journalPath, "Season 1 journal");
  requireFile(metricPath, "Season 1 metric sidecar");
  requireFile(reportPath, "Season 1 report");

  const journal = JournalSchema.parse(parseJson(journalPath));
  const final = replay(journal.origin, journal.rulings, journal.livedTo).world;
  if (journal.fingerprint === null || fingerprint(final) !== journal.fingerprint) {
    throw new Error("published journal fingerprint drifts from replay");
  }

  const metric = LearningReportSchema.parse(parseJson(metricPath)) as LearningReport;
  validateLearningReport(metric, [journal]);
  verifyWorldMetadata(journal, metric);

  const report = readFileSync(reportPath, "utf8");
  if (report !== buildSeasonReport(journalPath, metricPath)) throw new Error("published Season 1 report is stale");
  const links = [...report.matchAll(/\[[^\]]+\]\((\/[^)]+)\)/g)].map((match) => match[1]!);
  if (links.length === 0) throw new Error("published Season 1 report has no source links");
  for (const href of links) requireFile(publicTarget(root, href), `report link ${href}`);

  const sourceIndexPath = resolve(root, "worlds/index.json");
  const publicIndexPath = resolve(root, "apps/player/public/worlds/index.json");
  const generatedReportPath = resolve(root, "apps/player/public/reports/aevum-season-1.html");
  requireFile(sourceIndexPath, "world catalogue");
  requireFile(publicIndexPath, "public world catalogue");
  requireFile(generatedReportPath, "generated Season 1 report");
  const sourceIndex = parseJson(sourceIndexPath);
  const publicIndex = parseJson(publicIndexPath);
  if (JSON.stringify(sourceIndex) !== JSON.stringify(publicIndex)) throw new Error("source and public world catalogues differ");
  if (!Array.isArray(sourceIndex)) throw new Error("world catalogue is not an array");
  const entry = sourceIndex.find((candidate) => candidate && typeof candidate === "object" && candidate.path === JOURNAL) as Record<string, unknown> | undefined;
  if (!entry
    || entry.learningCurvePath !== METRIC
    || entry.reportSlug !== "aevum-season-1"
    || entry.seed !== journal.origin.seed
    || entry.livedTo !== journal.livedTo) {
    throw new Error("world catalogue does not link the published journal, sidecar, and report");
  }
}

function walkText(root: string): string[] {
  const ignored = new Set([".git", ".superpowers", "dist", "node_modules"]);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else {
        const extension = entry.includes(".") ? entry.slice(entry.lastIndexOf(".")) : "";
        if (TEXT_EXTENSIONS.has(extension)) out.push(path);
      }
    }
  };
  walk(root);
  return out;
}

export function verifyReleaseInventory(root: string): void {
  const rootPackage = parseJson(resolve(root, "package.json")) as Record<string, unknown>;
  const playerPackage = parseJson(resolve(root, "apps/player/package.json")) as Record<string, unknown>;
  if (rootPackage.name !== "aevum" || !String(rootPackage.description).includes(PRODUCT)) throw new Error("root package does not publish the Aevum identity");
  if (!String(playerPackage.description).includes(PRODUCT)) throw new Error("player package does not publish the Aevum identity");
  const compose = readFileSync(resolve(root, "docker-compose.yml"), "utf8");
  if (!/^name: aevum$/m.test(compose) || !/^\s+image: aevum-player$/m.test(compose)) throw new Error("Compose does not use the Aevum release names");
  const migration = readFileSync(resolve(root, "docs/migrations/aevum-rename.md"), "utf8");
  if (!migration.includes("## Inventaire du renommage") || !migration.includes("## Dépôt distant")) throw new Error("rename inventory is incomplete");

  const textFiles = walkText(root);
  const oldTitle = new RegExp(["ai", "battle", "simulator"].join(" "), "i");
  const oldSlugText = ["ai", "battle", "simulator"].join("-");
  const oldSlug = new RegExp(oldSlugText, "i");
  const oldImage = new RegExp(`${oldSlugText}-player`, "i");
  const titleAllowlist = new Set([
    ".claude/skills/project-conventions/SKILL.md",
    "docs/migrations/aevum-rename.md",
    "docs/spec/mvp.md",
    "docs/spec/release-r1.md",
    "docs/superpowers/plans/2026-08-22-aevum-season-1.md",
  ]);
  const slugAllowlist = new Set([
    ".claude/settings.json",
    ".claude/skills/run-tournament/SKILL.md",
    "CLAUDE.md",
    "apps/player/public/reports/release-r1-verification.html",
    "deploy/ai-battle-world.service",
    "deploy/ai-battle-world.timer",
    "docs/migrations/aevum-rename.md",
    "docs/reports/release-r1-verification.md",
    "docs/superpowers/plans/2026-08-22-aevum-season-1.md",
    "docs/superpowers/specs/2026-08-22-aevum-season-1-design.md",
    "packages/agents/src/provider.ts",
    "scripts/preflight.ts",
    "scripts/tend-world.sh",
  ]);
  const unexpectedMentions = (pattern: RegExp, allowlist: Set<string>) => textFiles
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(root, path))
    .filter((path) => !allowlist.has(path));
  const unexpectedTitle = unexpectedMentions(oldTitle, titleAllowlist);
  const unexpectedSlug = unexpectedMentions(oldSlug, slugAllowlist);
  const unexpectedImage = unexpectedMentions(oldImage, new Set(["docs/migrations/aevum-rename.md"]));
  if (unexpectedTitle.length || unexpectedSlug.length || unexpectedImage.length) {
    throw new Error(`old public identity escaped the rename inventory: ${[...unexpectedTitle, ...unexpectedSlug, ...unexpectedImage].join(", ")}`);
  }

  const secret = /sk-or-v1-[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|MISTRAL_API_KEY\s*=\s*["']?[A-Za-z0-9_-]{20,}/;
  const leaked = textFiles.filter((path) => secret.test(readFileSync(path, "utf8"))).map((path) => relative(root, path));
  if (leaked.length > 0) throw new Error(`secret-like value found in release tree: ${leaked.join(", ")}`);

  try {
    execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ".env"], { cwd: root, stdio: "ignore" });
    throw new Error(".env is tracked by git");
  } catch (error) {
    if (error instanceof Error && error.message === ".env is tracked by git") throw error;
    // Expected: check-ignore succeeds and ls-files fails because .env is untracked.
    try {
      execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: root, stdio: "ignore" });
    } catch {
      throw new Error(".env is not ignored by git");
    }
  }
}

export function verifySeason1(root = resolve(import.meta.dirname, "..")): void {
  verifyPublishedSeason(root);
  verifyReleaseInventory(root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 2) throw new Error("verify-season-1 takes no arguments");
    verifySeason1();
    console.log("Aevum Season 1 release candidate: verified offline.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
