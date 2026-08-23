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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_GENERALS,
  RemoteProvider,
  ScriptedRulerProvider,
  ScriptedCampaignSchema,
  liveWorld,
  type ProvenancedRulerProvider,
} from "@abs/agents";
import {
  JournalSchema,
  WORLD_VERSION,
  fingerprint,
  isOver,
  living,
  newJournal,
  newWorld,
  replay,
  worldVersionOf,
  type Journal,
} from "@abs/world";
import { buildLearningReport } from "./learning-curve.js";

interface Arguments {
  world: string;
  ticks?: number;
  seed?: number;
  silent: boolean;
  out?: string;
  resume: boolean;
  scripted?: string;
  warmup: number;
}

function parseArguments(args: string[]): Arguments {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = new Set(["world", "ticks", "seed", "out", "scripted", "warmup"]);
  const flagOptions = new Set(["silent", "resume"]);
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]!;
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const equal = token.indexOf("=");
    const name = token.slice(2, equal >= 0 ? equal : undefined);
    if (flagOptions.has(name)) {
      if (equal >= 0) throw new Error(`--${name} does not take a value`);
      if (flags.has(name)) throw new Error(`duplicate option: --${name}`);
      flags.add(name);
      continue;
    }
    if (!valueOptions.has(name)) throw new Error(`unknown option: --${name}`);
    if (values.has(name)) throw new Error(`duplicate option: --${name}`);
    const value = equal >= 0 ? token.slice(equal + 1) : args[++i];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  const number = (name: "ticks" | "seed" | "warmup", fallback?: number): number | undefined => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`--${name} must be a non-negative integer`);
    }
    return parsed;
  };
  const world = values.get("world") ?? "default";
  if (!/^[A-Za-z0-9._-]+$/.test(world)) throw new Error("--world must be a safe non-empty name");
  return {
    world,
    ticks: number("ticks"),
    seed: number("seed"),
    silent: flags.has("silent"),
    out: values.get("out"),
    resume: flags.has("resume"),
    scripted: values.get("scripted"),
    warmup: number("warmup", 0)!,
  };
}

const args = parseArguments(process.argv.slice(2));
if (args.silent && args.scripted) throw new Error("--silent and --scripted are distinct modes and cannot be combined");
if (args.resume && !args.out) throw new Error("--resume requires --out");

const NAME = args.world;
const SILENT = args.silent;
const OUT = args.out ?? "";
const RESUME = args.resume;
const SCRIPTED = args.scripted;
/**
 * Années vécues sans consulter personne avant que les dirigeants ne prennent la
 * main. Gratuites, et utiles pour observer un monde déjà noué — mais mesurées
 * comme mauvaises pour comparer des modèles, voir docs/reports/board-noise.md.
 */
const WARMUP = args.warmup;

let script: ReturnType<typeof ScriptedCampaignSchema.parse> | null = null;
let provider: ProvenancedRulerProvider | null = null;
if (SCRIPTED) {
  const bytes = readFileSync(resolve(SCRIPTED));
  const fixtureDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  script = ScriptedCampaignSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (args.seed !== undefined && args.seed !== script.seed) {
    throw new Error(`seed ${args.seed} does not match scripted fixture seed ${script.seed}`);
  }
  provider = new ScriptedRulerProvider((general, point) => {
    if (general.factionId === script!.survivor) return script!.survivorDoctrine;
    return point.tick < script!.transitionTick ? script!.beforeTransition : script!.afterTransition;
  }, fixtureDigest);
} else if (!SILENT) {
  try {
    process.loadEnvFile(resolve(process.cwd(), ".env"));
  } catch {
    /* fall through to the real environment */
  }
  const apiKeys = {
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
  };
  if (Object.values(apiKeys).some(Boolean)) provider = new RemoteProvider({ apiKeys, freeModelsOnly: true });
  else console.error("Aucune cle de fournisseur. Le monde vivra sans dirigeants ; utilisez --silent pour l'assumer.");
}
const execution = provider?.execution ?? { mode: "SILENT_ENGINE_ONLY", fixtureDigest: null } as const;
const TICKS = args.ticks ?? script?.ticks ?? 100;

const DIR = resolve("worlds", NAME);
mkdirSync(DIR, { recursive: true });
const explicitPath = OUT ? resolve(OUT) : null;
if (explicitPath) mkdirSync(dirname(explicitPath), { recursive: true });
const pathFor = (era: number) => explicitPath ?? resolve(DIR, `era-${String(era).padStart(4, "0")}.json`);

const FACTIONS = DEFAULT_GENERALS.map((g) => g.factionId);

function latestEra(): number {
  const eras = readdirSync(DIR)
    .map((f) => /^era-(\d+)\.json$/.exec(f)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  return eras.length > 0 ? Math.max(...eras) : 0;
}

/** A new era is a new world, seeded from the one before so the sequence stays reproducible. */
let baseSeed = args.seed ?? script?.seed ?? 42;
const openEra = (era: number): Journal => newJournal(newWorld(FACTIONS, baseSeed + era * 7919), era, execution);

function assertExecution(journal: Journal): void {
  if (journal.execution === null) throw new Error("resumed journal has no immutable execution provenance");
  if (JSON.stringify(journal.execution) !== JSON.stringify(execution)) {
    throw new Error(`execution ${JSON.stringify(execution)} does not match resumed journal ${JSON.stringify(journal.execution)}`);
  }
}

let era = explicitPath ? 1 : latestEra();
let journal: Journal;
if (explicitPath && RESUME) {
  if (!existsSync(explicitPath)) throw new Error(`--resume requires an existing journal: ${explicitPath}`);
  const raw: unknown = JSON.parse(readFileSync(explicitPath, "utf8"));
  const version = worldVersionOf(raw);
  if (version !== WORLD_VERSION) throw new Error(`${explicitPath} uses ${version ?? "unknown"}, expected ${WORLD_VERSION}`);
  journal = JournalSchema.parse(raw);
  era = journal.era;
  if (args.seed !== undefined && journal.origin.seed !== args.seed) throw new Error(`seed ${args.seed} does not match resumed journal seed ${journal.origin.seed}`);
  if (args.seed === undefined) baseSeed = journal.origin.seed;
  assertExecution(journal);
} else if (explicitPath) {
  journal = newJournal(newWorld(FACTIONS, baseSeed), 1, execution);
} else if (era === 0) {
  era = 1;
  journal = openEra(era);
} else {
  const raw = JSON.parse(readFileSync(pathFor(era), "utf8"));
  const version = worldVersionOf(raw);
  if (version !== WORLD_VERSION) {
    console.error(
      `${pathFor(era)} a ete vecu sous les regles ${version ?? "inconnues"} ; le monde tourne aujourd'hui en ${WORLD_VERSION}.\n` +
        `Ce journal reste lisible comme archive mais n'est plus rejouable. Utilisez --world <autre-nom> pour ouvrir un monde neuf.`,
    );
    process.exit(1);
  }
  journal = JournalSchema.parse(raw);
  if (args.seed === undefined) baseSeed = journal.origin.seed - era * 7919;
  else if (journal.origin.seed !== baseSeed + era * 7919) throw new Error(`seed ${baseSeed} does not match resumed journal seed ${journal.origin.seed}`);
  assertExecution(journal);
  // The world is never stored, only recomputed. This is why the journal stays
  // small no matter how long the world lives.
  if (isOver(replay(journal.origin, journal.rulings, journal.livedTo).world)) {
    era += 1;
    journal = openEra(era);
    console.log(`Ere ${era - 1} close. Ere ${era} ouverte.\n`);
  }
}

const from = replay(journal.origin, journal.rulings, journal.livedTo).world;

// A world is lived in several sittings, and each one rebuilds the state by
// replaying the journal. If that replay ever disagrees with what was actually
// lived, continuing would write decisions into a history that never happened.
if (journal.fingerprint !== null && journal.fingerprint !== fingerprint(from)) {
  console.error(
    `Ce monde ne se rejoue plus comme il a ete vecu.\n` +
      `  attendu ${journal.fingerprint}, recalcule ${fingerprint(from)} a l'an ${from.tick}\n` +
      `Les regles ou le moteur ont change entre deux seances. Le journal reste lisible comme\n` +
      `archive, mais le continuer ecrirait des decisions dans une histoire qui n'a pas eu lieu.\n` +
      `Ouvrir un monde neuf avec --world <autre-nom>.`,
  );
  process.exit(1);
}

let lastWorld = from;
const save = () => {
  journal.fingerprint = fingerprint(lastWorld);
  writeFileSync(pathFor(era), JSON.stringify(JournalSchema.parse(journal), null, 2));
};

const start = from.tick;
const result = await liveWorld(from, {
  journal,
  generals: DEFAULT_GENERALS,
  provider,
  ticks: explicitPath && RESUME && isOver(from) ? 0 : TICKS,
  warmup: Math.max(0, WARMUP - from.tick),
  onRuling: (j, world) => {
    lastWorld = world;
    save();
  },
  notify: (n) => {
    if (n.kind === "unruled") return;
    const where = `an ${String(n.tick).padStart(4)}`;
    if (n.kind === "era-closed") console.log(`\n  ${where} — l'ere ${era} s'acheve : ${n.text}`);
    else console.log(`  ${where}  ${(n.civ ?? "").padEnd(8)} ${n.text.slice(0, 100)}`);
  },
});

lastWorld = result.world;
save();

if (explicitPath) {
  const metricPath = explicitPath.endsWith(".json")
    ? explicitPath.replace(/\.json$/, ".learning.json")
    : `${explicitPath}.learning.json`;
  const report = buildLearningReport([explicitPath], {
    windowSize: 40,
    minimumServiceRate: 0.7,
  });
  writeFileSync(metricPath, `${JSON.stringify(report, null, 2)}\n`);
}

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
