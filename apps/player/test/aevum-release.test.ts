import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { decodeTextLike, addedLines, matchSecretNames, scanTrackedTree, trackedTextFiles } from "../../../scripts/secrets.js";
import { verifyPublishedSeason, verifyReleaseInventory } from "../../../scripts/verify-season-1.js";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../../..");
const TSX = resolve(ROOT, "node_modules/tsx/dist/loader.mjs");
const TSCONFIG = resolve(ROOT, "tsconfig.json");
const FIXTURE = resolve(ROOT, "packages/agents/test/fixtures/aevum-season-1-campaign.json");
const temporary: string[] = [];

function workspace(): { root: string; guardLog: string; fixture: string } {
  const root = mkdtempSync(join(tmpdir(), "aevum-release-"));
  temporary.push(root);
  const guardLog = join(root, "network-attempt.log");
  const guard = join(root, "network-guard.mjs");
  writeFileSync(guard, `
import { appendFileSync } from "node:fs";
import net from "node:net";
const fail = (kind) => { appendFileSync(${JSON.stringify(guardLog)}, kind + "\\n"); throw new Error("network disabled: " + kind); };
const originalConnect = net.Socket.prototype.connect;
globalThis.fetch = async (input) => fail("fetch " + String(input));
net.Socket.prototype.connect = function (...args) {
  const target = args[0];
  const options = Array.isArray(target) ? target[0] : target;
  const isIpc = typeof target === "string" || (options && typeof options === "object" && typeof options.path === "string");
  if (isIpc) return originalConnect.apply(this, args);
  return fail("tcp " + JSON.stringify(target));
};
`);
  const fixture = join(root, "packages/agents/test/fixtures/aevum-season-1-campaign.json");
  mkdirSync(dirname(fixture), { recursive: true });
  writeFileSync(fixture, readFileSync(FIXTURE));
  expect(fixture).not.toBe(join(root, "campaign.json"));
  expect(readFileSync(fixture)).toEqual(readFileSync(FIXTURE));
  return { root, guardLog, fixture };
}

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function environment(guardLog: string, sentinels = false): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.TSX_TSCONFIG_PATH = TSCONFIG;
  for (const key of ["OPENROUTER_API_KEY", "GROQ_API_KEY", "NVIDIA_API_KEY", "MISTRAL_API_KEY"]) delete env[key];
  if (sentinels) {
    env.OPENROUTER_API_KEY = "sentinel-openrouter";
    env.GROQ_API_KEY = "sentinel-groq";
    env.NVIDIA_API_KEY = "sentinel-nvidia";
    env.MISTRAL_API_KEY = "sentinel-mistral";
  }
  const guard = pathToFileURL(join(dirname(guardLog), "network-guard.mjs")).href;
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --import=${guard}`.trim();
  return env;
}

function run(root: string, guardLog: string, script: string, args: string[], sentinels = false) {
  return spawnSync(process.execPath, ["--import", TSX, resolve(ROOT, script), ...args], {
    cwd: root,
    env: environment(guardLog, sentinels),
    encoding: "utf8",
    timeout: 30_000,
  });
}

function expectSuccess(result: ReturnType<typeof run>): void {
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

const json = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function addVerificationReport(root: string): void {
  const target = join(root, "docs/reports/aevum-season-1-verification.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "# Vérification du candidat Aevum Saison 1\n\nStatut : fixture de test.\n");
}

describe("pipeline de publication Aevum", () => {
  it("produit les memes octets en une fois ou par reprise sans graine repetee", () => {
    const freshWorkspace = workspace();
    const splitWorkspace = workspace();
    const fresh = join(freshWorkspace.root, "campaign.json");
    const split = join(splitWorkspace.root, "campaign.json");
    expectSuccess(run(freshWorkspace.root, freshWorkspace.guardLog, "scripts/live.ts", [`--scripted=${freshWorkspace.fixture}`, "--ticks", "40", "--out", fresh], true));
    expectSuccess(run(splitWorkspace.root, splitWorkspace.guardLog, "scripts/live.ts", [`--scripted=${splitWorkspace.fixture}`, "--ticks", "20", "--out", split], true));
    expectSuccess(run(splitWorkspace.root, splitWorkspace.guardLog, "scripts/live.ts", [`--scripted=${splitWorkspace.fixture}`, "--ticks", "20", "--out", split, "--resume"], true));

    expect(readFileSync(split)).toEqual(readFileSync(fresh));
    expect(readFileSync(split.replace(/\.json$/, ".learning.json"))).toEqual(readFileSync(fresh.replace(/\.json$/, ".learning.json")));
    expect(json(fresh).execution).toEqual({
      mode: "SCRIPTED_NO_REMOTE_MODEL",
      fixtureDigest: `sha256:${sha256(freshWorkspace.fixture)}`,
    });
    expect(existsSync(freshWorkspace.guardLog)).toBe(false);
    expect(existsSync(splitWorkspace.guardLog)).toBe(false);
  });

  it("derive le mode silencieux quand aucune cle ne permet un fournisseur", () => {
    const { root, guardLog } = workspace();
    const inferred = join(root, "inferred.json");
    const explicit = join(root, "explicit.json");
    expectSuccess(run(root, guardLog, "scripts/live.ts", ["--seed", "7", "--ticks", "12", "--out", inferred]));
    expectSuccess(run(root, guardLog, "scripts/live.ts", ["--seed", "7", "--ticks", "12", "--out", explicit, "--silent"]));
    expect(json(inferred).execution).toEqual({ mode: "SILENT_ENGINE_ONLY", fixtureDigest: null });
    expect(json(inferred.replace(/\.json$/, ".learning.json")).execution).toEqual({
      mode: "SILENT_ENGINE_ONLY",
      fixtureDigest: null,
      remoteModelCalls: 0,
    });
    expect(readFileSync(inferred)).toEqual(readFileSync(explicit));
    expect(existsSync(guardLog)).toBe(false);
  });

  it("refuse les changements de mode, de fixture et les assertions mensongeres", () => {
    const { root, guardLog, fixture } = workspace();
    const journal = join(root, "campaign.jsonl.json");
    expectSuccess(run(root, guardLog, "scripts/live.ts", [`--scripted=${fixture}`, "--ticks", "20", "--out", journal], true));

    const changedMode = run(root, guardLog, "scripts/live.ts", ["--out", journal, "--resume", "--ticks", "1"]);
    expect(changedMode.status).not.toBe(0);
    expect(changedMode.stderr).toContain("does not match resumed journal");

    const changedFixture = join(root, "changed.json");
    writeFileSync(changedFixture, `${readFileSync(fixture, "utf8")}\n`);
    const changedDigest = run(root, guardLog, "scripts/live.ts", [`--scripted=${changedFixture}`, "--out", journal, "--resume", "--ticks", "1"], true);
    expect(changedDigest.status).not.toBe(0);
    expect(changedDigest.stderr).toContain("does not match resumed journal");

    const assertion = run(root, guardLog, "scripts/learning-curve.ts", [journal, "--execution=silent-engine-only"]);
    expect(assertion.status).not.toBe(0);
    expect(assertion.stderr).toContain("does not match journal");
    expect(existsSync(guardLog)).toBe(false);
  });

  it("rejette les options CLI malformees avant de vivre un monde", () => {
    const { root, guardLog } = workspace();
    const cases = [
      ["--unknown"],
      ["--ticks", "NaN"],
      ["--seed", "-1"],
      ["--out", "--silent"],
      ["--scripted"],
    ];
    for (const args of cases) expect(run(root, guardLog, "scripts/live.ts", args).status).not.toBe(0);
    expect(existsSync(guardLog)).toBe(false);
  });

  it("valide le sidecar, rend le rapport et publie des liens existants", () => {
    const { root, guardLog, fixture } = workspace();
    const worldDir = join(root, "worlds/aevum-season-1");
    const journal = join(worldDir, "era-0001.json");
    const metric = join(worldDir, "era-0001.learning.json");
    const markdown = join(root, "docs/reports/aevum-season-1.md");
    mkdirSync(worldDir, { recursive: true });
    mkdirSync(dirname(markdown), { recursive: true });
    addVerificationReport(root);

    expectSuccess(run(root, guardLog, "scripts/live.ts", [`--scripted=${fixture}`, "--out", journal], true));
    expectSuccess(run(root, guardLog, "scripts/season-report.ts", [journal, metric, `--out=${markdown}`]));
    expectSuccess(run(root, guardLog, "scripts/build-reports.ts", []));
    expectSuccess(run(root, guardLog, "scripts/index-worlds.ts", []));

    const report = readFileSync(markdown, "utf8");
    expect(report).toContain(`sha256:${sha256(fixture)}`);
    expect(report).toContain("/worlds/aevum-season-1/era-0001.learning.json");
    const index = json(join(root, "worlds/index.json")) as unknown as Array<Record<string, unknown>>;
    expect(index).toHaveLength(1);
    expect(index[0]?.learningCurvePath).toBe("worlds/aevum-season-1/era-0001.learning.json");
    expect(index[0]?.reportSlug).toBe("aevum-season-1");
    expect(existsSync(join(root, "apps/player/public", String(index[0]?.learningCurvePath)))).toBe(true);
    expect(existsSync(join(root, "apps/player/public/reports/aevum-season-1.html"))).toBe(true);

    const stale = json(metric);
    stale.world.seed += 1;
    writeFileSync(metric, `${JSON.stringify(stale, null, 2)}\n`);
    expect(run(root, guardLog, "scripts/season-report.ts", [journal, metric]).status).not.toBe(0);
    expectSuccess(run(root, guardLog, "scripts/index-worlds.ts", []));
    const staleIndex = json(join(root, "worlds/index.json")) as unknown as Array<Record<string, unknown>>;
    expect(staleIndex[0]?.learningCurvePath).toBeUndefined();
    expect(existsSync(guardLog)).toBe(false);
  });

  it("refuse chaque derive d'un artefact de publication", () => {
    const { root, guardLog, fixture } = workspace();
    const worldDir = join(root, "worlds/aevum-season-1");
    const journal = join(worldDir, "era-0001.json");
    const metric = join(worldDir, "era-0001.learning.json");
    const markdown = join(root, "docs/reports/aevum-season-1.md");
    mkdirSync(worldDir, { recursive: true });
    mkdirSync(dirname(markdown), { recursive: true });
    addVerificationReport(root);
    expectSuccess(run(root, guardLog, "scripts/live.ts", [`--scripted=${fixture}`, "--out", journal], true));
    expectSuccess(run(root, guardLog, "scripts/season-report.ts", [journal, metric, `--out=${markdown}`]));
    expectSuccess(run(root, guardLog, "scripts/build-reports.ts", []));
    expectSuccess(run(root, guardLog, "scripts/index-worlds.ts", []));

    const journalBytes = readFileSync(journal);
    const metricBytes = readFileSync(metric);
    verifyPublishedSeason(root);

    writeFileSync(journal, "{}\n");
    expect(() => verifyPublishedSeason(root)).toThrow();
    writeFileSync(journal, journalBytes);

    const missingSource = json(metric);
    missingSource.sources = ["missing.json"];
    writeFileSync(metric, `${JSON.stringify(missingSource, null, 2)}\n`);
    expect(() => verifyPublishedSeason(root)).toThrow(/source/);
    writeFileSync(metric, metricBytes);

    const wrongRate = json(metric);
    wrongRate.serviceSummary.serviceRate = 0;
    writeFileSync(metric, `${JSON.stringify(wrongRate, null, 2)}\n`);
    expect(() => verifyPublishedSeason(root)).toThrow(/service summary/);
    writeFileSync(metric, metricBytes);

    for (const mutate of [
      (value: Record<string, any>) => { value.curves[0].classification = "NO_EVIDENCE"; },
      (value: Record<string, any>) => { value.curves[0].series.doctrineCoherence[0].numerator += 1; },
      (value: Record<string, any>) => { value.curves[0].eventSources[0].detail += " altéré"; },
      (value: Record<string, any>) => { value.curves[0].options.windowSize = 20; },
      (value: Record<string, any>) => { value.limitations.pop(); },
    ]) {
      const altered = json(metric);
      mutate(altered);
      writeFileSync(metric, `${JSON.stringify(altered, null, 2)}\n`);
      expect(() => verifyPublishedSeason(root)).toThrow();
      writeFileSync(metric, metricBytes);
    }

    const publicMetric = join(root, "apps/player/public/worlds/aevum-season-1/era-0001.learning.json");
    writeFileSync(publicMetric, "{}\n");
    expect(() => verifyPublishedSeason(root)).toThrow(/public copy/);
    writeFileSync(publicMetric, metricBytes);

    const reportIndex = join(root, "apps/player/public/reports/index.json");
    const reportIndexBytes = readFileSync(reportIndex);
    writeFileSync(reportIndex, "[]\n");
    expect(() => verifyPublishedSeason(root)).toThrow(/report catalogue/);
    writeFileSync(reportIndex, reportIndexBytes);

    rmSync(join(root, "apps/player/public/worlds/aevum-season-1/era-0001.json"));
    expect(() => verifyPublishedSeason(root)).toThrow(/report link/);
    mkdirSync(join(root, "apps/player/public/worlds/aevum-season-1"), { recursive: true });
    writeFileSync(join(root, "apps/player/public/worlds/aevum-season-1/era-0001.json"), journalBytes);

    const drifted = json(journal);
    drifted.fingerprint = "00000000";
    writeFileSync(journal, `${JSON.stringify(drifted, null, 2)}\n`);
    expect(() => verifyPublishedSeason(root)).toThrow(/fingerprint/);
    expect(existsSync(guardLog)).toBe(false);
  });

  it("verifie l'inventaire de renommage et les contrats de secrets", () => {
    expect(() => verifyReleaseInventory(ROOT)).not.toThrow();
    const leak = `const token = "${["OPENROUTER", "API", "KEY"].join("_")}=abcdefghijklmnopqrstuvwxyz123456";\n`;
    expect(matchSecretNames(leak)).toContain("provider-secret-assignment");
  });
});

describe("semantique des courbes publiees", () => {
  let root = "";
  let metricBytes: Buffer;

  beforeAll(() => {
    const { root: built, guardLog, fixture } = workspace();
    root = built;
    const worldDir = join(built, "worlds/aevum-season-1");
    mkdirSync(worldDir, { recursive: true });
    mkdirSync(dirname(join(built, "docs/reports/aevum-season-1.md")), { recursive: true });
    addVerificationReport(built);
    expectSuccess(run(built, guardLog, "scripts/live.ts", [`--scripted=${fixture}`, "--out", join(worldDir, "era-0001.json")], true));
    expectSuccess(run(built, guardLog, "scripts/season-report.ts", [join(worldDir, "era-0001.json"), join(worldDir, "era-0001.learning.json"), `--out=${join(built, "docs/reports/aevum-season-1.md")}`]));
    expectSuccess(run(built, guardLog, "scripts/build-reports.ts", []));
    expectSuccess(run(built, guardLog, "scripts/index-worlds.ts", []));
  });

  function metricPath(): string {
    return join(root, "worlds/aevum-season-1/era-0001.learning.json");
  }

  afterEach(() => {
    if (metricBytes) writeFileSync(metricPath(), metricBytes);
  });

  it("accepte le sidecar reconstruit puis refuse chaque derive semantique nommee", () => {
    metricBytes = readFileSync(metricPath());
    expect(() => verifyPublishedSeason(root)).not.toThrow();

    const drifts: Array<[string, (value: Record<string, any>) => void, RegExp]> = [
      ["classification renversee", (v) => { v.curves[0].classification = "NO_EVIDENCE"; }, /classification NO_EVIDENCE does not follow/],
      ["numerateur au-dessus du denominateur", (v) => { v.curves[0].series.consequenceRecognition[0].numerator = v.curves[0].series.consequenceRecognition[0].denominator + 1; }, /numerator exceeds denominator/],
      ["valeur incoherente", (v) => { v.curves[0].series.doctrineCoherence[0].value = 0.42; }, /value does not equal/],
      ["bornes d'incertitude asymetriques", (v) => { v.curves[0].series.consequenceRecognition[0].uncertainty.lower = 0; }, /both be null or both be numbers/],
      ["bande d'incertitude fausse", (v) => { v.curves[0].series.consequenceRecognition[0].uncertainty.lower = 0; v.curves[0].series.consequenceRecognition[0].uncertainty.upper = 1; }, /Wilson 95%/],
      ["compte de graines impossible", (v) => { v.curves[0].series.narrativeFidelity[0].uncertainty.seedCount = 0; }, /seed count/],
      ["compte de courses impossible", (v) => { v.curves[0].series.narrativeFidelity[0].uncertainty.runCount = 4; }, /run count/],
      ["taux de service de serie incoherent", (v) => { v.curves[0].series.consequenceRecognition[0].serviceRate = 0.5; }, /service rates are inconsistent/],
      ["taux de service de courbe incoherent", (v) => { v.curves[0].serviceRate = 0.5; }, /serviceRate is inconsistent with the unknown-evidence count/],
      ["preuves inconnues hors echantillon", (v) => { v.curves[0].series.consequenceRecognition[0].unknownServiceCount = 999; }, /unknown service count exceeds sample count/],
      ["source d'evenement alteree", (v) => { v.curves[0].eventSources[0].detail += " altéré"; }, /does not match the published journal/],
      ["source d'evenement dupliquee", (v) => { v.curves[0].eventSources.push({ ...v.curves[0].eventSources[0] }); }, /duplicate event source/],
      ["sources non triees", (v) => { const [first, second] = v.curves[0].eventSources; v.curves[0].eventSources[0] = second; v.curves[0].eventSources[1] = first; }, /not ordered by tick then id/],
      ["fenetre citant une source inconnue", (v) => { v.curves[0].series.consequenceRecognition[0].eventSourceIds.push("evenement-inconnu"); }, /cites unknown event source/],
      ["fenetre desalignee", (v) => { v.curves[0].series.consequenceRecognition[0].window.endTick -= 1; }, /not aligned to the published window size/],
      ["fenetres divergentes entre metriques", (v) => { const last = v.curves[0].series.narrativeFidelity.at(-1); last.window.startTick += 40; last.window.endTick += 40; }, /does not share the windows/],
      ["somme d'echantillons cassee", (v) => { const point = v.curves[0].series.consequenceRecognition[0]; point.sampleCount += 1; point.unknownServiceCount += 1; }, /samples sum to/],
      ["protocole publie modifie", (v) => { v.curves[0].options.minimumServiceRate = 0.5; }, /published protocol/],
      ["course surnumeraire", (v) => { v.curves[0].runIds.push("run:2:autre.json"); }, /declares 2 runs for one journal/],
      ["appariement sans course multiple", (v) => { v.curves[0].pairedRunKey = "fantome"; }, /paired run key without multiple runs/],
      ["graine etrangere", (v) => { v.curves[0].seeds = [424242]; }, /seeds do not match the journal seed/],
    ];
    for (const [name, mutate, expected] of drifts) {
      // Each drift starts from the pristine sidecar, so one named mutation is
      // on trial at a time and its specific message is the assertion.
      const altered = JSON.parse(metricBytes.toString("utf8"));
      mutate(altered);
      writeFileSync(metricPath(), `${JSON.stringify(altered, null, 2)}\n`);
      try {
        expect(() => verifyPublishedSeason(root), name).toThrow(expected);
      } finally {
        writeFileSync(metricPath(), metricBytes);
      }
    }
  });
});

describe("scanner de secrets partage", () => {
  // Planted secrets are assembled at runtime: the tracked bytes of this very
  // file are scanned like any other text-like source, so a secret-shaped
  // literal here would be a true finding.
  const value = ["abcdefghijklmnopqrstuvwxyz", "123456"].join("");

  it("detecte une affectation generique quel que soit le fournisseur", () => {
    const keyName = ["API", "KEY"].join("_");
    for (const provider of ["OPENROUTER", "GROQ", "NVIDIA", "MISTRAL", "SOMENEWPROVIDER"]) {
      expect(matchSecretNames(`${provider}_${keyName}="${value}"\n`), provider).toContain("provider-secret-assignment");
    }
    expect(matchSecretNames(`${["db", "PASSWORD"].join("_")}=${JSON.stringify(value.slice(0, 16))}\n`)).toContain("provider-secret-assignment");
    expect(matchSecretNames(`service_token=${JSON.stringify(value.repeat(2))}\n`)).toContain("provider-secret-assignment");
  });

  it("laisse les placeholders, sentinelles et references d'environnement tranquilles", () => {
    const quiet = [
      "OPENROUTER_API_KEY=sk-or-v1-...\n",
      "GROQ_API_KEY=gsk_...\n",
      'env.OPENROUTER_API_KEY = "sentinel-openrouter";\n',
      "openrouter: process.env.OPENROUTER_API_KEY,\n",
      "MISTRAL_API_KEY=<your-key>\n",
      'NVIDIA_API_KEY=""\n',
      "credentials are `OPENROUTER_API_KEY`, `GROQ_API_KEY`\n",
    ];
    for (const line of quiet) expect(matchSecretNames(line), line).toEqual([]);
  });

  it("couvre les fichiers text-like suivis, y compris .env.*, et saute le binaire", () => {
    const tracked = trackedTextFiles(ROOT);
    expect(tracked).toContainEqual(resolve(ROOT, ".env.example"));
    expect(tracked.some((path) => path.endsWith(".png") || path.endsWith(".ico"))).toBe(false);
    expect(scanTrackedTree(ROOT)).toEqual([]);
    expect(decodeTextLike(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]))).toBeNull();
    expect(addedLines("+secret=ok\n-context\n+++ b/f\n")).toBe("secret=ok");
  });

  it("ne imprime jamais la valeur detectee", () => {
    const secret = ["sk-or-v1-", value].join("");
    const names = matchSecretNames(`key = "${secret}"`);
    // The scanner's only outputs are pattern names and file paths.
    expect(names).toEqual(["openrouter-token"]);
    expect(JSON.stringify(names)).not.toContain(secret);
  });
});
