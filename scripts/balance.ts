/**
 * Measure the distribution of battle outcomes, offline.
 *
 * Two battles in four ended in total annihilation once the generals could aim,
 * which teaches nothing about who commanded better and never lets the
 * hp tie-break apply. That is a tuning question, and tuning by intuition is how
 * you get a second one. This plays hundreds of scripted battles — no API, no
 * quota, fully deterministic — and reports what actually happens.
 *
 *   npm run balance                          # v1, what the tournament plays
 *   ABS_BALANCE_RULESET=v2 npm run balance
 *   ABS_BALANCE_N=400 npm run balance
 */
import { ARCHETYPES, FACTION_IDS, GRID_SIZE, MAX_TURNS, type Archetype, type FactionId } from "@abs/contracts";
import { ScriptedProvider, seededCharge, runBattle, runBattleV2 } from "@abs/agents";

const N = Number(process.env.ABS_BALANCE_N ?? 200);
// v1 by default, because that is the ruleset the tournament actually plays —
// measuring v2 would have told us about a game nobody is scoring.
const RULESET = (process.env.ABS_BALANCE_RULESET ?? "v1") as "v1" | "v2";
const COMPOSITION: Archetype[] = ["MELEE", "RANGED", "SCOUT"];

interface Result {
  kind: string;
  turns: number;
  survivors: number;
  factionsAlive: number;
  hits: number;
  hpSpread: number;
}

async function play(seed: number): Promise<Result> {
  const config = {
    rulesetVersion: RULESET,
    seed,
    maxTurns: MAX_TURNS,
    gridSize: GRID_SIZE,
    generals: FACTION_IDS.map((factionId) => ({ factionId, displayName: factionId, model: "scripted", fallbacks: [] })),
  };
  const provider = new ScriptedProvider(seededCharge(seed));
  const common = { config, provider, battleId: `balance-${seed}`, now: () => new Date("2026-08-19T00:00:00.000Z") };

  const replay =
    RULESET === "v2" ? await runBattleV2({ ...common, buyArmy: async () => COMPOSITION }) : await runBattle(common);

  const final = replay.turns.at(-1)!.stateAfter.squads;
  const byFaction = new Map<FactionId, number>();
  for (const s of final) byFaction.set(s.factionId, (byFaction.get(s.factionId) ?? 0) + s.hp);
  const hps = [...byFaction.values()].sort((a, b) => b - a);

  return {
    kind: replay.outcome.kind,
    turns: replay.turns.length,
    survivors: final.length,
    factionsAlive: byFaction.size,
    hits: replay.turns.flatMap((t) => t.events).filter((e) => e.type === "ATTACK_HIT").length,
    // How clearly the winner won. Zero means the tie-break could not separate.
    hpSpread: hps.length >= 2 ? hps[0]! - hps[1]! : (hps[0] ?? 0),
  };
}

const results: Result[] = [];
for (let i = 0; i < N; i += 1) results.push(await play(1000 + i));

const count = (p: (r: Result) => boolean) => results.filter(p).length;
const pct = (n: number) => `${((n / N) * 100).toFixed(1)}%`;
const mean = (f: (r: Result) => number) => (results.reduce((s, r) => s + f(r), 0) / N).toFixed(1);

const squadCount = RULESET === "v2" ? COMPOSITION.length * 4 : 8;
console.log(`\n${N} batailles scriptées, ruleset ${RULESET}${RULESET === "v2" ? `, composition ${COMPOSITION.join("+")}` : ", 1 MELEE + 1 RANGED par faction"}`);
console.log(`unités : MELEE ${ARCHETYPES.MELEE.hp}pv/${ARCHETYPES.MELEE.damage}dgt · RANGED ${ARCHETYPES.RANGED.hp}/${ARCHETYPES.RANGED.damage} · SCOUT ${ARCHETYPES.SCOUT.hp}/${ARCHETYPES.SCOUT.damage} · HEAVY ${ARCHETYPES.HEAVY.hp}/${ARCHETYPES.HEAVY.damage}\n`);

console.log("ISSUES");
for (const kind of ["VICTORY", "DRAW", "ANNIHILATION", "ALLIANCE_VICTORY"]) {
  const n = count((r) => r.kind === kind);
  if (n) console.log(`  ${kind.padEnd(18)}${String(n).padStart(4)}  ${pct(n)}`);
}

console.log("\nLISIBILITÉ");
console.log(`  annihilation totale        ${pct(count((r) => r.survivors === 0))}   <- n'apprend rien`);
console.log(`  une seule faction debout   ${pct(count((r) => r.factionsAlive === 1))}`);
console.log(`  départage impossible       ${pct(count((r) => r.hpSpread === 0 && r.factionsAlive > 1))}`);
console.log(`  bataille écourtée (<12t)   ${pct(count((r) => r.turns < MAX_TURNS))}`);

console.log("\nMOYENNES");
console.log(`  tours joués            ${mean((r) => r.turns)}`);
console.log(`  escouades survivantes  ${mean((r) => r.survivors)} / ${squadCount}`);
console.log(`  factions vivantes      ${mean((r) => r.factionsAlive)} / 4`);
console.log(`  coups portés           ${mean((r) => r.hits)}`);
console.log(`  écart de PV au sommet  ${mean((r) => r.hpSpread)}`);
