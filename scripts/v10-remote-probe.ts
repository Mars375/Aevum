/**
 * v10-remote-probe — un dirigeant distant sait-il repondre a une offre ?
 *
 * La v10 etait mesuree localement seulement : la politique locale propose et
 * accepte, ce qui prouve que le moteur tient, pas qu'un modele sache s'en
 * servir. Deux choses restaient a verifier et ne peuvent l'etre qu'en appelant
 * pour de vrai : qu'un modele rende un `offerId` copie tel quel plutot que
 * reconstruit, et qu'il remplisse les deux contributions d'un echange.
 *
 * Protocole : chauffe locale gratuite jusqu'au premier tour ou l'acteur a une
 * offre a traiter, puis **un seul** conseil distant, avec la correction bornee
 * que le moteur accorde deja. La lecon de la v9 est reprise telle quelle : un
 * appel valide n'est pas un taux, donc la sonde accepte plusieurs graines et
 * affiche la part servie par le modele lui-meme.
 *
 * Aucune cle n'est lue, journalisee ni imprimee ici.
 */
import { writeFileSync } from "node:fs";
import type { FactionId } from "@abs/contracts";
import {
  CouncilDecisionSchema,
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const RULES = "spectator-10" as const;
const SEEDS = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [42, 7, 1];
const OUT = process.argv[3] ?? "docs/reports/v10-remote-series.json";

interface Row {
  seed: number;
  warmed: boolean;
  warmRound: number | null;
  civ: string | null;
  /** L'offre que l'acteur avait sous les yeux : c'est elle qu'il doit nommer. */
  pendingOfferId: string | null;
  source: string;
  served: unknown;
  servedItself: boolean | null;
  answered: unknown;
  usedTheAdvertisedId: boolean | null;
  rejections: string[];
  valid: boolean;
  error: string | null;
}

loadWindowsNousEnvironment();
const rows: Row[] = [];
let calls = 0;

for (const seed of SEEDS) {
  let state: SpectatorState = newSpectator(seed, RULES);
  let round = 1;
  let warmCiv: FactionId | null = null;
  let pending: string | null = null;
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
      .length;

  while (round <= 80 && alive() > 1) {
    const civ = activeCiv(state)!;
    const offer = state.agreement?.offers.find((entry) => entry.to === civ);
    if (offer) {
      // Etat fige juste avant la decision : le modele repond a la place de la
      // politique locale, pas apres elle.
      warmCiv = civ;
      pending = offer.id;
      break;
    }
    state = resolveCouncil(state, [
      CouncilDecisionSchema.parse(localCouncil(state, civ)),
    ]).state;
    round = state.sequence?.round ?? round;
  }

  if (!warmCiv) {
    rows.push({
      seed,
      warmed: false,
      warmRound: null,
      civ: null,
      pendingOfferId: null,
      source: "unavailable",
      served: null,
      servedItself: null,
      answered: null,
      usedTheAdvertisedId: null,
      rejections: [],
      valid: false,
      error: "aucune offre en attente dans les bornes",
    });
    console.error(`graine ${seed} : non chauffee, aucun appel`);
    continue;
  }

  const answer = await requestValidatedCouncil(
    state,
    warmCiv,
    "remote",
    defaultCouncilModels()[warmCiv]!,
  );
  calls++;
  const result = answer.decision
    ? resolveCouncil(state, [answer.decision])
    : null;
  const service = answer.service as { servedByFallback?: boolean } | null;
  const given = answer.decision?.agreement ?? null;
  rows.push({
    seed,
    warmed: true,
    warmRound: round,
    civ: warmCiv,
    pendingOfferId: pending,
    source: answer.source,
    served: answer.service,
    servedItself:
      answer.source === "remote" && service?.servedByFallback === false,
    answered: given,
    // La question concrete : a-t-il recopie l'identifiant annonce, ou en a-t-il
    // fabrique un ? Un identifiant invente est refuse, et c'est voulu.
    usedTheAdvertisedId: given ? given.offerId === pending : null,
    rejections: (result?.rejected ?? []).map(
      (issue) => `${issue.unit ?? "Conseil"}: ${issue.detail}`,
    ),
    valid:
      !!result && result.rejected.length === 0 && answer.source === "remote",
    error: answer.error,
  });
  console.error(
    `graine ${seed} : appel a la manche ${round}, source ${answer.source}, ` +
      `accord ${given ? given.action : "aucun"}, ${result?.rejected.length ?? 0} rejet(s)`,
  );
}

const answered = rows.filter((row) => row.warmed);
const report = {
  checkedAt: new Date().toISOString(),
  rules: RULES,
  seeds: SEEDS.length,
  remoteCalls: calls,
  warmedSeeds: answered.length,
  servedByModelItself: answered.filter((row) => row.servedItself).length,
  validCouncils: answered.filter((row) => row.valid).length,
  answeredTheOffer: answered.filter((row) => row.answered).length,
  copiedTheAdvertisedId: answered.filter((row) => row.usedTheAdvertisedId)
    .length,
  totalRejections: answered.reduce(
    (sum, row) => sum + row.rejections.length,
    0,
  ),
  rows,
};
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1));
console.error(`rapport ecrit : ${OUT}`);
