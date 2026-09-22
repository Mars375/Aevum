/**
 * remote-campaign-probe — la premiere campagne distante reellement jouee.
 *
 * C'est la limite que ce depot traine depuis le debut, ecrite dans chaque
 * rapport : « une campagne distante longue n'est pas acquise ». Toutes les
 * mesures distantes jusqu'ici tenaient en un appel, ou en une poignee — assez
 * pour prouver qu'un contrat est satisfaisable, jamais qu'un modele gouverne
 * sur la duree.
 *
 * Cette sonde joue des tours **consecutifs** avec un conseil distant a chaque
 * tour, et enregistre pour chacun ce qui s'est reellement passe : le modele
 * demande et celui qui a repondu, la latence, la source, les ordres rejetes.
 * Puis elle **rejoue la campagne** et compare la signature : une campagne
 * distante qui ne se rejoue pas ne prouve rien.
 *
 * Bornee par construction. `--turns N` fixe le nombre de tours, donc le nombre
 * d'appels : un tour, un conseil, plus au plus une correction que le moteur
 * accorde deja. S'arreter est le mode normal ; l'archive est ecrite a chaque
 * tour, de sorte qu'une interruption ne perd rien.
 *
 * Aucune cle n'est lue, journalisee ni imprimee ici.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  activeCiv,
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
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const arg = (name: string, fallback: string) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const RULES = "spectator-10" as const;
const SEED = Number(arg("seed", "42"));
const TURNS = Number(arg("turns", "20"));
const OUT = arg("out", "docs/reports/remote-campaign.json");
const ARCHIVE = arg("archive", "worlds/spectator/remote-campaign.json");
/** Secondes entre deux tours. Pour distinguer une limite de debit d une panne. */
const PACE = Number(arg("pace", "0"));

interface TurnRow {
  turn: number;
  civ: string;
  source: string;
  requestedModel: string | null;
  servedModel: string | null;
  servedItself: boolean;
  latencyMs: number | null;
  rejected: number;
  rejectDetails: string[];
  error: string | null;
}

loadWindowsNousEnvironment();

let state: SpectatorState = newSpectator(SEED, RULES);
const campaign: Campaign = {
  version: RULES,
  id: "remote-campaign",
  seed: SEED,
  mode: "remote",
  models: {},
  maxTurns: 300,
  turns: [],
  pending: null,
};

/**
 * Reprendre une campagne d'un processus a l'autre.
 *
 * Le point d'inference cesse de repondre apres deux completions dans un meme
 * processus — mesure, et ni la cadence ni la taille de la demande n'y changent
 * rien (`docs/reports/campagne-distante.md`). Un processus neuf, lui, obtient
 * ses deux appels. Reprendre l'archive contourne donc l'indisponibilite sans
 * rien maquiller : ce sont les memes decisions distantes, jouees en plusieurs
 * fois, et le rejeu le verifie d'un bout a l'autre.
 */
let resumed = 0;
if (process.argv.includes("--resume") && existsSync(ARCHIVE)) {
  const saved = CampaignSchema.parse(JSON.parse(readFileSync(ARCHIVE, "utf8")));
  if (saved.seed !== SEED || saved.version !== RULES)
    throw new Error(
      "L'archive ne correspond pas a cette graine ou ces regles.",
    );
  // Le rejeu est la seule facon honnete de retrouver l'etat : il verifie au
  // passage que ce qu'on reprend est bien ce qui a ete joue.
  state = replayCampaign(saved).state;
  campaign.turns = saved.turns;
  campaign.models = saved.models;
  resumed = saved.turns.length;
  console.error(`reprise : ${resumed} tour(s) deja joue(s)`);
}
const rows: TurnRow[] = [];
let retries = 0;
let recovered = 0;
const alive = () =>
  state.world.civs.filter((c) => c.fellOnTick === null && c.population > 0)
    .length;

for (let n = 0; n < TURNS && alive() > 1; n++) {
  if (n > 0 && PACE > 0)
    await new Promise((done) => setTimeout(done, PACE * 1000));
  const civ = activeCiv(state)!;
  const model = defaultCouncilModels()[civ]!;
  campaign.models[civ] = model;
  /**
   * Un second essai du MEME modele, jamais un remplacement.
   *
   * La campagne s'arretait au premier delai depasse : la limite mesuree
   * n'etait pas le contrat — zero ordre rejete sur les tours joues — mais la
   * disponibilite du transport. Reessayer le modele qu'on a demande ne
   * maquille rien ; basculer sur un autre modele ou sur un dirigeant local,
   * si. Les reprises sont comptees et affichees.
   */
  let answer = await requestValidatedCouncil(state, civ, "remote", model);
  if (answer.source !== "remote") {
    retries++;
    await new Promise((done) => setTimeout(done, 2000));
    answer = await requestValidatedCouncil(state, civ, "remote", model);
    if (answer.source === "remote") recovered++;
  }
  const service = answer.service as {
    requestedModel?: string;
    servedModel?: string;
    servedByFallback?: boolean;
    latencyMs?: number;
  } | null;

  // Un conseil qu'on ne peut pas appliquer n'avance pas la campagne : on le
  // consigne et on s'arrete, plutot que de le remplacer par un dirigeant local
  // et d'appeler cela une campagne distante.
  if (!answer.decision) {
    rows.push({
      turn: state.world.tick,
      civ,
      source: answer.source,
      requestedModel: service?.requestedModel ?? model,
      servedModel: service?.servedModel ?? null,
      servedItself: false,
      latencyMs: service?.latencyMs ?? null,
      rejected: 0,
      rejectDetails: [],
      error: answer.error,
    });
    console.error(`tour ${n + 1} (${civ}) : aucune decision — arret`);
    break;
  }

  const result = resolveCouncil(state, [answer.decision]);
  state = result.state;
  campaign.turns.push({
    turn: answer.decision.turn,
    signature: stateSignature(state),
    answers: [
      {
        civ,
        decision: answer.decision,
        source: answer.source,
        model: answer.model,
        service: answer.service,
        error: answer.error,
      },
    ],
  });
  rows.push({
    turn: answer.decision.turn,
    civ,
    source: answer.source,
    requestedModel: service?.requestedModel ?? model,
    servedModel: service?.servedModel ?? null,
    servedItself:
      answer.source === "remote" && service?.servedByFallback === false,
    latencyMs: service?.latencyMs ?? null,
    rejected: result.rejected.length,
    rejectDetails: result.rejected.slice(0, 4).map((issue) => issue.detail),
    error: answer.error,
  });
  // Ecrit a chaque tour : une interruption ne doit rien perdre.
  writeFileSync(ARCHIVE, JSON.stringify(campaign));
  console.error(
    `tour ${n + 1}/${TURNS} (${civ}) : ${answer.source}, ` +
      `${result.rejected.length} rejet(s), ${service?.latencyMs ?? "?"} ms`,
  );
}

let replayVerified = false;
let replayError: string | null = null;
try {
  replayCampaign(CampaignSchema.parse(campaign));
  replayVerified = true;
} catch (error) {
  replayError = (error as Error).message;
}

const played = rows.filter((row) => row.source === "remote");
const latencies = played
  .map((row) => row.latencyMs)
  .filter((value): value is number => typeof value === "number")
  .sort((a, b) => a - b);

const report = {
  checkedAt: new Date().toISOString(),
  rules: RULES,
  seed: SEED,
  paceSeconds: PACE,
  turnsRequested: TURNS,
  turnsPlayed: campaign.turns.length,
  turnsResumed: resumed,
  turnsAddedThisRun: campaign.turns.length - resumed,
  councilsRequested: rows.length + retries,
  transportRetries: retries,
  recoveredByRetry: recovered,
  servedByModelItself: rows.filter((row) => row.servedItself).length,
  unavailable: rows.filter((row) => row.source !== "remote").length,
  totalRejectedOrders: rows.reduce((sum, row) => sum + row.rejected, 0),
  turnsWithoutRejection: rows.filter(
    (row) => row.source === "remote" && row.rejected === 0,
  ).length,
  latencyMs: {
    min: latencies[0] ?? null,
    median: latencies.length
      ? latencies[Math.floor(latencies.length / 2)]
      : null,
    max: latencies[latencies.length - 1] ?? null,
  },
  replayVerified,
  replayError,
  archive: ARCHIVE,
  rows,
};

writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 1));
console.error(`rapport ecrit : ${OUT}`);
