/**
 * agreements-probe — la diplomatie v10 se produit-elle, et se rejoue-t-elle ?
 *
 * Deux questions distinctes, et la seconde ne vaut que si la premiere a une
 * reponse. Un module teste ne dit pas qu'une campagne en fera usage : la
 * politique locale peut tres bien ne jamais s'engager, auquel cas la
 * fonctionnalite n'existerait que dans les tests.
 *
 * La sonde joue des campagnes locales completes sous `spectator-10`, compte ce
 * qui s'est reellement passe — pactes conclus, menes a terme, rompus, echanges,
 * offres expirees ou refusees — puis **rejoue chaque campagne** et compare la
 * signature. Simulation locale seulement : aucun appel distant, aucun quota
 * depense, aucun fichier du depot ecrase.
 */
import { writeFileSync } from "node:fs";
import {
  CouncilDecisionSchema,
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../packages/world/src/campaign.js";
import {
  TRUST_CEILING,
  TRUST_FLOOR,
} from "../packages/world/src/agreements.js";

const RULES = "spectator-10" as const;
const SEEDS = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [42, 7, 123, 1, 17, 314];
const OUT = process.argv[3] ?? "docs/reports/agreements-verification.json";
const MAX_ROUNDS = 120;

interface Row {
  seed: number;
  actions: number;
  rejected: number;
  rejectedAgreements: number;
  rejectDetails: string[];
  replayVerified: boolean;
  events: Record<string, number>;
  pactsStanding: number;
  offersPending: number;
  trustRange: [number, number];
}

const rows: Row[] = [];

for (const seed of SEEDS) {
  let state: SpectatorState = newSpectator(seed, RULES);
  const campaign: Campaign = {
    version: RULES,
    id: `agreements-local-${seed}`,
    seed,
    mode: "local",
    models: {},
    maxTurns: 300,
    turns: [],
    pending: null,
  };
  let round = 1;
  let actions = 0;
  let rejected = 0;
  let rejectedAgreements = 0;
  const rejectDetails: string[] = [];
  const events: Record<string, number> = {};
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
      .length;

  while (round <= MAX_ROUNDS && alive() > 1) {
    const civ = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, civ));
    const result = resolveCouncil(state, [decision]);
    rejected += result.rejected.length;
    for (const issue of result.rejected)
      if (/Accord refusé/.test(issue.detail)) {
        rejectedAgreements++;
        rejectDetails.push(`${issue.civ}: ${issue.detail}`);
      }
    // On compte l'histoire par ses evenements, pas par l'etat final : un pacte
    // mene a terme disparait de `pacts`, et ne se verrait plus.
    for (const event of result.events)
      if (
        /^(OFFERED|OFFER_EXPIRED|DECLINED|TRANSFER|PACT|PACT_FULFILLED|PACT_BROKEN|PACT_DISSOLVED)$/.test(
          event.kind,
        )
      )
        events[event.kind] = (events[event.kind] ?? 0) + 1;
    state = result.state;
    actions++;
    round = state.sequence?.round ?? round;
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }

  let replayVerified = true;
  try {
    replayCampaign(CampaignSchema.parse(campaign));
  } catch {
    replayVerified = false;
  }

  const trusts = Object.values(state.agreement?.trust ?? {}).flatMap((row) =>
    Object.values(row),
  );
  rows.push({
    seed,
    actions,
    rejected,
    rejectedAgreements,
    rejectDetails: rejectDetails.slice(0, 8),
    replayVerified,
    events,
    pactsStanding: state.agreement?.pacts.length ?? 0,
    offersPending: state.agreement?.offers.length ?? 0,
    trustRange: [
      trusts.length ? Math.min(...trusts) : 0,
      trusts.length ? Math.max(...trusts) : 0,
    ],
  });
  console.error(
    `graine ${seed} : ${actions} actions, ${events.PACT ?? 0} pacte(s), ` +
      `${events.TRANSFER ?? 0} echange(s), rejeu ${replayVerified ? "ok" : "ECHEC"}`,
  );
}

const total = (kind: string) =>
  rows.reduce((sum, row) => sum + (row.events[kind] ?? 0), 0);

const report = {
  checkedAt: new Date().toISOString(),
  rules: RULES,
  seeds: rows.length,
  maxRounds: MAX_ROUNDS,
  replaysVerified: rows.filter((row) => row.replayVerified).length,
  seedsWithAnyAgreement: rows.filter(
    (row) => Object.keys(row.events).length > 0,
  ).length,
  totals: {
    offered: total("OFFERED"),
    accepted: total("PACT") + total("TRANSFER"),
    pacts: total("PACT"),
    fulfilled: total("PACT_FULFILLED"),
    broken: total("PACT_BROKEN"),
    dissolved: total("PACT_DISSOLVED"),
    transfers: total("TRANSFER"),
    declined: total("DECLINED"),
    expired: total("OFFER_EXPIRED"),
  },
  // Deux comptes distincts. Un ordre d'unité refusé n'est pas un accord
  // refusé, et les confondre ferait porter à la diplomatie des défauts qui ne
  // sont pas les siens — la première version de cette sonde s'y est trompée.
  rejectedAgreementOrders: rows.reduce(
    (sum, row) => sum + row.rejectedAgreements,
    0,
  ),
  rejectedOrdersAllKinds: rows.reduce((sum, row) => sum + row.rejected, 0),
  trustBounds: [TRUST_FLOOR, TRUST_CEILING],
  rows,
  /**
   * Ce que la sonde exige pour se declarer valide : chaque campagne se rejoue,
   * et la diplomatie se produit vraiment quelque part. Une suite verte sans
   * un seul accord joue prouverait seulement que le code compile.
   */
  valid:
    rows.length > 0 &&
    rows.every((row) => row.replayVerified) &&
    total("PACT") + total("TRANSFER") > 0,
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1));
console.error(`rapport ecrit : ${OUT}`);
