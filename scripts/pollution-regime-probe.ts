/**
 * pollution-regime-probe — la pollution a-t-elle un regime intermediaire ?
 *
 * Les trois relevees de `infrastructure-verification.json` ne montrent que des
 * etats finaux, et ils sont tous extremes : 0, ou le plafond 80. Un etat final
 * ne dit pas si la valeur est passee par le milieu ni si elle peut redescendre.
 * `foodFactor` promet pourtant un gradient de 1,00 a 0,75.
 *
 * Cette sonde rejoue une campagne archivee et echantillonne
 * `state.infrastructure.pollution` a chaque tour. Elle compte les observations
 * ville-tour par tranche, date la premiere apparition et la premiere
 * saturation, et verifie si une ville saturee redescend un jour. Lecture seule,
 * rejeu deterministe, zero appel distant.
 */
import { readFileSync } from "node:fs";
import { CampaignSchema } from "../packages/world/src/campaign.js";
import {
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import { POLLUTION_CAP } from "../packages/world/src/infrastructure.js";

const path = process.argv[2];
if (!path)
  throw new Error(
    "usage: tsx scripts/pollution-regime-probe.ts <campagne.json>",
  );
const campaign = CampaignSchema.parse(JSON.parse(readFileSync(path, "utf8")));

let state: SpectatorState = newSpectator(campaign.seed, campaign.version);

const bands = { zero: 0, low: 0, mid: 0, high: 0, capped: 0 };
const peak = new Map<string, number>();
let observations = 0;
let firstPollutedTurn: number | null = null;
let firstCappedTurn: number | null = null;
let recoveries = 0;
let turn = 0;

for (const t of campaign.turns) {
  state = resolveCouncil(
    state,
    t.answers.flatMap((a) => (a.decision ? [a.decision] : [])),
  ).state;
  turn++;
  for (const [city, value] of Object.entries(
    state.infrastructure?.pollution ?? {},
  )) {
    observations++;
    if (value <= 0) bands.zero++;
    else if (value >= POLLUTION_CAP) bands.capped++;
    else if (value < POLLUTION_CAP / 3) bands.low++;
    else if (value < (POLLUTION_CAP * 2) / 3) bands.mid++;
    else bands.high++;
    if (value > 0 && firstPollutedTurn === null) firstPollutedTurn = turn;
    if (value >= POLLUTION_CAP && firstCappedTurn === null)
      firstCappedTurn = turn;
    // A city that came back down from its own maximum by more than a single
    // turn's decay is the only evidence the penalty is reversible in practice.
    const seen = peak.get(city) ?? 0;
    if (value > seen) peak.set(city, value);
    else if (seen >= POLLUTION_CAP && value < POLLUTION_CAP - 1) recoveries++;
  }
}

console.log(
  JSON.stringify(
    {
      seed: campaign.seed,
      rules: campaign.version,
      turns: turn,
      cityTurnObservations: observations,
      bands,
      intermediateShare:
        observations > 0
          ? Number(
              (
                ((bands.low + bands.mid + bands.high) / observations) *
                100
              ).toFixed(2),
            )
          : 0,
      firstPollutedTurn,
      firstCappedTurn,
      turnsFromFirstPollutionToCap:
        firstPollutedTurn !== null && firstCappedTurn !== null
          ? firstCappedTurn - firstPollutedTurn
          : null,
      cappedCityTurnsBelowCapAfterwards: recoveries,
      peakByCity: Object.fromEntries(
        [...peak.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    null,
    1,
  ),
);
