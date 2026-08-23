/**
 * Read an era back: what happened, and to whom.
 *
 * The chronicle in the player is for watching; this is for checking. A claim
 * about a world ("the aggressor won", "posture X loses") is worth exactly as
 * much as the years it can point at, and pointing at years is easier from a
 * terminal than from a scrubber.
 *
 *   npx tsx scripts/era-report.ts worlds/premier/era-0001.json
 */
import { readFileSync } from "node:fs";
import { JournalSchema, chronicle, type Civ } from "@abs/world";

const path = process.argv[2];
if (!path) {
  console.error("usage: npx tsx scripts/era-report.ts <journal.json>");
  process.exit(1);
}

const journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
const years = chronicle(journal);
const ids = journal.origin.civs.map((c) => c.id);
const popOf = (year: (typeof years)[number], id: Civ["id"]) =>
  Math.round(year.world.civs.find((c) => c.id === id)!.population);

console.log(`\nEre ${journal.era} — ${journal.livedTo} annees, ${journal.rulings.length} decisions\n`);

const step = Math.max(1, Math.round(journal.livedTo / 12));
console.log(`  annee  ${ids.map((i) => i.padStart(8)).join("")}   (population)`);
for (let t = 0; t <= journal.livedTo; t += step) {
  const year = years.find((y) => y.tick === t);
  if (!year) continue;
  console.log(`  ${String(t).padStart(5)}  ${ids.map((i) => String(popOf(year, i)).padStart(8)).join("")}`);
}

console.log("\n  changements de posture");
for (const r of journal.rulings) {
  if (r.doctrine.posture) console.log(`    an ${String(r.tick).padStart(4)}  ${r.civ.padEnd(8)} ${r.doctrine.posture}`);
}

console.log("\n  terres prises par la force");
const seizures = years.flatMap((y) => y.events.filter((e) => e.kind === "SEIZED").map((e) => ({ tick: y.tick, e })));
if (seizures.length === 0) console.log("    aucune");
else {
  // Grouped: twenty consecutive lines saying the same thing hide the shape of
  // a war instead of showing it.
  let runFrom = seizures[0]!.tick;
  for (let i = 0; i < seizures.length; i += 1) {
    const cur = seizures[i]!;
    const next = seizures[i + 1];
    if (next && next.e.civ === cur.e.civ && next.e.detail === cur.e.detail && next.tick === cur.tick + 1) continue;
    console.log(`    an ${runFrom}${cur.tick > runFrom ? `-${cur.tick}` : ""}  ${cur.e.civ} : ${cur.e.detail}`);
    if (next) runFrom = next.tick;
  }
}

console.log("\n  a la fin");
for (const civ of years.at(-1)!.world.civs) {
  const state = civ.fellOnTick === null ? "vivante" : `eteinte an ${civ.fellOnTick}`;
  console.log(`    ${civ.id.padEnd(8)} pop ${String(civ.population).padStart(5)}  terres ${String(civ.territory).padStart(3)}  ${civ.doctrine.posture.padEnd(8)} ${state}`);
  if (civ.doctrine.creed) console.log(`             « ${civ.doctrine.creed} »`);
}
console.log();
