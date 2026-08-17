/**
 * Re-run the provider survey behind docs/research/providers.md.
 *
 * Sends every candidate a realistic tactical prompt under the same strict JSON
 * schema the orchestrator uses, and reports validity, latency and token spend.
 * Use it when the free-tier catalogue shifts, then update the roster.
 *
 *   npm run probe
 */
import { GRID_SIZE, type GeneralConfig } from "@abs/contracts";
import { createInitialState, localViewFor } from "@abs/engine";
import { FACTION_IDS } from "@abs/contracts";
import { OpenRouterProvider } from "@abs/agents";

const CANDIDATES = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "dots-studio/dots-3-note-preview:free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
];

const RUNS = Number(process.env.ABS_PROBE_RUNS ?? 2);

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set.");
  process.exit(1);
}

const view = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);

// No fallbacks: the point is to measure each model on its own merits.
const provider = new OpenRouterProvider({ apiKey, attemptsPerModel: 1 });

console.log(`Probing ${CANDIDATES.length} models, ${RUNS} run(s) each.\n`);
console.log("model".padEnd(52) + "valid  latency        tokens   error");

for (const model of CANDIDATES) {
  const general: GeneralConfig = { factionId: "crimson", displayName: "Crimson", model, fallbacks: [] };
  const results = [];
  for (let i = 0; i < RUNS; i += 1) results.push(await provider.decide(view, general));

  const valid = results.filter((r) => r.decision !== null && r.decision.orders.length === view.yourSquads.length).length;
  const latency = results.map((r) => `${(r.telemetry.latencyMs / 1000).toFixed(1)}s`).join("/");
  const tokens = results.map((r) => r.telemetry.promptTokens + r.telemetry.completionTokens).join("/");
  const error = results.find((r) => r.telemetry.error)?.telemetry.error ?? "";

  console.log(`${model.padEnd(52)}${valid}/${RUNS}    ${latency.padEnd(15)}${tokens.padEnd(9)}${error.slice(0, 60)}`);
}
