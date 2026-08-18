import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { BattleConfigSchema, GRID_SIZE, MAX_TURNS, ReplaySchema } from "@abs/contracts";
import { DEFAULT_GENERALS, OpenRouterProvider, ScriptedProvider, chargeNearest, runBattle } from "@abs/agents";

// .env is optional: the scripted provider needs no key at all.
try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* no .env, fall through to the real environment */
}

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "42" },
    turns: { type: "string", default: String(MAX_TURNS) },
    out: { type: "string" },
    scripted: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`Usage: npm run battle -- [options]

  --seed <n>      Battle seed, recorded in the manifest       (default 42)
  --turns <n>     Turn limit                                   (default ${MAX_TURNS})
  --out <path>    Replay destination           (default replays/<battleId>.json)
  --scripted      Play offline with the baseline AI, no API calls, no key
  --help          This message

Remote battles need OPENROUTER_API_KEY. Only ":free" models are ever called;
the budget ceiling is 0 EUR and the orchestrator refuses paid models outright.`);
  process.exit(0);
}

const config = BattleConfigSchema.parse({
  seed: Number(values.seed),
  maxTurns: Number(values.turns),
  gridSize: GRID_SIZE,
  generals: DEFAULT_GENERALS,
});

let provider;
if (values.scripted) {
  console.log("Scripted battle — no network, no key, fully reproducible.\n");
  provider = new ScriptedProvider(chargeNearest);
} else {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set. Copy .env.example to .env, or pass --scripted to play offline.");
    process.exit(1);
  }
  console.log("Remote battle over OpenRouter free models. Expect several minutes.\n");
  for (const g of config.generals) console.log(`  ${g.factionId.padEnd(8)} ${g.model}`);
  console.log();
  provider = new OpenRouterProvider({
    apiKey,
    maxTokens: Number(process.env.ABS_MAX_TOKENS ?? 6000),
    timeoutMs: Number(process.env.ABS_REQUEST_TIMEOUT_MS ?? 60_000),
    freeModelsOnly: process.env.ABS_FREE_MODELS_ONLY !== "0",
  });
}

const replay = await runBattle({ config, provider, onProgress: (m) => console.log(m) });

// Validate before writing: a replay that fails its own schema must never land
// on disk and be taken for a valid artefact.
ReplaySchema.parse(replay);

const outPath = resolve(values.out ?? `replays/${replay.manifest.battleId}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(replay, null, 2));

const cost = replay.turns.flatMap((t) => t.decisions).reduce((sum, d) => sum + d.telemetry.costUsd, 0);
const fallbacks = replay.turns
  .flatMap((t) => t.decisions)
  .filter((d) => d.telemetry.fellBack).length;
const unreachable = replay.turns.flatMap((t) => t.events).filter((e) => e.type === "GENERAL_UNREACHABLE").length;

console.log(`
${replay.outcome.kind}${replay.outcome.winner ? ` — ${replay.outcome.winner}` : ""}
${replay.outcome.reason}

turns played  ${replay.turns.length}
fallbacks     ${fallbacks}
unreachable   ${unreachable}
cost          $${cost.toFixed(4)}
replay        ${outPath}`);
