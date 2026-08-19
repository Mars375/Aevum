/**
 * Live the world forward.
 *
 * A world that never ends cannot be run in one sitting: the free quota runs out
 * long before the world does. So this is resumable by construction — it reads
 * the journal, recomputes the world from it (free, because the engine is
 * deterministic), lives forward as far as it is allowed, and writes it back.
 * Stopping is not a failure mode here; it is the normal one.
 *
 * Two rules protect fairness, because the quota is shared and unfair by nature:
 *
 *   - the world advances in lockstep. Every civilisation lives the same year at
 *     the same time; none runs ahead because its model happened to be served.
 *   - a decision that cannot be served is deferred, never dropped. It goes to
 *     the front of the queue and is asked as soon as a model answers again, so
 *     a rate-limited civilisation is governed late rather than not at all.
 *
 *   npm run live -- --ticks 200            live 200 years
 *   npm run live -- --ticks 200 --silent   live with no model at all
 *   npm run live -- --world alpha          keep several worlds side by side
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GeneralConfig } from "@abs/contracts";
import { DEFAULT_GENERALS, RemoteProvider, askRuler } from "@abs/agents";
import {
  JournalSchema,
  applyRuling,
  detectDecisions,
  isOver,
  living,
  newJournal,
  newWorld,
  replay,
  tickWorld,
  type DecisionPoint,
  type Journal,
} from "@abs/world";

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
/** Live with no model at all: the engine alone, doctrines frozen. Costs nothing. */
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

function loadEra(era: number): Journal {
  return JournalSchema.parse(JSON.parse(readFileSync(pathFor(era), "utf8")));
}

/** A new era is a new world, seeded from the one before so the sequence stays reproducible. */
const openEra = (era: number): Journal => newJournal(newWorld(FACTIONS, SEED + era * 7919), era);

let era = latestEra();
let journal: Journal;
if (era === 0) {
  era = 1;
  journal = openEra(era);
} else {
  journal = loadEra(era);
  // The world is never stored, only recomputed. This is why the journal stays
  // small no matter how long the world lives.
  if (isOver(replay(journal.origin, journal.rulings, journal.livedTo).world)) {
    era += 1;
    journal = openEra(era);
    console.log(`Ere ${era - 1} close. Ere ${era} ouverte.\n`);
  }
}

let world = replay(journal.origin, journal.rulings, journal.livedTo).world;

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

const provider = canAsk ? new RemoteProvider({ apiKeys, freeModelsOnly: true }) : null;
const generalOf = new Map<string, GeneralConfig>(DEFAULT_GENERALS.map((g) => [g.factionId, g]));

/** Per civilisation, so an imbalance shows up as a number rather than a feeling. */
const ledger = new Map<string, { asked: number; answered: number; deferred: number }>(
  FACTIONS.map((f) => [f, { asked: 0, answered: 0, deferred: 0 }]),
);

/**
 * Decisions raised but not yet answered.
 *
 * At most one per civilisation: if a ruler is still queued when its world
 * raises a fresh question, the fresh one replaces it — an unanswered famine
 * from ten years ago is not what the ruler should be deciding today.
 */
const pending = new Map<string, DecisionPoint>();

const save = () => {
  journal.livedTo = world.tick;
  writeFileSync(pathFor(era), JSON.stringify(journal, null, 2));
};

const start = world.tick;
let lived = 0;
let closed = false;

for (let i = 0; i < TICKS; i += 1) {
  const stepped = tickWorld(world);
  world = stepped.world;
  lived += 1;

  for (const event of stepped.events) {
    if (event.kind === "COLLAPSED" || event.kind === "ADVANCE" || event.kind === "SEIZED" || event.kind === "RAIDED") {
      console.log(`  an ${String(event.tick).padStart(4)}  ${event.civ.padEnd(8)} ${event.detail}`);
    }
  }

  for (const point of detectDecisions(world, stepped.events)) pending.set(point.civ, point);

  // The barrier: every pending decision is attempted before the year turns.
  // Nobody lives year N+1 while somebody else is still deciding year N.
  for (const [civId, point] of [...pending].sort((a, b) => a[0].localeCompare(b[0]))) {
    const civ = world.civs.find((c) => c.id === civId)!;
    const general = generalOf.get(civId);
    const tally = ledger.get(civId)!;

    if (!provider || !general) {
      // Nobody answers at all. The world carries on under the standing
      // doctrine — silence has to be survivable or a continuous world stops.
      pending.delete(civId);
      world = { ...world, civs: world.civs.map((c) => (c.id === civId ? { ...c, ticksSinceDecision: 0 } : c)) };
      continue;
    }

    tally.asked += 1;
    let rejection: string | null = null;
    const ruling = await askRuler(provider, general, civ, point, (why, raw) => {
      rejection = `${why} | ${raw.slice(0, 120)}`;
    });

    if (ruling === null) {
      // Deferred, not dropped. This is the whole fairness rule: a civilisation
      // whose model is rate-limited is governed late, never left ungoverned.
      tally.deferred += 1;
      console.log(`  an ${String(world.tick).padStart(4)}  ${civId.padEnd(8)} ${point.kind} — differe (${rejection ?? provider.lastError() ?? "?"})`);
      continue;
    }

    tally.answered += 1;
    pending.delete(civId);
    ruling.deferredBy = world.tick - point.tick;
    journal.rulings.push(ruling);
    world = applyRuling(world, ruling);
    const late = ruling.deferredBy > 0 ? ` [+${ruling.deferredBy} ans d'attente]` : "";
    console.log(`  an ${String(point.tick).padStart(4)}  ${civId.padEnd(8)} ${point.kind}${late} — ${ruling.reason.slice(0, 80)}`);

    // Written after every ruling: a quota that runs out mid-run must not cost
    // the world the years it already lived.
    save();
  }

  if (isOver(world)) {
    const survivor = living(world)[0];
    console.log(`\n  an ${world.tick} — l'ere ${era} s'acheve. ${survivor ? `${survivor.id} reste seule.` : "Personne ne reste."}`);
    closed = true;
    break;
  }
}

save();

console.log(`\nere ${era}, annees ${start} -> ${world.tick} (${lived} vecues)${closed ? " — close" : ""}`);
console.log(`journal : ${journal.rulings.length} decisions, ${(JSON.stringify(journal).length / 1024).toFixed(1)} Ko`);
console.log(`\n  civilisation  consultee  gouvernee  differee`);
for (const [id, t] of [...ledger].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${id.padEnd(13)} ${String(t.asked).padStart(8)} ${String(t.answered).padStart(10)} ${String(t.deferred).padStart(9)}`);
}
console.log();
for (const c of world.civs) {
  const state = c.fellOnTick === null ? "vivante" : `eteinte an ${c.fellOnTick}`;
  console.log(`  ${c.id.padEnd(8)} pop ${String(c.population).padStart(6)}  terres ${String(c.territory).padStart(4)}  soldats ${String(c.soldiers).padStart(5)}  ${c.doctrine.posture.padEnd(8)} progres ${c.advances.length}  ${state}`);
  if (c.doctrine.creed) console.log(`           « ${c.doctrine.creed} »`);
}
if (closed) console.log(`\nRelancer ouvrira l'ere ${era + 1}.`);
