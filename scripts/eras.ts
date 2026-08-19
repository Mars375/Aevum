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

const TICKS = Number(arg("ticks", "150"));
const ROTATIONS = Number(arg("rotations", String(DEFAULT_GENERALS.length)));
const SEED = Number(arg("seed", "1789"));

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

for (let r = 0; r < ROTATIONS; r += 1) {
  const dir = resolve(ROOT, `rotation-${r}`);
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "era-0001.json");
  const generals = rotate(r);

  let journal: Journal;
  try {
    journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    // Same seed in every rotation: the world is held constant so that what
    // differs between rotations is only who governs what.
    journal = newJournal(newWorld(FACTIONS, SEED));
  }

  const from: World = replay(journal.origin, journal.rulings, journal.livedTo).world;
  const remaining = TICKS - from.tick;
  console.log(`\n=== rotation ${r} — ${generals.map((g) => `${g.factionId}:${g.model}`).join("  ")}`);

  let result;
  if (remaining <= 0) {
    console.log(`  deja vecue jusqu'a l'an ${from.tick}, rien a faire`);
    result = { world: from, lived: 0, closed: false, ledger: new Map<string, { asked: number; answered: number; deferred: number }>() };
  } else {
    result = await liveWorld(from, {
      journal,
      generals,
      provider,
      ticks: remaining,
      onRuling: () => writeFileSync(path, JSON.stringify(journal, null, 2)),
      notify: (n) => {
        if (n.kind === "ruled" || n.kind === "era-closed") {
          console.log(`  an ${String(n.tick).padStart(4)}  ${(n.civ ?? "").padEnd(8)} ${n.text.slice(0, 90)}`);
        }
      },
    });
    writeFileSync(path, JSON.stringify(journal, null, 2));
  }

  for (const g of generals) {
    const civ = result.world.civs.find((c) => c.id === g.factionId)!;
    // Read from the journal rather than the ledger: the journal records which
    // model actually answered, and that is the only thing that makes a result
    // attributable to a model.
    const mine = journal.rulings.filter((x) => x.civ === g.factionId);
    rows.push({
      rotation: r,
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

console.log(`\n\n=== resultat, ${ROTATIONS} rotation(s) de ${TICKS} ans\n`);
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

console.log("\n  par rotation (terres)");
console.log(`  modele                             ${FACTIONS.map((_, i) => `rot ${i}`.padStart(7)).join("")}`);
for (const model of models) {
  const cells = Array.from({ length: ROTATIONS }, (_, r) => {
    const row = rows.find((x) => x.model === model && x.rotation === r);
    return String(row?.territory ?? "-").padStart(7);
  }).join("");
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
