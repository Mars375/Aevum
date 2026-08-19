/**
 * Build the catalogue of worlds the player offers.
 *
 * Worlds are not committed — a world lives on the machine that lives it — so
 * like the replay index this is generated at deploy time from whatever the
 * deployment happens to hold.
 *
 *   npm run index-worlds
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JournalSchema, isOver, living, replay } from "@abs/world";

const ROOT = resolve("worlds");
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
}

const entries: Entry[] = [];

for (const world of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const file of readdirSync(join(ROOT, world.name)).filter((f) => /^era-\d+\.json$/.test(f))) {
    const full = join(ROOT, world.name, file);
    const parsed = JournalSchema.safeParse(JSON.parse(readFileSync(full, "utf8")));
    if (!parsed.success) {
      console.warn(`ignore ${full} : ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const journal = parsed.data;
    // Recomputed, not stored — the same arithmetic the player will run.
    const final = replay(journal.origin, journal.rulings, journal.livedTo).world;
    const survivors = living(final);
    entries.push({
      path: `worlds/${world.name}/${file}`,
      world: world.name,
      era: journal.era,
      livedTo: journal.livedTo,
      rulings: journal.rulings.length,
      alive: survivors.length,
      over: isOver(final),
      survivor: isOver(final) && survivors[0] ? survivors[0].id : null,
    });
  }
}

entries.sort((a, b) => a.world.localeCompare(b.world) || b.era - a.era);
writeFileSync(resolve(ROOT, "index.json"), JSON.stringify(entries, null, 2));
console.log(`${entries.length} ere(s) indexee(s).`);
