/**
 * Build the catalogue of worlds the player offers.
 *
 * Worlds are not committed — a world lives on the machine that lives it — so
 * like the replay index this is generated at deploy time from whatever the
 * deployment happens to hold.
 *
 *   npm run index-worlds
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JournalSchema, WORLD_VERSION, isOver, living, replay, worldVersionOf } from "@abs/world";

const ROOT = resolve("worlds");
const PUBLIC_ROOT = resolve("apps/player/public/worlds");
if (!existsSync(ROOT)) {
  console.log("Aucun monde a indexer.");
  process.exit(0);
}

interface Entry {
  path: string;
  world: string;
  era: number;
  livedTo: number;
  rulings: number;
  alive: number;
  over: boolean;
  survivor: string | null;
  worldVersion: string;
  seed: number;
  learningCurvePath?: string;
  reportSlug?: string;
}

const entries: Entry[] = [];

for (const world of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const file of readdirSync(join(ROOT, world.name)).filter((f) => /^era-\d+\.json$/.test(f))) {
    const full = join(ROOT, world.name, file);
    const raw = JSON.parse(readFileSync(full, "utf8"));
    const version = worldVersionOf(raw);
    if (version !== WORLD_VERSION) {
      // Kept on disk as a record, left out of the catalogue: the player would
      // recompute it under today's rules and show numbers it never lived.
      console.log(`archive ${full} : regles ${version ?? "inconnues"}, le monde tourne en ${WORLD_VERSION}`);
      continue;
    }
    const parsed = JournalSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`ignore ${full} : ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const journal = parsed.data;
    // Recomputed, not stored — the same arithmetic the player will run.
    const final = replay(journal.origin, journal.rulings, journal.livedTo).world;
    const survivors = living(final);
    const learningFile = file.replace(/\.json$/, ".learning.json");
    const learningFull = join(ROOT, world.name, learningFile);
    let learningCurvePath: string | undefined;
    if (existsSync(learningFull)) {
      try {
        const report = JSON.parse(readFileSync(learningFull, "utf8")) as { protocol?: unknown; sources?: unknown };
        if (report.protocol === "aevum-learning-curve-v1"
          && Array.isArray(report.sources)
          && report.sources.length === 1
          && report.sources[0] === file) {
          learningCurvePath = `worlds/${world.name}/${learningFile}`;
        } else console.warn(`ignore ${learningFull} : sidecar incompatible`);
      } catch (error) {
        console.warn(`ignore ${learningFull} : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const reportSlug = existsSync(resolve("apps/player/public/reports", `${world.name}.html`)) ? world.name : undefined;
    entries.push({
      path: `worlds/${world.name}/${file}`,
      world: world.name,
      era: journal.era,
      livedTo: journal.livedTo,
      rulings: journal.rulings.length,
      alive: survivors.length,
      over: isOver(final),
      survivor: isOver(final) && survivors[0] ? survivors[0].id : null,
      worldVersion: journal.worldVersion,
      seed: journal.origin.seed,
      ...(learningCurvePath ? { learningCurvePath } : {}),
      ...(reportSlug ? { reportSlug } : {}),
    });

    const publicDir = join(PUBLIC_ROOT, world.name);
    mkdirSync(publicDir, { recursive: true });
    copyFileSync(full, join(publicDir, file));
    if (learningCurvePath) copyFileSync(learningFull, join(publicDir, learningFile));
  }
}

entries.sort((a, b) => a.world.localeCompare(b.world) || b.era - a.era);
writeFileSync(resolve(ROOT, "index.json"), JSON.stringify(entries, null, 2));
mkdirSync(PUBLIC_ROOT, { recursive: true });
writeFileSync(join(PUBLIC_ROOT, "index.json"), JSON.stringify(entries, null, 2));
console.log(`${entries.length} ere(s) indexee(s).`);
