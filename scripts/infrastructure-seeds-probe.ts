/**
 * infrastructure-seeds-probe — le systeme v9 est-il reellement exerce ?
 *
 * `infrastructure-verification.json` porte trois graines. Elles suffisent a
 * prouver que la mecanique fonctionne, pas a decrire ce qu'elle fait : sur ces
 * trois relevees, une civilisation porte presque tous les sites et une graine
 * n'en construit aucun. Treize sites ne sont donc pas treize observations.
 *
 * Cette sonde rejoue la meme boucle locale sur davantage de graines et ne
 * rapporte que la distribution : combien de graines construisent, quelle part
 * revient a la civilisation dominante, et surtout si une ville saturee en
 * pollution redescend un jour sous le plafond — la question laissee ouverte par
 * `pollution-regime-probe.ts`, qui n'avait qu'une campagne a lire.
 *
 * Simulation locale uniquement : aucun appel distant, aucun quota depense,
 * aucun fichier du depot ecrase.
 */
import {
  CouncilDecisionSchema,
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import { POLLUTION_CAP } from "../packages/world/src/infrastructure.js";

const RULES = "spectator-9" as const;
const SEEDS = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [42, 7, 123, 1, 2, 3, 11, 17, 23, 55, 99, 314];

interface Row {
  seed: number;
  actions: number;
  rejected: number;
  sites: number;
  topCivShare: number | null;
  firstSiteTurn: number | null;
  pollutedCities: number;
  reachedCap: boolean;
  fellBackBelowCap: boolean;
  maxPollution: number;
}

const rows: Row[] = [];

for (const seed of SEEDS) {
  let state: SpectatorState = newSpectator(seed, RULES);
  let round = 1;
  let actions = 0;
  let rejected = 0;
  let firstSiteTurn: number | null = null;
  let maxPollution = 0;
  let reachedCap = false;
  let fellBackBelowCap = false;
  const peak = new Map<string, number>();
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
      .length;

  while (round <= 300 && state.world.tick < 1200 && alive() > 1) {
    const civ = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, civ));
    const result = resolveCouncil(state, [decision]);
    rejected += result.rejected.length;
    state = result.state;
    actions++;
    round = state.sequence?.round ?? round;
    if (firstSiteTurn === null && (state.infrastructure?.sites.length ?? 0) > 0)
      firstSiteTurn = actions;
    for (const [city, value] of Object.entries(
      state.infrastructure?.pollution ?? {},
    )) {
      if (value > maxPollution) maxPollution = value;
      if (value >= POLLUTION_CAP) reachedCap = true;
      const seen = peak.get(city) ?? 0;
      if (value > seen) peak.set(city, value);
      // The open question: does a saturated city ever recover in practice?
      else if (seen >= POLLUTION_CAP && value < POLLUTION_CAP - 1)
        fellBackBelowCap = true;
    }
  }

  const sites = state.infrastructure?.sites ?? [];
  const byCiv = new Map<string, number>();
  for (const site of sites) {
    const owner = state.world.simulation?.cities.find(
      (c) => c.id === site.city,
    )?.owner;
    if (owner) byCiv.set(owner, (byCiv.get(owner) ?? 0) + 1);
  }
  const top = [...byCiv.values()].sort((a, b) => b - a)[0] ?? 0;

  rows.push({
    seed,
    actions,
    rejected,
    sites: sites.length,
    topCivShare: sites.length
      ? Number(((top / sites.length) * 100).toFixed(1))
      : null,
    firstSiteTurn,
    pollutedCities: [...peak.keys()].length,
    reachedCap,
    fellBackBelowCap,
    maxPollution: Number(maxPollution.toFixed(2)),
  });
  console.error(`graine ${seed} : ${sites.length} sites, ${actions} actions`);
}

const building = rows.filter((r) => r.sites > 0);
const shares = building.map((r) => r.topCivShare!).sort((a, b) => a - b);

console.log(
  JSON.stringify(
    {
      rules: RULES,
      seeds: rows.length,
      seedsThatBuild: building.length,
      seedsWithNoSite: rows.length - building.length,
      totalSites: rows.reduce((n, r) => n + r.sites, 0),
      totalRejected: rows.reduce((n, r) => n + r.rejected, 0),
      dominantCivShare: {
        min: shares[0] ?? null,
        median: shares.length ? shares[Math.floor(shares.length / 2)] : null,
        max: shares[shares.length - 1] ?? null,
      },
      seedsReachingCap: rows.filter((r) => r.reachedCap).length,
      seedsRecoveringFromCap: rows.filter((r) => r.fellBackBelowCap).length,
      rows,
    },
    null,
    1,
  ),
);
