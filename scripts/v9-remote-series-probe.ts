/**
 * v9-remote-series-probe — plusieurs graines, un appel distant chacune.
 *
 * La preuve distante du lot v9 vaut un appel : tick 639, graine 42, valide.
 * Elle prouve que le contrat est satisfaisable, pas qu'un modele gouverne. Et
 * le « zero rejet » des relevees locales ne dit rien du distant, puisque
 * `localCouncil` n'emettait deja pas d'ordre invalide — c'est le piege
 * « servi n'est pas a repondu » sous une autre forme.
 *
 * Cette sonde rejoue le meme protocole sur les graines qui construisent
 * reellement (mesurees par `infrastructure-seeds-probe.ts`), et affiche pour
 * chacune la part servie par le modele lui-meme, les ordres rejetes et la
 * validite. Elle chauffe en local — gratuit — et ne fait **qu'un seul** appel
 * distant par graine, au premier tour ou un conseil choisit une infrastructure.
 *
 * N'ecrase aucun rapport existant : elle ecrit son propre fichier. Aucune cle
 * n'est lue, journalisee ni imprimee ici ; l'environnement s'en charge.
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
import type { InfrastructureKind } from "../packages/world/src/infrastructure.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const RULES = "spectator-9";
/** Seeds whose local councils actually reach an infrastructure decision. */
const SEEDS = process.argv[2]
  ? process.argv[2].split(",").map(Number)
  : [42, 7, 1, 17, 314];
const OUT = process.argv[3] ?? "docs/reports/v9-remote-series.json";

interface Row {
  seed: number;
  warmed: boolean;
  warmTurn: number | null;
  civ: string | null;
  localCandidate: { city: string; kind: InfrastructureKind } | null;
  source: string;
  served: unknown;
  servedItself: boolean | null;
  chosen: { city: string; kind: InfrastructureKind } | null;
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
  let warmTurn: number | null = null;
  let candidate: { city: string; kind: InfrastructureKind } | null = null;
  const alive = () =>
    state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
      .length;

  while (round <= 300 && state.world.tick < 1200 && alive() > 1) {
    const civ = activeCiv(state)!;
    const decision = CouncilDecisionSchema.parse(localCouncil(state, civ));
    if (decision.infrastructure) {
      // Freeze the pre-decision state so the remote model decides, not the
      // local policy whose candidate merely told us we had arrived.
      warmCiv = civ;
      warmTurn = state.world.tick;
      candidate = decision.infrastructure;
      break;
    }
    state = resolveCouncil(state, [decision]).state;
    round = state.sequence?.round ?? round;
  }

  if (!warmCiv) {
    rows.push({
      seed,
      warmed: false,
      warmTurn: null,
      civ: null,
      localCandidate: null,
      source: "unavailable",
      served: null,
      servedItself: null,
      chosen: null,
      rejections: [],
      valid: false,
      error: "aucun conseil local n'a choisi d'infrastructure dans les bornes",
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
  rows.push({
    seed,
    warmed: true,
    warmTurn,
    civ: warmCiv,
    localCandidate: candidate,
    source: answer.source,
    served: answer.service,
    // "Served" is not "answered": a fallback chain replying in its place means
    // the requested model did not govern this turn.
    servedItself:
      answer.source === "remote" && service?.servedByFallback === false,
    chosen: answer.decision?.infrastructure ?? null,
    rejections: (result?.rejected ?? []).map(
      (r) => `${r.unit ?? "Conseil"}: ${r.detail}`,
    ),
    valid:
      !!result && result.rejected.length === 0 && answer.source === "remote",
    error: answer.error,
  });
  console.error(
    `graine ${seed} : appel au tick ${warmTurn}, source ${answer.source}, ` +
      `${result?.rejected.length ?? 0} rejet(s)`,
  );
}

const answered = rows.filter((r) => r.warmed);
const report = {
  checkedAt: new Date().toISOString(),
  rules: RULES,
  seeds: SEEDS.length,
  remoteCalls: calls,
  warmedSeeds: answered.length,
  servedByModelItself: answered.filter((r) => r.servedItself).length,
  validCouncils: answered.filter((r) => r.valid).length,
  totalRejections: answered.reduce((n, r) => n + r.rejections.length, 0),
  choseInfrastructure: answered.filter((r) => r.chosen).length,
  rows,
};
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1));
console.error(`rapport ecrit : ${OUT}`);
