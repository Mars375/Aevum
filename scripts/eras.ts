/**
 * Several worlds, the same four models, every position.
 *
 * The first era produced a clear ranking and an unusable one: crimson finished
 * with 47 of the world's 80 territories, but crimson is both "the civilisation
 * that took the initiative in year 142" and "the one governed by
 * mistral-large", and nothing in a single run separates those. This rotates
 * which model governs which civilisation and reports each model's outcome
 * across every position — the tournament's rotation protocol, applied to
 * worlds instead of battles.
 *
 * Two honest limits, stated here rather than discovered later:
 *
 *   - it is a FIXED HORIZON, not "until one civilisation remains". Era 1 ran
 *     402 years without closing, so waiting for closure is not a protocol.
 *     Every rotation lives the same number of years and is compared there.
 *   - a rotation is one draw of seasons and bandits. Same seed across
 *     rotations, so the world is the same and only the governing changes.
 *
 * Rotations are INTERLEAVED, not run one after another. The first version ran
 * them in sequence, and the measurement paid for it: one model answered 5 of 5,
 * 4 of 4 and 5 of 6 decisions in the first three rotations, then 0 of 8 in the
 * fourth — the day's free quota was gone by the time its turn came, so the last
 * rotation carried the whole cost of exhaustion. Rotating the position controls
 * for which faction a model governs; nothing controlled for WHEN in the day it
 * governed. Interleaving spreads exhaustion across all rotations instead of
 * dropping it on the last.
 *
 *   npm run eras -- --ticks 150 --rotations 4
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FactionId, GeneralConfig } from "@abs/contracts";
import { DEFAULT_GENERALS, RemoteProvider, liveWorld } from "@abs/agents";
import { JournalSchema, newJournal, newWorld, replay, type Journal, type World } from "@abs/world";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* fall through to the real environment */
}

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};

/**
 * Sixty years, not a hundred and fifty.
 *
 * Measured offline by scripts/board-fairness.ts: the board's own noise grows
 * with the horizon — a relative spread of 0.21 at 60 years, 0.32 at 120, 0.56
 * at 320. Luck compounds faster than governance does, so a longer run is not a
 * better measurement, only a more expensive one. Short courses, many of them.
 */
const TICKS = Number(arg("ticks", "60"));
/**
 * Années vécues en silence avant que les modèles ne prennent la main.
 *
 * L'idée semblait bonne : le moteur est gratuit, donc amener le monde jusqu'au
 * moment intéressant — le plateau se remplit vers l'an 130 — devait rendre
 * chaque appel plus utile. **Mesuré, c'est faux**, et le défaut par défaut est
 * donc zéro.
 *
 * Sur douze mondes, soixante années gouvernées :
 *
 *   sans mise en route : 129 décisions, dont 50 % de progrès techniques
 *   après 120 ans muets : 230 décisions, dont 46 % de famine et 3 % de frontière
 *   après 180 ans muets : 244 décisions, dont 70 % de famine
 *
 * La fenêtre tardive coûte deux fois plus cher et pose surtout des questions
 * forcées — une famine n'a qu'une réponse. Et elle ne produit toujours pas de
 * conquêtes, parce qu'une conquête demande qu'un dirigeant choisisse la
 * pression, ce qu'une mise en route muette ne peut pas faire par définition.
 *
 * Le bouton reste, parce qu'il est mesuré et qu'il peut servir à observer un
 * monde mûr. Il ne sert pas à mesurer des modèles.
 */
const WARMUP = Number(arg("warmup", "0"));
const ROTATIONS = Number(arg("rotations", String(DEFAULT_GENERALS.length)));
/**
 * Seeds, not just rotations.
 *
 * Four rotations put each model in each position, which separates the model
 * from the seat it occupies. They do nothing about the noise of one particular
 * draw of seasons, bandits and disasters — and w3 made that noise much larger
 * (a model finished with 25 territories in one rotation and 4 in another).
 * Averaging it needs different worlds, not more passes through the same one.
 */
const SEEDS = arg("seeds", "1789").split(",").map(Number);

const FACTIONS = DEFAULT_GENERALS.map((g) => g.factionId) as FactionId[];
const ROOT = resolve("worlds");

/** In rotation r, the model that normally rules faction i rules faction (i+r). */
function rotate(r: number): GeneralConfig[] {
  return DEFAULT_GENERALS.map((g, i) => ({ ...g, factionId: FACTIONS[(i + r) % FACTIONS.length]! }));
}

const apiKeys = {
  openrouter: process.env.OPENROUTER_API_KEY,
  groq: process.env.GROQ_API_KEY,
  nvidia: process.env.NVIDIA_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
};
if (!Object.values(apiKeys).some(Boolean)) {
  console.error("Aucune cle de fournisseur. Copiez .env.example vers .env.");
  process.exit(1);
}
const provider = new RemoteProvider({ apiKeys, freeModelsOnly: true });

interface Row {
  rotation: number;
  seed: number;
  model: string;
  faction: FactionId;
  population: number;
  territory: number;
  alive: boolean;
  /** Decisions this civilisation faced. */
  decisions: number;
  /**
   * Of those, how many its OWN model answered.
   *
   * Not "how many were answered at all" — the first run of this script
   * reported 100% service for a model that had personally answered 3 of its
   * 21 decisions, the other 18 having gone to its fallback chain. That is the
   * tournament's oldest lesson repeating: a model served 14% of the time did
   * not govern badly, it did not govern.
   */
  served: number;
}
const rows: Row[] = [];

/** Years lived per visit. Small enough that a quota running dry lands on every course. */
const SLICE = Number(arg("slice", "20"));

interface Run {
  r: number;
  seed: number;
  path: string;
  journal: Journal;
  generals: GeneralConfig[];
  world: World;
}

const runs: Run[] = [];
for (const seed of SEEDS) {
  for (let r = 0; r < ROTATIONS; r += 1) {
    const dir = resolve(ROOT, `rotation-${seed}-${r}`);
    mkdirSync(dir, { recursive: true });
    const path = resolve(dir, "era-0001.json");
    let journal: Journal;
    try {
      journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      // One seed is held constant across its four rotations, so that within a
      // seed the only thing differing is who governs what.
      journal = newJournal(newWorld(FACTIONS, seed));
    }
    runs.push({
      r,
      seed,
      path,
      journal,
      generals: rotate(r),
      world: replay(journal.origin, journal.rulings, journal.livedTo).world,
    });
  }
}

for (const run of runs) {
  console.log(`graine ${run.seed} rotation ${run.r} — ${run.generals.map((g) => `${g.factionId}:${g.model}`).join("  ")}`);
}

/**
 * What this run will cost, and what it could prove — before a call is spent.
 *
 * The board's standard deviation is 5.6 places (board-fairness.ts, 24 worlds),
 * so a model's mean is only as sharp as the number of courses behind it. Saying
 * so up front turns "let's run a rotation" into a decision with a number on it.
 */
const toLive = runs.reduce((n, run) => n + Math.max(0, WARMUP + TICKS - Math.max(run.world.tick, WARMUP)), 0);
// About one decision per civilisation per fifteen years, measured across worlds.
const expected = Math.round((toLive / 15) * FACTIONS.length);
const BOARD_SD = 5.6;
const courses = runs.length;
const stderr = BOARD_SD / Math.sqrt(courses);
console.log(
  `\n${courses} courses, ${WARMUP} ans de mise en route muette puis ${TICKS} ans gouvernes,\n` +
    `${toLive} annees payantes, environ ${expected} appels (~${Math.round(expected / FACTIONS.length)} par modele).\n` +
    `Erreur type attendue : ${stderr.toFixed(1)} lieux, donc un ecart credible entre deux modeles\n` +
    `demande environ ${(stderr * 2).toFixed(1)} lieux. En dessous, la carte parle plus fort que le dirigeant.\n`,
);

/** A model this starved is not being measured; running on would only spend quota. */
const STARVED_BELOW = 0.5;

let pass = 0;
while (runs.some((run) => run.world.tick < WARMUP + TICKS)) {
  pass += 1;
  for (const run of runs) {
    const remaining = Math.min(SLICE, WARMUP + TICKS - run.world.tick);
    if (remaining <= 0) continue;
    console.log(`\n--- passe ${pass}, graine ${run.seed} rotation ${run.r} : annees ${run.world.tick} a ${run.world.tick + remaining}`);
    const result = await liveWorld(run.world, {
      journal: run.journal,
      generals: run.generals,
      provider,
      ticks: remaining,
      warmup: Math.max(0, WARMUP - run.world.tick),
      onRuling: () => writeFileSync(run.path, JSON.stringify(run.journal, null, 2)),
      notify: (n) => {
        if (n.kind === "ruled" || n.kind === "era-closed") {
          console.log(`  an ${String(n.tick).padStart(4)}  ${(n.civ ?? "").padEnd(8)} ${n.text.slice(0, 88)}`);
        }
      },
    });
    run.world = result.world;
    writeFileSync(run.path, JSON.stringify(run.journal, null, 2));
  }

  // Checked between passes, once every course has had a turn: a model that
  // stops answering makes the rest of the run unusable, and the last rotation
  // taught that the cost of finding out afterwards is the whole run.
  const served = new Map<string, { own: number; total: number }>();
  for (const run of runs) {
    for (const g of run.generals) {
      const mine = run.journal.rulings.filter((x) => x.civ === g.factionId);
      const acc = served.get(g.model) ?? { own: 0, total: 0 };
      acc.total += mine.length;
      acc.own += mine.filter((x) => x.model === g.model).length;
      served.set(g.model, acc);
    }
  }
  const starved = [...served].filter(([, a]) => a.total >= 6 && a.own / a.total < STARVED_BELOW);
  if (starved.length > 0) {
    console.log(
      `\nARRET : ${starved
        .map(([m, a]) => `${m} n'a servi que ${a.own}/${a.total} de ses decisions`)
        .join(", ")}.\n` +
        `Continuer ne mesurerait que sa chaine de repli. Les courses deja vecues sont conservees\n` +
        `et la meme commande reprendra ou elle s'est arretee quand le quota sera revenu.\n`,
    );
    break;
  }
}

for (const run of runs) {
  for (const g of run.generals) {
    const civ = run.world.civs.find((c) => c.id === g.factionId)!;
    // Read from the journal rather than a ledger: the journal records which
    // model actually answered, and that is the only thing that makes a result
    // attributable to a model.
    const mine = run.journal.rulings.filter((x) => x.civ === g.factionId);
    rows.push({
      rotation: run.r,
      seed: run.seed,
      model: g.model,
      faction: g.factionId,
      population: Math.round(civ.population),
      territory: civ.territory,
      alive: civ.fellOnTick === null,
      decisions: mine.length,
      served: mine.filter((x) => x.model === g.model).length,
    });
  }
}

console.log(`\n\n=== resultat, ${SEEDS.length} graine(s) x ${ROTATIONS} rotations de ${TICKS} ans\n`);
console.log("  modele                             pop. moy.  terres moy.  decisions  servies par lui");
const models = [...new Set(rows.map((row) => row.model))];
const ranked = models
  .map((model) => {
    const mine = rows.filter((row) => row.model === model);
    const mean = (pick: (row: Row) => number) => mine.reduce((n, row) => n + pick(row), 0) / mine.length;
    const decisions = mine.reduce((n, row) => n + row.decisions, 0);
    const served = mine.reduce((n, row) => n + row.served, 0);
    return {
      model,
      population: mean((row) => row.population),
      territory: mean((row) => row.territory),
      decisions,
      served,
      service: decisions > 0 ? served / decisions : 1,
    };
  })
  .sort((a, b) => b.territory - a.territory || b.population - a.population);

for (const m of ranked) {
  const rate = Math.round(m.service * 100);
  console.log(
    `  ${m.model.padEnd(34)} ${m.population.toFixed(0).padStart(9)} ${m.territory.toFixed(1).padStart(12)} ` +
      `${String(m.decisions).padStart(10)} ${`${m.served} (${rate}%)`.padStart(16)}` +
      (rate < 70 ? "   ← non classable" : ""),
  );
}

console.log("\n  terres finales, une colonne par course");
console.log(
  `  modele                             ${runs.map((run) => `${run.seed % 100}/${run.r}`.padStart(7)).join("")}`,
);
for (const model of models) {
  const cells = runs
    .map((run) => {
      const row = rows.find((x) => x.model === model && x.rotation === run.r && x.seed === run.seed);
      return String(row?.territory ?? "-").padStart(7);
    })
    .join("");
  console.log(`  ${model.padEnd(34)}${cells}`);
}

// A model that wins from one position and loses from another has not been
// shown to be better; it has been shown that position matters. Saying so is
// the whole reason for rotating.
console.log(
  "\n  Lire par ligne : un modele dont les terres varient fortement d'une rotation a l'autre",
);
console.log("  n'a pas montre qu'il gouverne mieux, mais que la position compte.");
console.log("  Un modele dont la colonne 'servies par lui' est basse n'a pas gouverne du tout :");
console.log("  son resultat est celui de sa chaine de repli, et ne lui est pas attribuable.\n");
