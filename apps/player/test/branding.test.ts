import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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
    "CLAUDE.md",
    "packages/agents/src/provider.ts",
  ],
};

const OLD_IMAGE_ALLOWLIST = {
  historical: [],
  compatibility: ["docs/migrations/aevum-rename.md"],
  technical: [],
};

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

function mentions(pattern: RegExp): string[] {
  const ignored = new Set([".git", ".superpowers", "dist", "node_modules"]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (pattern.test(readFileSync(path, "utf8"))) files.push(relative(ROOT, path));
    }
  };
  walk(ROOT);
  return files.sort();
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
