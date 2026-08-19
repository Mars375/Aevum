/**
 * How much of a result is the board, and not the ruler?
 *
 * A rotation puts every model in every seat, which cancels the advantage of a
 * *corner*. It does nothing about the advantage of a *world*: one seed may hand
 * a founder three rivers within reach while another walls it in behind hills.
 * If that spread is larger than the difference between models, a rotation on a
 * single seed measures the map.
 *
 * Doctrines are frozen here, so everything that differs between civilisations
 * is the ground they were given. That is the noise a governed measurement has
 * to rise above.
 *
 *   npx tsx scripts/board-fairness.ts [seeds] [years]
 */
import { census, newWorld, tickWorld, type World } from "../packages/world/src/index.js";

const SEEDS = Number(process.argv[2] ?? 24);
const YEARS = Number(process.argv[3] ?? 120);
const FACTIONS = ["crimson", "azure", "verdant", "amber"] as const;

const live = (seed: number, years: number): World => {
  let world = census(newWorld([...FACTIONS], seed));
  for (let i = 0; i < years; i += 1) world = tickWorld(world).world;
  return world;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

const byCorner = new Map<string, number[]>(FACTIONS.map((f) => [f, []]));
const spreads: number[] = [];

for (let s = 0; s < SEEDS; s += 1) {
  const world = live(1000 + s * 13, YEARS);
  const held = world.civs.map((c) => c.territory);
  for (const civ of world.civs) byCorner.get(civ.id)!.push(civ.territory);
  spreads.push(Math.max(...held) - Math.min(...held));
}

console.log(`\n${SEEDS} mondes muets de ${YEARS} ans, doctrines figees.\n`);
console.log("  coin      lieux moyens   ecart-type   min   max");
for (const [id, xs] of byCorner) {
  console.log(
    `  ${id.padEnd(9)} ${mean(xs).toFixed(1).padStart(12)} ${sd(xs).toFixed(1).padStart(12)} ` +
      `${String(Math.min(...xs)).padStart(5)} ${String(Math.max(...xs)).padStart(5)}`,
  );
}

const all = [...byCorner.values()].flat();
console.log(`\n  ecart moyen entre la meilleure et la pire d'un meme monde : ${mean(spreads).toFixed(1)} lieux`);
console.log(`  ecart-type sur l'ensemble des courses                      : ${sd(all).toFixed(1)} lieux`);
console.log(
  `\n  Un ecart entre modeles plus petit que ${sd(all).toFixed(1)} lieux ne serait pas distinguable du hasard\n` +
    `  de la carte sur une seule graine. C'est le seuil que la rotation doit franchir.`,
);

/**
 * Which horizon, and which metric, carry the most signal per call.
 *
 * A measurement is only worth its cost if the thing it measures rises above the
 * board's own noise. Relative spread — the noise divided by the average — says
 * how much a metric would have to differ between models to be believed.
 */
console.log("\n\n  bruit relatif du plateau, par horizon et par mesure\n");
console.log("  annees      lieux   population    richesse   (ecart-type / moyenne)");
for (const horizon of [60, 120, 200, 320]) {
  const t: number[] = [];
  const p: number[] = [];
  const w: number[] = [];
  for (let s = 0; s < SEEDS; s += 1) {
    const world = live(1000 + s * 13, horizon);
    for (const civ of world.civs) {
      t.push(civ.territory);
      p.push(civ.population);
      w.push(civ.stock.wealth);
    }
  }
  const rel = (xs: number[]) => (mean(xs) > 0 ? sd(xs) / mean(xs) : 0);
  console.log(
    `  ${String(horizon).padStart(6)} ${rel(t).toFixed(2).padStart(10)} ${rel(p).toFixed(2).padStart(12)} ${rel(w).toFixed(2).padStart(11)}`,
  );
}

console.log(
  `\n  L'erreur type d'un modele est son ecart-type divise par la racine du nombre de courses :\n` +
    `  4 courses (1 graine) donnent ${(sd(all) / 2).toFixed(1)} lieux, 8 courses ${(sd(all) / Math.sqrt(8)).toFixed(1)},` +
    ` 16 courses ${(sd(all) / 4).toFixed(1)}.\n` +
    `  Un ecart croyable demande environ deux erreurs types.\n`,
);
