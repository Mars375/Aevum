import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LearningObservationSchema,
  ReplaySchema,
  ServiceEvidenceSchema,
} from "../src/index.js";

/**
 * The dependency rules the README states, enforced instead of asserted.
 *
 * The table at the top of the README says `contracts` never imports the engine,
 * the network or Vue, and that `engine` and `world` never make a single network
 * call. Those were promises kept by hand — and a promise kept by hand is a
 * promise until the day someone is in a hurry. This project verifies its own
 * claims everywhere else; the architecture deserves the same.
 *
 * Deliberately a plain text scan rather than a graph: the rules are about who
 * may name whom, the packages are five, and a parser would be a heavier way to
 * learn the same thing.
 */

const ROOT = resolve(import.meta.dirname, "../../..");

function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|vue)$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(p);
    }
  };
  walk(resolve(ROOT, dir));
  return out;
}

/**
 * Comments are stripped before scanning.
 *
 * The first run of this test flagged `tick.ts` for `Math.random()` — inside a
 * comment explaining why the seasons deliberately do NOT use it. A check that
 * punishes an honest explanation teaches people to delete the explanation, so
 * it reads code and only code.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const offenders = (dir: string, pattern: RegExp) =>
  sources(dir)
    .filter((f) => pattern.test(stripComments(readFileSync(f, "utf8"))))
    .map((f) => f.slice(ROOT.length + 1));

describe("le moteur ne touche jamais le reseau", () => {
  // The whole audit story rests on this: a replay is trustworthy because
  // resolving a turn cannot depend on anything outside its inputs.
  const NETWORK = /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|from ["']node:(http|https|net|dgram)["']/;

  it("packages/engine", () => expect(offenders("packages/engine/src", NETWORK)).toEqual([]));
  it("packages/world", () => expect(offenders("packages/world/src", NETWORK)).toEqual([]));
  it("packages/contracts", () => expect(offenders("packages/contracts/src", NETWORK)).toEqual([]));
});

describe("le moteur et le monde ne lisent jamais l'horloge ni un de", () => {
  /**
   * Determinism is the property every other guarantee is built on. A single
   * `Date.now()` in a tick would make a world unreplayable, and the failure
   * would look like a rounding error rather than a broken contract.
   */
  const NONDETERMINISM = /Math\.random\s*\(|Date\.now\s*\(|new Date\s*\(/;

  it("packages/engine", () => expect(offenders("packages/engine/src", NONDETERMINISM)).toEqual([]));
  it("packages/world", () => expect(offenders("packages/world/src", NONDETERMINISM)).toEqual([]));
});

describe("les contrats ne dependent de personne", () => {
  const UPWARD = /from ["']@abs\/(engine|agents|world)["']|from ["']vue["']/;

  it("ni du moteur, ni des agents, ni du monde, ni de Vue", () =>
    expect(offenders("packages/contracts/src", UPWARD)).toEqual([]));
});

describe("aucun paquet n'importe le lecteur", () => {
  it("le lecteur est une feuille de l'arbre", () => {
    for (const dir of ["packages/contracts/src", "packages/engine/src", "packages/world/src", "packages/agents/src"]) {
      expect(offenders(dir, /from ["'].*apps\/player/), dir).toEqual([]);
    }
  });
});

describe("aucune cle ne peut se glisser dans une source", () => {
  // The CI scans diffs; this scans the tree, so a key committed before the
  // scanner existed would still be caught.
  const KEY = /sk-or-v1-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{30,}|nvapi-[A-Za-z0-9_-]{30,}/;

  it("dans aucun paquet, ni dans le lecteur, ni dans les scripts", () => {
    for (const dir of ["packages", "apps/player/src", "scripts"]) {
      expect(offenders(dir, KEY), dir).toEqual([]);
    }
  });
});

describe("les preuves de service restent publiques et bien formees", () => {
  const service = {
    requestedModel: "requested/model",
    servedModel: "served/model",
    provider: "openrouter",
    fallbackCount: 1,
    attempts: 2,
    latencyMs: 340,
    servedByFallback: true,
  };

  it("conserve les metadonnees necessaires a l'audit", () => {
    expect(ServiceEvidenceSchema.parse(service)).toEqual(service);
  });

  it("refuse les secrets et les corps de prompt", () => {
    expect(ServiceEvidenceSchema.safeParse({ ...service, apiKey: "secret" }).success).toBe(false);
    expect(ServiceEvidenceSchema.safeParse({ ...service, prompt: "private body" }).success).toBe(false);
  });

  it("refuse les compteurs impossibles", () => {
    expect(ServiceEvidenceSchema.safeParse({ ...service, fallbackCount: -1 }).success).toBe(false);
    expect(ServiceEvidenceSchema.safeParse({ ...service, attempts: 1.5 }).success).toBe(false);
    expect(ServiceEvidenceSchema.safeParse({ ...service, latencyMs: -1 }).success).toBe(false);
  });
});

describe("les observations d'adaptation sont des faits bornes", () => {
  const observation = {
    modelId: "model/a",
    civId: "crimson",
    triggerEventIds: ["event-1"],
    decisionTick: 12,
    nextDecisionTick: 20,
    beforeDoctrineFingerprint: "before",
    afterDoctrineFingerprint: "after",
    objectiveDeltas: { population: -4, food: 18 },
  };

  it("refuse les annees negatives et les civilisations inconnues", () => {
    expect(LearningObservationSchema.safeParse({ ...observation, decisionTick: -1 }).success).toBe(false);
    expect(LearningObservationSchema.safeParse({ ...observation, nextDecisionTick: -1 }).success).toBe(false);
    expect(LearningObservationSchema.safeParse({ ...observation, civId: "violet" }).success).toBe(false);
  });
});

describe("les frontieres des batailles archivees ne changent pas", () => {
  it("lit toujours les replays v1 et v2 de reference", () => {
    for (const file of ["battle-seed42.json", "battle-v2-seed42.json"]) {
      const raw = JSON.parse(readFileSync(resolve(ROOT, "replays/reference", file), "utf8"));
      expect(ReplaySchema.safeParse(raw).success, file).toBe(true);
    }
  });
});
