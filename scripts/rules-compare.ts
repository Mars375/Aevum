/**
 * rules-compare — deux parties du même monde, sous deux versions des règles,
 * comparées au même nombre d'actions.
 *
 * Une partie a le plateau pour moitié de son résultat ; deux parties de
 * graines différentes ne diraient rien d'une règle. Les deux parties comparées
 * ici partagent donc la graine, et la plus longue est coupée à la longueur de
 * l'autre : ce qui diffère est la règle, et le hasard des réponses.
 *
 * La part servie par le modèle lui-même vient en tête (CLAUDE.md, point 3).
 *
 * Usage : npx tsx scripts/rules-compare.ts <id-a> <id-b> [--source=worlds/spectator]
 *                                          [--out=docs/reports/x.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CampaignSchema,
  replayCampaign,
  type Campaign,
} from "../packages/world/src/campaign.js";
import { housingCapacity } from "../packages/world/src/development.js";
import { atLeast } from "../packages/world/src/spectator.js";
import { neighbours } from "../packages/world/src/state.js";

const [idA, idB] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!idA || !idB) throw new Error("Usage : rules-compare <id-a> <id-b>");
const option = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const source = option("source") ?? "worlds/spectator";
const load = (id: string) =>
  CampaignSchema.parse(
    JSON.parse(readFileSync(resolve(source, `${id}.json`), "utf8")),
  );

const a = load(idA);
const b = load(idB);
if (a.seed !== b.seed)
  throw new Error(
    `graines différentes (${a.seed} et ${b.seed}) : rien à apparier`,
  );
const actions = Math.min(a.turns.length, b.turns.length);

function measure(full: Campaign) {
  const campaign = {
    ...full,
    turns: full.turns.slice(0, actions),
    pending: null,
  };
  const { state, outcomes } = replayCampaign(campaign);
  const economy = atLeast(state.rules, "spectator-11") ? "v11" : "classic";
  const sim = state.world.simulation!;
  const answers = campaign.turns.flatMap((turn) => turn.answers);
  // Une case est frontalière si l'une de ses voisines appartient à un autre.
  const { board, size } = state.world;
  const bordering = (civ: string) =>
    board.some(
      (tile, index) =>
        tile.owner === civ &&
        neighbours(size, index).some((n) => {
          const other = board[n]!.owner;
          return other !== null && other !== civ;
        }),
    );
  const civs = state.world.civs.map((civ) => {
    const mine = answers.filter((x) => x.civ === civ.id);
    const decisions = mine.flatMap((x) => (x.decision ? [x.decision] : []));
    const orders = decisions.flatMap((d) => d.orders ?? []);
    const cities = sim.cities.filter((c) => c.owner === civ.id).length;
    return {
      civ: civ.id,
      model: campaign.models[civ.id] ?? null,
      servedByOwnModel: mine.length
        ? mine.filter((x) => x.model === campaign.models[civ.id]).length /
          mine.length
        : 0,
      councils: mine.length,
      settlerRecruits: decisions.filter((d) => d.recruitSettler).length,
      settleOrders: orders.filter((o) => o.action === "settle").length,
      attackOrders: orders.filter((o) => o.action === "attack").length,
      diplomacyProposals: decisions.reduce(
        (n, d) => n + (d.diplomacy?.length ?? 0),
        0,
      ),
      cities,
      territory: civ.territory,
      population: Math.round(civ.population),
      housing: Math.round(housingCapacity(civ, cities, economy)),
      food: Math.round(civ.stock.food),
      bordering: bordering(civ.id),
      alive: civ.fellOnTick === null,
    };
  });
  const wars = new Set<string>();
  for (const snapshot of [...outcomes.map((o) => o.state), state])
    for (const r of snapshot.world.simulation!.relations)
      if (r.status === "war") wars.add(`${r.a}-${r.b}`);
  return {
    id: full.id,
    rules: state.rules,
    actions,
    freeTiles: board.filter((t) => t.owner === null).length,
    tiles: board.length,
    warsDeclared: wars.size,
    civs,
  };
}

const report = {
  measuredOn: new Date().toISOString().slice(0, 10),
  a: measure(a),
  b: measure(b),
};
for (const side of [report.a, report.b]) {
  console.log(
    `\n${side.rules} ${side.id.slice(0, 8)} — ${side.actions} actions, ` +
      `${side.freeTiles}/${side.tiles} cases libres, ${side.warsDeclared} guerre(s)`,
  );
  for (const c of side.civs)
    console.log(
      `  ${c.civ.padEnd(8)} servi ${(c.servedByOwnModel * 100).toFixed(0).padStart(3)} %` +
        `  colons ${String(c.settlerRecruits).padStart(2)}  fonder ${String(c.settleOrders).padStart(2)}` +
        `  villes ${c.cities}  cases ${String(c.territory).padStart(3)}` +
        `  pop ${String(c.population).padStart(4)}/${String(c.housing).padStart(4)}` +
        `  vivres ${String(c.food).padStart(5)}  attaques ${c.attackOrders}` +
        `  diplo ${c.diplomacyProposals}  frontière ${c.bordering ? "oui" : "non"}  (${c.model})`,
    );
}
const out = option("out");
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
