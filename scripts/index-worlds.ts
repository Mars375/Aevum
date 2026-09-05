/**
 * Build the catalogue of worlds the player offers.
 *
 * Worlds are not committed — a world lives on the machine that lives it — so
 * like the replay index this is generated at deploy time from whatever the
 * deployment happens to hold.
 *
 *   npm run index-worlds
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JournalSchema, WORLD_VERSION, fingerprint, isOver, living, replay, worldVersionOf } from "@abs/world";
import { LearningReportSchema, validateLearningReport, type LearningReport } from "./learning-curve.js";

const ROOT = resolve("worlds");
const PUBLIC_ROOT = resolve("apps/player/public/worlds");
if (!existsSync(ROOT)) {
  console.log("Aucun monde a indexer.");
  process.exit(0);
}

/**
 * Ce qui part dans le lecteur n'est pas ce que la machine héberge.
 *
 * `worlds/index.json` doit décrire tout ce que ce déploiement tient : c'est ce
 * que sert le montage Docker, qui recouvre entièrement `worlds/` à l'exécution.
 * La copie sous `apps/player/public/worlds/` est autre chose — elle est
 * versionnée, elle ne sert qu'aux constructions statiques, et elle ne doit
 * porter que le monde que le dépôt a choisi de publier.
 *
 * Les deux étaient écrites à l'identique. Sur une machine qui vivait onze
 * mondes, lancer ce script — ou la suite de tests, qui l'exécute — réécrivait
 * un fichier suivi avec des noms de mondes privés et déposait leurs journaux à
 * côté, prêts à être validés puis publiés.
 */
function trackedWorlds(): Set<string> | null {
  try {
    const files = execFileSync("git", ["ls-files", "-z", "worlds"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\0")
      .filter(Boolean);
    return new Set(files.map((path) => path.split("/")[1]).filter((name): name is string => Boolean(name)));
  } catch {
    return null;
  }
}

/**
 * Hors dépôt — une archive déployée, la racine temporaire d'un test — git n'a
 * pas d'avis, et le déploiement sert alors ce qu'il tient : c'est l'intention
 * d'origine de ce script. La restriction ne joue que là où il y a un dépôt à
 * salir.
 */
const tracked = trackedWorlds();
const publishes = (world: string) => tracked === null || tracked.has(world);

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
    if (journal.fingerprint === null || fingerprint(final) !== journal.fingerprint) {
      console.warn(`ignore ${full} : fingerprint does not match replay`);
      continue;
    }
    const survivors = living(final);
    const learningFile = file.replace(/\.json$/, ".learning.json");
    const learningFull = join(ROOT, world.name, learningFile);
    let learningCurvePath: string | undefined;
    if (existsSync(learningFull)) {
      try {
        const report = LearningReportSchema.parse(JSON.parse(readFileSync(learningFull, "utf8"))) as LearningReport;
        validateLearningReport(report, [journal]);
        if (report.sources.length !== 1 || report.sources[0] !== file) throw new Error("source journal path does not match");
        if (!report.world
          || report.world.worldVersion !== journal.worldVersion
          || report.world.seed !== journal.origin.seed
          || report.world.era !== journal.era
          || report.world.livedYears !== journal.livedTo
          || report.world.fingerprint !== journal.fingerprint) {
          throw new Error("world metadata does not match journal");
        }
        learningCurvePath = `worlds/${world.name}/${learningFile}`;
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

    if (!publishes(world.name)) continue;
    const publicDir = join(PUBLIC_ROOT, world.name);
    mkdirSync(publicDir, { recursive: true });
    copyFileSync(full, join(publicDir, file));
    if (learningCurvePath) copyFileSync(learningFull, join(publicDir, learningFile));
  }
}

entries.sort((a, b) => a.world.localeCompare(b.world) || b.era - a.era);
writeFileSync(resolve(ROOT, "index.json"), JSON.stringify(entries, null, 2));
mkdirSync(PUBLIC_ROOT, { recursive: true });
writeFileSync(join(PUBLIC_ROOT, "index.json"), JSON.stringify(entries.filter((entry) => publishes(entry.world)), null, 2));
console.log(`${entries.length} ere(s) indexee(s).`);
