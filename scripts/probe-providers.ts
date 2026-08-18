/**
 * Re-run the provider survey behind docs/research/providers.md.
 *
 * Sends every roster model a realistic mid-battle prompt through the real
 * provider — same JSON mode, same ceilings — so what it measures is what
 * production does. Use it when the free-tier catalogue shifts.
 *
 *   npm run probe
 */
import { FACTION_IDS, GRID_SIZE, type GeneralConfig } from "@abs/contracts";
import { createInitialState, localViewFor, resolveTurn } from "@abs/engine";
import { DEFAULT_GENERALS, RemoteProvider, supportsNativeSchema } from "@abs/agents";

const apiKeys = { openrouter: process.env.OPENROUTER_API_KEY, groq: process.env.GROQ_API_KEY };
if (!apiKeys.openrouter && !apiKeys.groq) {
  console.error("Neither OPENROUTER_API_KEY nor GROQ_API_KEY is set.");
  process.exit(1);
}

const models = [...new Set(DEFAULT_GENERALS.flatMap((g) => [g.model, ...g.fallbacks]))];
const RUNS = Number(process.env.ABS_PROBE_RUNS ?? 1);

// Probe on a mid-battle position, not the deployment: turn-1 prompts are what
// made the first survey under-estimate the token budget.
let state = createInitialState(FACTION_IDS);
const roster = state.squads.map((s) => s.id);
for (let i = 0; i < 4; i += 1) {
  state = resolveTurn(
    state,
    FACTION_IDS.map((factionId) => ({
      factionId,
      orders: state.squads
        .filter((s) => s.factionId === factionId)
        .map((s) => ({ squadId: s.id, action: "MOVE" as const, target: { x: Math.min(15, Math.max(0, s.position.x + (s.position.x < 8 ? 2 : -2))), y: s.position.y } })),
    })),
    roster,
    GRID_SIZE,
  ).state;
}
const view = localViewFor(state, "crimson", 12, GRID_SIZE);

// No fallbacks: each model is measured on its own merits.
const provider = new RemoteProvider({ apiKeys, attemptsPerModel: 1 });

console.log(`Probing ${models.length} roster models, ${RUNS} run(s) each, on a turn-5 position.\n`);
console.log("model".padEnd(52) + "mode    ok   latency   tokens  error");

for (const model of models) {
  const general: GeneralConfig = { factionId: "crimson", displayName: "Crimson", model, fallbacks: [] };
  const results = [];
  for (let i = 0; i < RUNS; i += 1) results.push(await provider.decide(view, general));

  const good = results.filter((r) => r.decision && r.decision.orders.length === view.yourSquads.length).length;
  const lat = results.map((r) => `${(r.telemetry.latencyMs / 1000).toFixed(1)}s`).join("/");
  const tok = results.map((r) => r.telemetry.promptTokens + r.telemetry.completionTokens).join("/");
  const err = results.find((r) => r.telemetry.error)?.telemetry.error ?? "";
  const mode = supportsNativeSchema(model) ? "native" : "prompt";
  console.log(`${model.padEnd(52)}${mode.padEnd(8)}${good}/${RUNS}  ${lat.padEnd(9)} ${tok.padEnd(7)} ${err.slice(0, 52)}`);
}
