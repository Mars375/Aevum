/**
 * Live the world forward.
 *
 * A world that never ends cannot be run in one sitting: the free quota runs
 * out long before the world does. So this is resumable by construction — it
 * reads the journal, recomputes the world from it (free, because the engine is
 * deterministic), lives forward as far as it is allowed, and writes the journal
 * back. Stopping is not a failure mode here; it is the normal one.
 *
 *   npm run live -- --ticks 200          live 200 years, consulting rulers
 *   npm run live -- --ticks 200 --silent live without any model at all
 *   npm run live -- --world alpha        keep several worlds side by side
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GeneralConfig } from "@abs/contracts";
import { DEFAULT_GENERALS, RemoteProvider, askRuler } from "@abs/agents";
import {
  JournalSchema,
  WORLD_VERSION,
  applyRuling,
  detectDecisions,
  newCiv,
  newJournal,
  replay,
  tickWorld,
  type Journal,
  type World,
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

const DIR = resolve("worlds");
mkdirSync(DIR, { recursive: true });
const PATH = resolve(DIR, `${NAME}.json`);

const FACTIONS = DEFAULT_GENERALS.map((g) => g.factionId);

function load(): Journal {
  if (!existsSync(PATH)) {
    const origin: World = { worldVersion: WORLD_VERSION, tick: 0, seed: SEED, civs: FACTIONS.map(newCiv) };
    return newJournal(origin);
  }
  return JournalSchema.parse(JSON.parse(readFileSync(PATH, "utf8")));
}

const journal = load();
// The world is never stored, only recomputed. This is the whole reason the
// journal stays small no matter how long the world lives.
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

const start = world.tick;
let asked = 0;
let answered = 0;

for (let i = 0; i < TICKS; i += 1) {
  const stepped = tickWorld(world);
  world = stepped.world;

  for (const event of stepped.events) {
    if (event.kind === "COLLAPSED" || event.kind === "ADVANCE") {
      console.log(`  an ${String(event.tick).padStart(4)}  ${event.civ.padEnd(8)} ${event.detail}`);
    }
  }

  for (const point of detectDecisions(world, stepped.events)) {
    const civ = world.civs.find((c) => c.id === point.civ)!;
    const general = generalOf.get(point.civ);
    if (!provider || !general) {
      // Nobody answers. The world carries on under the standing doctrine —
      // silence has to be survivable or a continuous world stops being continuous.
      world = { ...world, civs: world.civs.map((c) => (c.id === point.civ ? { ...c, ticksSinceDecision: 0 } : c)) };
      continue;
    }

    asked += 1;
    let rejection: string | null = null;
    const ruling = await askRuler(provider, general, civ, point, (why, raw) => {
      rejection = `${why} | ${raw.slice(0, 160)}`;
    });
    if (ruling === null) {
      console.log(`  an ${String(point.tick).padStart(4)}  ${point.civ.padEnd(8)} ${point.kind} — sans reponse (${rejection ?? provider.lastError() ?? "aucun modele joignable"})`);
      world = { ...world, civs: world.civs.map((c) => (c.id === point.civ ? { ...c, ticksSinceDecision: 0 } : c)) };
      continue;
    }

    answered += 1;
    journal.rulings.push(ruling);
    world = applyRuling(world, ruling);
    console.log(`  an ${String(point.tick).padStart(4)}  ${point.civ.padEnd(8)} ${point.kind} — ${ruling.reason.slice(0, 90)}`);

    // Written after every ruling, not at the end: a quota that runs out mid-run
    // must not cost the world the years it already lived.
    journal.livedTo = world.tick;
    writeFileSync(PATH, JSON.stringify(journal, null, 2));
  }
}

journal.livedTo = world.tick;
writeFileSync(PATH, JSON.stringify(journal, null, 2));

console.log(`\nannees ${start} -> ${world.tick}  (${TICKS} vecues)`);
console.log(`dirigeants consultes : ${asked}, reponses retenues : ${answered}`);
console.log(`journal : ${journal.rulings.length} decisions, ${(JSON.stringify(journal).length / 1024).toFixed(1)} Ko\n`);
for (const c of world.civs) {
  const state = c.fellOnTick === null ? "vivante" : `eteinte an ${c.fellOnTick}`;
  console.log(`  ${c.id.padEnd(8)} pop ${String(c.population).padStart(6)}  terres ${String(c.territory).padStart(4)}  soldats ${String(c.soldiers).padStart(5)}  progres ${c.advances.length}  ${state}`);
  if (c.doctrine.creed) console.log(`           « ${c.doctrine.creed} »`);
}
