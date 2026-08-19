/**
 * The tournament protocol from docs/reports/qa-audit.md.
 *
 * One battle cannot answer "which model commands best": the faction a model is
 * assigned to, and how often that model is actually served, both leak into the
 * result. This rotates every contender through every faction and reports
 * service rate next to score — because a model served 30% of the time did not
 * play badly, it did not play.
 *
 *   npm run tournament
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BattleConfigSchema,
  CompositionChoiceSchema,
  FACTION_IDS,
  GRID_SIZE,
  MAX_TURNS,
  ReplaySchema,
  type Archetype,
  type FactionId,
  type Replay,
} from "@abs/contracts";
import { resolveTurn } from "@abs/engine";
import {
  COMPOSITION_JSON_SCHEMA,
  DEFAULT_GENERALS,
  RemoteProvider,
  collectReports,
  compositionSystemPrompt,
  compositionUserPrompt,
  runBattleV2,
} from "@abs/agents";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* fall through to the real environment */
}

const apiKeys = { openrouter: process.env.OPENROUTER_API_KEY, groq: process.env.GROQ_API_KEY, nvidia: process.env.NVIDIA_API_KEY, mistral: process.env.MISTRAL_API_KEY };
if (!apiKeys.openrouter && !apiKeys.groq && !apiKeys.nvidia && !apiKeys.mistral) {
  console.error("No provider key set. Copy .env.example to .env.");
  process.exit(1);
}

/** A contender is a model plus the fallback chain that travels with it. */
const CONTENDERS = DEFAULT_GENERALS.map((g) => ({ model: g.model, fallbacks: g.fallbacks }));
const SEED = Number(process.env.ABS_TOURNAMENT_SEED ?? 42);
/**
 * Rotations to play. One full cycle is CONTENDERS.length; multiples give each
 * contender several passes through every corner. The first run used a single
 * cycle and left three of four contenders with 0-3 clean rotations — too few to
 * rank. More cycles is the only fix that buys statistics without loosening the
 * cleanliness rule.
 */
const ROTATIONS = Number(process.env.ABS_TOURNAMENT_ROTATIONS ?? CONTENDERS.length);
/** Ask each general to account for its battle, and audit the account. */
const WITH_REPORTS = process.env.ABS_TOURNAMENT_REPORTS !== "0";
const OUT = resolve("replays/tournament");
mkdirSync(OUT, { recursive: true });

interface Row {
  rotation: number;
  faction: FactionId;
  model: string;
  /** Share of this faction's calls actually served by its assigned model. */
  serviceRate: number;
  calls: number;
  finalHp: number;
  won: boolean;
  survived: boolean;
  /**
   * Share of this general's checkable report claims the replay confirms.
   * Null when it wrote nothing checkable — never conflated with zero.
   */
  fidelity: number | null;
  attacksLanded: number;
  attacksWasted: number;
}

const rows: Row[] = [];
const replays: Replay[] = [];

for (let rotation = 0; rotation < ROTATIONS; rotation += 1) {
  // Rotation r gives faction i the contender (i + r) mod 4, so every contender
  // sits in every corner exactly once and no positional residue survives.
  const generals = FACTION_IDS.map((factionId, i) => {
    const c = CONTENDERS[(i + rotation) % CONTENDERS.length]!;
    return { factionId, displayName: factionId, model: c.model, fallbacks: c.fallbacks };
  });

  // v2, on evidence: 200 scripted v1 battles end 9% in total annihilation and
  // 26% unseparable, so over a third teach nothing about who commanded better.
  // The same measurement on v2 gives 0% annihilation and 2% draws.
  const config = BattleConfigSchema.parse({
    rulesetVersion: "v2",
    seed: SEED + rotation,
    maxTurns: MAX_TURNS,
    gridSize: GRID_SIZE,
    generals,
  });
  const out = resolve(OUT, `rotation-${rotation}.json`);

  console.log(`\n=== rotation ${rotation + 1}/${ROTATIONS} (seed ${config.seed}) ===`);
  for (const g of generals) console.log(`  ${g.factionId.padEnd(8)} ${g.model}`);

  const provider = new RemoteProvider({
    apiKeys,
    maxTokens: Number(process.env.ABS_MAX_TOKENS ?? 6000),
    timeoutMs: Number(process.env.ABS_REQUEST_TIMEOUT_MS ?? 60_000),
    freeModelsOnly: process.env.ABS_FREE_MODELS_ONLY !== "0",
    ruleset: "v2",
  });

  let replay = await runBattleV2({
    config,
    provider,
    battleId: `tournament-r${rotation}`,
    // Every contender buys its own army, which is part of what is being judged.
    buyArmy: async (factionId, general) => {
      const raw = await provider.ask(
        general,
        compositionSystemPrompt(factionId),
        compositionUserPrompt(factionId),
        COMPOSITION_JSON_SCHEMA,
      );
      if (!raw) return null;
      const parsed = CompositionChoiceSchema.safeParse(JSON.parse(raw));
      return parsed.success ? (parsed.data.squads as Archetype[]) : null;
    },
    onTurn: (partial) => writeFileSync(out, JSON.stringify(partial, null, 2)),
    onProgress: (m) => {
      if (m.startsWith("turn ")) console.log(`  ${m}`);
    },
  });
  // Reports cost one extra call per general. Worth it: fidelity measures
  // something about the model itself, where a win depends heavily on luck and
  // on whichever quota happened to hold.
  if (WITH_REPORTS) replay = await collectReports(replay, generals, provider, (m) => console.log(m));

  ReplaySchema.parse(replay);
  writeFileSync(out, JSON.stringify(replay, null, 2));
  replays.push(replay);

  for (const g of generals) {
    const calls = replay.turns.flatMap((t) => t.decisions).filter((d) => d.factionId === g.factionId);
    const served = calls.filter((d) => d.telemetry.servedModel === g.model).length;
    const squads = replay.turns.at(-1)!.stateAfter.squads.filter((s) => s.factionId === g.factionId);
    const audit = replay.audits.find((a) => a.factionId === g.factionId);
    rows.push({
      rotation,
      faction: g.factionId,
      model: g.model,
      serviceRate: calls.length ? served / calls.length : 0,
      calls: calls.length,
      finalHp: squads.reduce((n, s) => n + s.hp, 0),
      won: replay.outcome.winner === g.factionId || replay.outcome.winners.includes(g.factionId),
      survived: squads.length > 0,
      fidelity: audit?.fidelity ?? null,
      attacksLanded: audit?.metrics.attacksLanded ?? 0,
      attacksWasted: audit?.metrics.attacksWasted ?? 0,
    });
  }
  console.log(`  -> ${replay.outcome.kind}${replay.outcome.winner ? ` ${replay.outcome.winner}` : ""}`);
}

// ---- Audit gate: a replay that does not reproduce is not counted ------------
console.log("\n=== audit: replaying recorded orders through the engine ===");
let auditOk = true;
replays.forEach((replay, i) => {
  const roster = replay.initialState.squads.map((s) => s.id);
  let state = replay.initialState;
  let diverged = 0;
  for (const turn of replay.turns) {
    const result = resolveTurn(
      state,
      turn.decisions.map((d) => ({ factionId: d.factionId, orders: d.orders })),
      roster,
      replay.manifest.config.gridSize,
    );
    if (JSON.stringify(result.state) !== JSON.stringify(turn.stateAfter)) diverged += 1;
    state = result.state;
  }
  if (diverged) auditOk = false;
  console.log(`  rotation ${i}: ${diverged === 0 ? "reproducible" : `${diverged} DIVERGENT TURNS`}`);
});

// ---- Ranking ---------------------------------------------------------------
const CLEAN = 1.0; // the audit protocol counts only battles a model played in full

const byModel = new Map<string, Row[]>();
for (const r of rows) byModel.set(r.model, [...(byModel.get(r.model) ?? []), r]);

const table = [...byModel.entries()]
  .map(([model, rs]) => {
    const clean = rs.filter((r) => r.serviceRate >= CLEAN);
    const avgService = rs.reduce((n, r) => n + r.serviceRate, 0) / rs.length;
    // Fidelity is averaged over rotations where it was measurable at all, and
    // over CLEAN ones only — grading a report written by somebody else's model
    // would measure the fallback, not the contender.
    const scored = clean.filter((r) => r.fidelity !== null);
    const landed = clean.reduce((n, r) => n + r.attacksLanded, 0);
    const wasted = clean.reduce((n, r) => n + r.attacksWasted, 0);
    return {
      model,
      rotations: rs.length,
      avgService,
      cleanRotations: clean.length,
      wins: clean.filter((r) => r.won).length,
      survived: clean.filter((r) => r.survived).length,
      hp: clean.reduce((n, r) => n + r.finalHp, 0),
      fidelity: scored.length ? scored.reduce((n, r) => n + (r.fidelity ?? 0), 0) / scored.length : null,
      fidelitySamples: scored.length,
      accuracy: landed + wasted > 0 ? landed / (landed + wasted) : null,
      rankable: clean.length > 0,
    };
  })
  .sort((a, b) => Number(b.rankable) - Number(a.rankable) || b.wins - a.wins || b.hp - a.hp);

console.log("\n=== SERVICE RATE (did it play at all?) ===");
console.log("model".padEnd(46) + "served   clean rotations");
for (const t of table) {
  console.log(`${t.model.padEnd(46)}${(t.avgService * 100).toFixed(0).padStart(5)}%   ${t.cleanRotations}/${t.rotations}`);
}

console.log("\n=== RANKING (clean rotations only) ===");
console.log("model".padEnd(46) + "wins  survived  hp   accuracy  fidelity");
for (const t of table) {
  if (!t.rankable) {
    console.log(`${t.model.padEnd(46)}NOT RANKED — never played a full battle on its own model`);
    continue;
  }
  const acc = t.accuracy === null ? "  n/a" : `${(t.accuracy * 100).toFixed(0).padStart(4)}%`;
  // "n/a" and 0% are different findings and must not look alike.
  const fid = t.fidelity === null ? "     n/a" : `${(t.fidelity * 100).toFixed(0).padStart(6)}% (${t.fidelitySamples})`;
  console.log(
    `${t.model.padEnd(46)}${String(t.wins).padStart(4)}  ${String(t.survived).padStart(8)}  ${String(t.hp).padStart(3)}   ${acc}  ${fid}`,
  );
}
console.log(
  "\naccuracy = attacks landed / attacks attempted, from the replay." +
    "\nfidelity = report claims the replay confirms, over checkable claims; the count in" +
    "\n           brackets is how many rotations it could be measured on. A win depends" +
    "\n           heavily on luck and on which quota held; fidelity does not.",
);

const totalCalls = replays.flatMap((r) => r.turns).flatMap((t) => t.decisions).length;
const cost = replays.flatMap((r) => r.turns).flatMap((t) => t.decisions).reduce((n, d) => n + d.telemetry.costUsd, 0);
console.log(`\n${replays.length} rotations, ${totalCalls} calls, $${cost.toFixed(4)}, audit ${auditOk ? "PASSED" : "FAILED"}`);

writeFileSync(resolve(OUT, "results.json"), JSON.stringify({ seed: SEED, rows, table, auditOk }, null, 2));
console.log(`results -> ${resolve(OUT, "results.json")}`);
