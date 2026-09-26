/**
 * economy-probe — ce que l'économie fait d'un monde, sans un appel de modèle.
 *
 * Joue des parties entières avec le dirigeant local, sous deux versions des
 * règles, et compare ce qui compte pour la question « le monde pose-t-il une
 * question ? » : les populations se séparent-elles selon les décisions ;
 * fonder une ville rapporte-t-il ; le logement borne-t-il ; et surtout, la
 * famine devient-elle la seule question (CLAUDE.md, point 8) ?
 *
 * Le dirigeant local ne raisonne pas : il ne dit pas ce que feront les
 * modèles. Il dit ce que les règles rendent possible, et ce qu'elles coûtent.
 *
 * Usage : npx tsx scripts/economy-probe.ts [--rounds=120] [--seeds=42,7,123]
 */
import { writeFileSync } from "node:fs";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  atLeast,
  SPECTATOR_RULES,
  type SpectatorRules,
} from "../packages/world/src/spectator.js";
import { housingCapacity } from "../packages/world/src/development.js";

const flag = (name: string, fallback: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const rounds = Number(flag("rounds", "120"));
const seeds = flag("seeds", "42,7,123").split(",").map(Number);
// Les deux dernières versions, lues dans l'échelle : la recopier en clair est ce
// que la garde de frontière interdit.
const RULES: SpectatorRules[] = SPECTATOR_RULES.slice(-2);

const rows = [];
for (const rules of RULES)
  for (const seed of seeds) {
    let state = newSpectator(seed, rules);
    const events = new Map<string, number>();
    let housed = 0,
      samples = 0;
    const population: Record<string, number[]> = {};
    while (
      state.sequence!.round <= rounds &&
      state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
        .length > 1
    ) {
      const civ = activeCiv(state)!;
      const result = resolveCouncil(state, [localCouncil(state, civ)]);
      state = result.state;
      for (const e of result.events)
        events.set(e.kind, (events.get(e.kind) ?? 0) + 1);
      for (const c of state.world.civs) {
        if (c.fellOnTick !== null) continue;
        const cities = state.world.simulation!.cities.filter(
          (x) => x.owner === c.id,
        ).length;
        const cap = housingCapacity(
          c,
          cities,
          atLeast(rules, "spectator-11") ? "v11" : "classic",
        );
        samples++;
        if (c.population >= cap - 1) housed++;
      }
      if (state.world.tick % 40 === 0)
        for (const c of state.world.civs)
          (population[c.id] ??= []).push(c.population);
    }
    const w = state.world;
    const pops = w.civs.map((c) => c.population);
    const cities = w.civs.map(
      (c) => w.simulation!.cities.filter((x) => x.owner === c.id).length,
    );
    const total = [...events.values()].reduce((a, b) => a + b, 0);
    rows.push({
      rules,
      seed,
      actions: w.tick,
      populations: pops,
      spread: Math.max(...pops) - Math.min(...pops),
      cities,
      foodReserves: w.civs.map((c) => Math.round(c.stock.food)),
      freeLand: w.board.filter((p) => p.owner === null && p.kind !== "river")
        .length,
      atHousingLimit: Number((housed / Math.max(1, samples)).toFixed(3)),
      events: Object.fromEntries(
        ["GREW", "STARVED", "FOUNDED", "SEIZED", "WAR", "BUILT", "ADVANCE"].map(
          (k) => [k, events.get(k) ?? 0],
        ),
      ),
      famineShare: Number(
        ((events.get("STARVED") ?? 0) / Math.max(1, total)).toFixed(3),
      ),
      trajectory: population,
    });
    const r = rows.at(-1)!;
    console.log(
      `${rules} graine ${String(seed).padStart(3)} : pop ${r.populations.join("/")} (écart ${r.spread}) · villes ${r.cities.join("/")} · vivres ${r.foodReserves.join("/")} · au plafond ${Math.round(r.atHousingLimit * 100)} % · famines ${r.events.STARVED} (${Math.round(r.famineShare * 100)} % des faits) · fondations ${r.events.FOUNDED} · conquêtes ${r.events.SEIZED} · libres ${r.freeLand}`,
    );
  }
writeFileSync(
  "docs/reports/economy-probe.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), rounds, seeds, rows },
    null,
    2,
  ) + "\n",
);
