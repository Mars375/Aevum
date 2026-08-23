import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const PRODUCT = "Aevum — Chronique des mondes";
const PREDECESSOR = "AI Battle " + "Simulator";

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

function predecessorMentions(): string[] {
  const ignored = new Set([".git", ".superpowers", "dist", "node_modules"]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (readFileSync(path, "utf8").includes(PREDECESSOR)) files.push(relative(ROOT, path));
    }
  };
  walk(ROOT);
  return files.sort();
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

  it("keeps the historical replay query readable", () => {
    const app = read("apps/player/src/App.vue");
    expect(app).toContain('const requested = params.get("replay")');
    expect(app).toContain('requested.replace(/^replays\\//, "")');
    expect(app).toContain("loadFromUrl(requested)");
    expect(app).toContain('url.searchParams.set("replay", `replays/${path}`)');
  });

  it("allows the predecessor title only in historical or migration documents", () => {
    expect(predecessorMentions()).toEqual([
      ".claude/skills/project-conventions/SKILL.md",
      "docs/migrations/aevum-rename.md",
      "docs/spec/mvp.md",
      "docs/spec/release-r1.md",
      "docs/superpowers/plans/2026-08-22-aevum-season-1.md",
    ]);
  });
});
