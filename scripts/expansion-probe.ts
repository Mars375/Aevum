/**
 * expansion-probe — dire ce qu'une ville rapporte fait-il recruter un colon ?
 *
 * Sous spectator-11 les quatre populations touchent leur logement, et les
 * modèles y répondent par la recherche : un colon en 975 actions
 * (pourquoi-pas-de-guerre.md). L'hypothèse : le lien entre « la population
 * bute » et « fonder une ville » manque à ce qu'on leur dit.
 *
 * Mêmes situations réelles — tirées de la partie spectator-11, au plafond,
 * colon abordable et permis —, mêmes modèles, une seule différence :
 * A = sans `housing.expansion` ni la phrase qui l'explique ; B = avec.
 *
 * Seconde comparaison (`--compare=objective`) : les deux modèles renvoyaient
 * mot pour mot l'objectif que l'observation leur montrait, sous la clé même
 * qu'ils doivent remplir (256 décisions sur 260 pour codestral). A = la
 * consigne d'avant ; B = l'objectif présenté comme `previousObjective`, à
 * réexaminer — retenue, c'est la consigne en vigueur depuis. `echo` compte les objectifs renvoyés tels quels.
 *
 * Usage : npx tsx scripts/expansion-probe.ts [--models=a,b] [--situations=8]
 *                         [--campaign=<id>] [--compare=expansion|objective]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  CampaignSchema,
  replayCampaign,
} from "../packages/world/src/campaign.js";
import { activeCiv, SETTLER_COST } from "../packages/world/src/spectator.js";
import {
  affordable,
  housingCapacity,
} from "../packages/world/src/development.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import {
  EXPANSION_INSTRUCTION,
  OBJECTIVE_INSTRUCTION,
} from "../packages/agents/src/council.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const flag = (name: string, fallback: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
if (existsSync(".env")) process.loadEnvFile(".env");
loadWindowsNousEnvironment();

const models = flag(
  "models",
  "kilo:dots-studio/dots-3-note-preview:free,mistral:codestral-latest",
).split(",");
const count = Number(flag("situations", "8"));
const compare = flag("compare", "expansion");
const campaignId = flag("campaign", "696781ac-c047-4e90-a84a-4bf84960bbe4");
const campaign = CampaignSchema.parse(
  JSON.parse(readFileSync(`worlds/spectator/${campaignId}.json`, "utf8")),
);
const { history } = replayCampaign(campaign);
const eligible = history
  .map((state, turn) => ({ state, turn }))
  .filter(({ state }) => {
    const civ = activeCiv(state);
    if (!civ) return false;
    const c = state.world.civs.find((x) => x.id === civ)!;
    const sim = state.world.simulation!;
    const cities = sim.cities.filter((x) => x.owner === civ).length;
    const settlers = sim.units.filter(
      (u) => u.owner === civ && u.role === "settler",
    ).length;
    return (
      c.population >= housingCapacity(c, cities, "v11") - 1 &&
      affordable(c.stock, SETTLER_COST) &&
      settlers < 2
    );
  });
// Réparties sur la partie, et sur les civilisations.
const step = Math.max(1, Math.floor(eligible.length / count));
const situations = eligible.filter((_, i) => i % step === 0).slice(0, count);

const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "expansion")
        .map(([key, inner]) => [key, strip(inner)]),
    );
  return value;
};
// Le fetch d'origine, capturé avant tout remplacement (leçon de settler-probe).
const realFetch = globalThis.fetch;
const withoutExpansion: typeof fetch = async (input, init) => {
  if (init?.body) {
    const body = JSON.parse(String(init.body));
    for (const m of body.messages ?? []) {
      if (typeof m.content !== "string") continue;
      if (m.role === "system")
        m.content = m.content.split(EXPANSION_INSTRUCTION).join("");
      else if (m.content.startsWith("{"))
        m.content = JSON.stringify(strip(JSON.parse(m.content)));
    }
    init = { ...init, body: JSON.stringify(body) };
  }
  return realFetch(input, init);
};

// La variante B est la consigne en vigueur depuis la mesure ; A la défait.
const currentObjective: typeof fetch = async (input, init) => {
  if (init?.body) {
    const body = JSON.parse(String(init.body));
    for (const m of body.messages ?? []) {
      if (typeof m.content !== "string") continue;
      if (m.role === "system")
        m.content = m.content.split(OBJECTIVE_INSTRUCTION).join("");
      else if (m.content.startsWith("{")) {
        const { previousObjective, ...rest } = JSON.parse(m.content);
        m.content = JSON.stringify({ ...rest, objective: previousObjective });
      }
    }
    init = { ...init, body: JSON.stringify(body) };
  }
  return realFetch(input, init);
};

type Row = {
  model: string;
  turn: number;
  civ: string;
  variant: "A" | "B";
  source: string;
  servedByModel: boolean;
  recruit: boolean | null;
  settle: boolean | null;
  objective: string | null;
  echo: boolean | null;
  research: string | null;
};
const rows: Row[] = [];
for (const model of models)
  for (const { state, turn } of situations)
    for (const variant of ["A", "B"] as const) {
      const civ = activeCiv(state)!;
      const fetchImpl =
        compare === "objective"
          ? variant === "A"
            ? currentObjective
            : realFetch
          : variant === "A"
            ? withoutExpansion
            : realFetch;
      const answer = await requestValidatedCouncil(
        state,
        civ,
        "remote",
        model,
        process.env,
        fetchImpl,
      );
      const d = answer.decision;
      rows.push({
        model,
        turn,
        civ,
        variant,
        source: answer.source,
        servedByModel: answer.model === model,
        recruit: d ? !!d.recruitSettler : null,
        settle: d ? (d.orders ?? []).some((o) => o.action === "settle") : null,
        objective: d?.objective ?? null,
        echo: d ? d.objective === (state.objectives[civ] ?? null) : null,
        research: d?.research ?? null,
      });
      console.log(
        `${model.slice(0, 32).padEnd(32)} action ${String(turn).padStart(4)} ${civ.padEnd(8)} ${variant} : ` +
          `${answer.source} colon=${rows.at(-1)!.recruit} fonder=${rows.at(-1)!.settle} echo=${rows.at(-1)!.echo}`,
      );
      await new Promise((r) =>
        setTimeout(r, model.startsWith("kilo:") ? 19_000 : 3_000),
      );
    }

const summary = Object.fromEntries(
  models.flatMap((model) =>
    (["A", "B"] as const).map((v) => {
      const mine = rows.filter(
        (r) => r.model === model && r.variant === v && r.servedByModel,
      );
      return [
        `${model} ${v}`,
        {
          answered: mine.length,
          recruit: mine.filter((r) => r.recruit).length,
          settle: mine.filter((r) => r.settle).length,
          echo: mine.filter((r) => r.echo).length,
        },
      ];
    }),
  ),
);
console.log(summary);
writeFileSync(
  compare === "objective"
    ? "docs/reports/objective-probe.json"
    : "docs/reports/expansion-probe.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      campaign: campaignId,
      compare,
      eligible: eligible.length,
      situations: situations.map((s) => s.turn),
      summary,
      rows,
    },
    null,
    2,
  ) + "\n",
);
