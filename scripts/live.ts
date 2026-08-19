/**
 * Live the world forward.
 *
 * A world that never ends cannot be run in one sitting: the free quota runs out
 * long before the world does. So this is resumable by construction — it reads
 * the journal, recomputes the world from it (free, because the engine is
 * deterministic), lives forward as far as it is allowed, and writes it back.
 * Stopping is not a failure mode here; it is the normal one.
 *
 * The fairness rules — lockstep years, and decisions deferred rather than
 * dropped — live in `liveWorld` so they can be tested. This file is the part
 * that talks to disk and to a reader.
 *
 *   npm run live -- --ticks 200            live 200 years
 *   npm run live -- --ticks 200 --silent   live with no model at all
 *   npm run live -- --world alpha          keep several worlds side by side
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_GENERALS, RemoteProvider, liveWorld } from "@abs/agents";
import { JournalSchema, isOver, living, newJournal, newWorld, replay, type Journal } from "@abs/world";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* fall through to the real environment */
}

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const NAME = arg("world", "default");
const TICKS = Number(arg("ticks", "100"));
const SEED = Number(arg("seed", "42"));
const SILENT = flag("silent");

const DIR = resolve("worlds", NAME);
mkdirSync(DIR, { recursive: true });
const pathFor = (era: number) => resolve(DIR, `era-${String(era).padStart(4, "0")}.json`);

const FACTIONS = DEFAULT_GENERALS.map((g) => g.factionId);

function latestEra(): number {
  const eras = readdirSync(DIR)
    .map((f) => /^era-(\d+)\.json$/.exec(f)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  return eras.length > 0 ? Math.max(...eras) : 0;
}

/** A new era is a new world, seeded from the one before so the sequence stays reproducible. */
const openEra = (era: number): Journal => newJournal(newWorld(FACTIONS, SEED + era * 7919), era);

let era = latestEra();
let journal: Journal;
if (era === 0) {
  era = 1;
  journal = openEra(era);
} else {
  journal = JournalSchema.parse(JSON.parse(readFileSync(pathFor(era), "utf8")));
  // The world is never stored, only recomputed. This is why the journal stays
  // small no matter how long the world lives.
  if (isOver(replay(journal.origin, journal.rulings, journal.livedTo).world)) {
    era += 1;
    journal = openEra(era);
    console.log(`Ere ${era - 1} close. Ere ${era} ouverte.\n`);
  }
}

const from = replay(journal.origin, journal.rulings, journal.livedTo).world;

const apiKeys = {
  openrouter: process.env.OPENROUTER_API_KEY,
  groq: process.env.GROQ_API_KEY,
  nvidia: process.env.NVIDIA_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
};
const canAsk = !SILENT && Object.values(apiKeys).some(Boolean);
if (!SILENT && !canAsk) {
  console.error("Aucune cle de fournisseur. Le monde vivra sans dirigeants ; utilisez --silent pour l'assumer.");
}

const save = () => writeFileSync(pathFor(era), JSON.stringify(journal, null, 2));

const start = from.tick;
const result = await liveWorld(from, {
  journal,
  generals: DEFAULT_GENERALS,
  provider: canAsk ? new RemoteProvider({ apiKeys, freeModelsOnly: true }) : null,
  ticks: TICKS,
  onRuling: save,
  notify: (n) => {
    if (n.kind === "unruled") return;
    const where = `an ${String(n.tick).padStart(4)}`;
    if (n.kind === "era-closed") console.log(`\n  ${where} — l'ere ${era} s'acheve : ${n.text}`);
    else console.log(`  ${where}  ${(n.civ ?? "").padEnd(8)} ${n.text.slice(0, 100)}`);
  },
});

save();

console.log(`\nere ${era}, annees ${start} -> ${result.world.tick} (${result.lived} vecues)${result.closed ? " — close" : ""}`);
console.log(`journal : ${journal.rulings.length} decisions, ${(JSON.stringify(journal).length / 1024).toFixed(1)} Ko`);
console.log(`\n  civilisation  consultee  gouvernee  differee`);
for (const [id, t] of [...result.ledger].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${id.padEnd(13)} ${String(t.asked).padStart(8)} ${String(t.answered).padStart(10)} ${String(t.deferred).padStart(9)}`);
}
console.log();
for (const civ of result.world.civs) {
  const state = civ.fellOnTick === null ? "vivante" : `eteinte an ${civ.fellOnTick}`;
  console.log(`  ${civ.id.padEnd(8)} pop ${String(civ.population).padStart(6)}  terres ${String(civ.territory).padStart(4)}  soldats ${String(civ.soldiers).padStart(5)}  ${civ.doctrine.posture.padEnd(8)} progres ${civ.advances.length}  ${state}`);
  if (civ.doctrine.creed) console.log(`           « ${civ.doctrine.creed} »`);
}
if (result.closed) console.log(`\n${living(result.world).length === 1 ? living(result.world)[0]!.id + " reste seule." : "Personne ne reste."} Relancer ouvrira l'ere ${era + 1}.`);
