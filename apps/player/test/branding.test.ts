import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const PRODUCT = "Aevum — Chronique des mondes";
const OLD_TITLE = new RegExp(["ai", "battle", "simulator"].join(" "), "i");
const OLD_SLUG_TEXT = ["ai", "battle", "simulator"].join("-");
const OLD_SLUG = new RegExp(OLD_SLUG_TEXT, "i");
const OLD_IMAGE = new RegExp(`${OLD_SLUG_TEXT}-player`, "i");

const OLD_TITLE_ALLOWLIST = {
  historical: [
    "docs/spec/mvp.md",
    "docs/spec/release-r1.md",
    "docs/superpowers/plans/2026-08-22-aevum-season-1.md",
  ],
  compatibility: ["docs/migrations/aevum-rename.md"],
  technical: [".claude/skills/project-conventions/SKILL.md"],
};

const OLD_SLUG_ALLOWLIST = {
  historical: [
    "apps/player/public/reports/release-r1-verification.html",
    "docs/reports/release-r1-verification.md",
    "docs/superpowers/plans/2026-08-22-aevum-season-1.md",
    "docs/superpowers/specs/2026-08-22-aevum-season-1-design.md",
  ],
  compatibility: [
    "deploy/ai-battle-world.service",
    "deploy/ai-battle-world.timer",
    "docs/migrations/aevum-rename.md",
    "scripts/preflight.ts",
    "scripts/tend-world.sh",
  ],
  technical: [
    ".claude/settings.json",
    ".claude/skills/run-tournament/SKILL.md",
    "packages/agents/src/provider.ts",
  ],
};

const OLD_IMAGE_ALLOWLIST = {
  historical: [],
  compatibility: ["docs/migrations/aevum-rename.md"],
  technical: [],
};

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

/**
 * Ce que le dépôt publie, c'est ce qu'il versionne.
 *
 * Ce contrôle parcourait l'arbre de travail avec une liste d'exclusions, si
 * bien que n'importe quel fichier local le faisait tomber au milieu d'un
 * travail sans rapport : un cache d'outil qui se régénère à chaque édition
 * (`.impeccable/`), l'état d'un monde en cours de veille (`worlds/status.json`).
 * Chacun demandait une exclusion de plus, et aucun n'était publié. Demander la
 * liste à git supprime la liste et dit exactement ce que le test veut dire.
 */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

function mentions(pattern: RegExp): string[] {
  return trackedFiles()
    .filter((path) => {
      try {
        return pattern.test(readFileSync(resolve(ROOT, path), "utf8"));
      } catch {
        // Un fichier listé mais absent du disque : un suivi supprimé et pas
        // encore validé. Il n'est plus publié, il ne compte pas.
        return false;
      }
    })
    .sort();
}

function allowedPaths(allowlist: Record<string, string[]>): string[] {
  return Object.values(allowlist).flat().sort();
}

describe("public Aevum branding", () => {
  it("uses the public name in package and player metadata", () => {
    const rootPackage = JSON.parse(read("package.json"));
    const lockfile = JSON.parse(read("package-lock.json"));
    const playerPackage = JSON.parse(read("apps/player/package.json"));
    expect(rootPackage.name).toBe("aevum");
    expect(rootPackage.description).toContain(PRODUCT);
    expect(lockfile.name).toBe("aevum");
    expect(lockfile.packages[""].name).toBe("aevum");
    expect(playerPackage.name).toBe("@abs/player");
    expect(playerPackage.description).toContain(PRODUCT);
    expect(read("apps/player/index.html")).toContain(`<title>${PRODUCT}</title>`);
    expect(read("apps/player/src/App.vue")).toContain(`<h1>${PRODUCT}</h1>`);
  });

  it("publishes Aevum Docker names without changing replay mounts", () => {
    const compose = read("docker-compose.yml");
    expect(compose).toMatch(/^name: aevum$/m);
    expect(compose).toMatch(/^\s+image: aevum-player$/m);
    expect(compose).toContain("./replays:/usr/share/nginx/html/replays:ro");
    expect(compose).toContain("./worlds:/usr/share/nginx/html/worlds:ro");
    expect(read("Dockerfile")).toContain(`org.opencontainers.image.title="${PRODUCT}"`);
  });

  it("allows old branding only in explicit historical, compatibility, or technical paths", () => {
    expect(mentions(OLD_TITLE)).toEqual(allowedPaths(OLD_TITLE_ALLOWLIST));
    expect(mentions(OLD_SLUG)).toEqual(allowedPaths(OLD_SLUG_ALLOWLIST));
    expect(mentions(OLD_IMAGE)).toEqual(allowedPaths(OLD_IMAGE_ALLOWLIST));
  });
});
