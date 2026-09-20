/**
 * options-narrowing-probe — ce que le resserrement v9 retire aux dirigeants.
 *
 * `f79fcf3` a cesse d'annoncer "move/explore/retreat" a une unite qui n'a
 * aucune case adjacente libre, et "settle" a un colon sans site de fondation.
 * L'intention est bonne : ne plus proposer un ordre que le moteur rejetterait.
 * Mais `unitPath` fait un BFS sur tout le plateau, pas sur la seule couronne
 * adjacente : une unite sans voisin libre peut rester parfaitement mobile.
 *
 * Cette sonde compte, sur une campagne archivee et rejouee, combien de
 * tours-unite se voient desormais annoncer une liste d'actions vide alors que
 * le moteur, lui, accepterait encore un deplacement. Lecture seule, rejeu
 * deterministe, zero appel distant.
 */
import { readFileSync } from "node:fs";
import { councilOptions } from "../packages/agents/src/council-options.js";
import {
  activeCiv,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import { CampaignSchema } from "../packages/world/src/campaign.js";
import { newSpectator } from "../packages/world/src/spectator.js";
import { unitPath } from "../packages/world/src/units.js";

const path = process.argv[2];
if (!path)
  throw new Error(
    "usage: tsx scripts/options-narrowing-probe.ts <campagne.json>",
  );
const campaign = CampaignSchema.parse(JSON.parse(readFileSync(path, "utf8")));

let state: SpectatorState = newSpectator(campaign.seed, campaign.version);

const tally = {
  rules: campaign.version,
  turns: 0,
  unitTurns: 0,
  silenced: 0, // actions: [] sous v9
  silencedButMobile: 0, // ... alors qu'un deplacement reste legal
  reachableWhenSilenced: [] as number[],
  settlersSeen: 0,
  settleWithheld: 0,
  byRole: {} as Record<string, { silenced: number; mobile: number }>,
};

/** Cases que le moteur accepterait reellement pour cette unite, via unitPath. */
function reachable(world: SpectatorState["world"], unitId: string): number {
  const u = world.simulation!.units.find((x) => x.id === unitId)!;
  let count = 0;
  for (let tile = 0; tile < world.board.length; tile++) {
    if (tile === u.position) continue;
    if (unitPath(world, u, tile).length > 1) count++;
  }
  return count;
}

for (const turn of campaign.turns) {
  const actor = activeCiv(state);
  if (actor) {
    const options = councilOptions(state, actor) as {
      units: {
        unit: string;
        role?: string;
        actions: string[];
        foundationSites: unknown[];
      }[];
    };
    tally.turns++;
    for (const entry of options.units) {
      tally.unitTurns++;
      const role = entry.role ?? "?";
      tally.byRole[role] ??= { silenced: 0, mobile: 0 };
      if (role === "settler") {
        tally.settlersSeen++;
        if (!entry.actions.includes("settle")) tally.settleWithheld++;
      }
      if (entry.actions.length === 0) {
        tally.silenced++;
        tally.byRole[role]!.silenced++;
        const n = reachable(state.world, entry.unit);
        if (n > 0) {
          tally.silencedButMobile++;
          tally.byRole[role]!.mobile++;
          tally.reachableWhenSilenced.push(n);
        }
      }
    }
  }
  state = resolveCouncil(
    state,
    turn.answers.flatMap((a) => (a.decision ? [a.decision] : [])),
  ).state;
}

const reach = tally.reachableWhenSilenced;
const median = reach.length
  ? [...reach].sort((a, b) => a - b)[Math.floor(reach.length / 2)]
  : 0;

console.log(
  JSON.stringify(
    {
      ...tally,
      reachableWhenSilenced: undefined,
      medianReachableWhenSilenced: median,
      maxReachableWhenSilenced: reach.length ? Math.max(...reach) : 0,
    },
    null,
    1,
  ),
);
