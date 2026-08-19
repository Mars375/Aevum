/**
 * Does a continuous world fit in a free quota?
 *
 * The whole architecture rests on one claim: that ticking for free and
 * consulting a model only at decision points costs orders of magnitude fewer
 * calls than asking every tick. That claim is measurable without spending a
 * single call, so it gets measured before anything is built on top of it —
 * the same way scripts/balance.ts measured the battle rules.
 *
 * Run: npx tsx scripts/world-probe.ts [ticks]
 */
import { detectDecisions, newCiv, tickWorld, WORLD_VERSION, type DecisionKind, type World } from "../packages/world/src/index.js";

const TICKS = Number(process.argv[2] ?? 500);
const FACTIONS = ["crimson", "azure", "verdant", "amber"] as const;

let world: World = {
  worldVersion: WORLD_VERSION,
  tick: 0,
  seed: 42,
  civs: FACTIONS.map((f) => newCiv(f)),
};

const byKind = new Map<DecisionKind, number>();
let total = 0;
let ticksWithNone = 0;

// No ruler answers here: the point is to measure how often one would be woken,
// not what it would say. Doctrines stay put, which is the worst case — a civ
// that never adapts hits more crises, so this over-estimates rather than under.
for (let i = 0; i < TICKS; i += 1) {
  const stepped = tickWorld(world);
  world = stepped.world;
  const points = detectDecisions(world, stepped.events);
  // Consulting resets the drift clock; without this the measurement would count
  // a wake-up every tick after the first drift and be meaningless.
  world = {
    ...world,
    civs: world.civs.map((c) => (points.some((p) => p.civ === c.id) ? { ...c, ticksSinceDecision: 0 } : c)),
  };
  if (points.length === 0) ticksWithNone += 1;
  for (const p of points) {
    total += 1;
    byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);
  }
}

const naive = TICKS * FACTIONS.length;
console.log(`\n${TICKS} tours, ${FACTIONS.length} civilisations\n`);
console.log(`appels si on demandait a chaque tour : ${naive}`);
console.log(`points de decision reellement leves  : ${total}`);
console.log(`facteur d'economie                   : ${(naive / Math.max(1, total)).toFixed(1)}x`);
console.log(`tours ou personne n'est consulte     : ${ticksWithNone}/${TICKS} (${Math.round((ticksWithNone / TICKS) * 100)}%)\n`);

for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(10)} ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(0)}%`);
}

console.log(`\netat final :`);
for (const c of world.civs) {
  const state = c.fellOnTick === null ? "vivante" : `eteinte au tour ${c.fellOnTick}`;
  console.log(`  ${c.id.padEnd(8)} pop ${String(c.population).padStart(5)}  terres ${String(c.territory).padStart(3)}  soldats ${String(c.soldiers).padStart(4)}  progres ${c.advances.length}  ${state}`);
}
