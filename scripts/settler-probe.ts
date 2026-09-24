/**
 * settler-probe — le modèle de réponse du conseil fixe-t-il recruitSettler ?
 *
 * Les dirigeants distants ne recrutaient presque jamais de colon : 1 demande
 * en 480 tours, 0 en 1 075, alors qu'un colon était abordable 9 fois sur 10.
 * Le modèle de réponse de la consigne écrit « "recruitSettler":false », une
 * valeur déjà remplie, là où les autres champs disent leurs possibilités.
 *
 * Mêmes situations réelles, mêmes modèles, une seule différence : ce champ du
 * modèle de réponse. A = tel quel ; B = « true or false ». Rien d'autre de la
 * consigne ne bouge — ni la phrase finale sur la conquête, ni les
 * personnalités, qui sont des choix de conception.
 *
 * Usage : npx tsx scripts/settler-probe.ts [--models=a,b] [--situations=8]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  CampaignSchema,
  replayCampaign,
} from "../packages/world/src/campaign.js";
import { activeCiv } from "../packages/world/src/spectator.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
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
const campaign = CampaignSchema.parse(
  JSON.parse(
    readFileSync("worlds/spectator/partie-modeles-stables.json", "utf8"),
  ),
);
const { history } = replayCampaign(campaign);
// Des situations où un colon est abordable et permis, réparties sur la partie.
const eligible = history
  .map((state, turn) => ({ state, turn }))
  .filter(({ state }) => {
    const civ = activeCiv(state);
    if (!civ) return false;
    const c = state.world.civs.find((x) => x.id === civ)!;
    const settlers = state.world.simulation!.units.filter(
      (u) => u.owner === civ && u.role === "settler",
    ).length;
    return (
      c.stock.food >= 50 &&
      c.stock.timber >= 60 &&
      c.stock.wealth >= 20 &&
      settlers < 2
    );
  });
const step = Math.max(1, Math.floor(eligible.length / count));
const situations = eligible.filter((_, i) => i % step === 0).slice(0, count);

// Le fetch d'origine, capturé avant tout remplacement : l'enveloppe l'appelait
// elle-même, en boucle, et chaque conseil finissait « indisponible ».
const realFetch = globalThis.fetch;
const variant =
  (neutral: boolean): typeof fetch =>
  async (input, init) => {
    if (neutral && init?.body) {
      const body = JSON.parse(String(init.body));
      for (const m of body.messages ?? [])
        if (typeof m.content === "string")
          m.content = m.content
            .split('"recruitSettler":false')
            .join('"recruitSettler":true or false');
      init = { ...init, body: JSON.stringify(body) };
    }
    return realFetch(input, init);
  };

const rows: {
  model: string;
  turn: number;
  variant: string;
  source: string;
  recruit: boolean | null;
}[] = [];
for (const model of models)
  for (const { state, turn } of situations)
    for (const neutral of [false, true]) {
      globalThis.fetch = variant(neutral);
      const civ = activeCiv(state)!;
      const answer = await requestValidatedCouncil(state, civ, "remote", model);
      globalThis.fetch = realFetch;
      const recruit = answer.decision ? !!answer.decision.recruitSettler : null;
      rows.push({
        model,
        turn,
        variant: neutral ? "B" : "A",
        source: answer.source,
        recruit,
      });
      console.log(
        `${model.slice(0, 32).padEnd(32)} tour ${String(turn).padStart(3)} ${neutral ? "B" : "A"} : ${answer.source} colon=${recruit}`,
      );
      await new Promise((r) =>
        setTimeout(r, model.startsWith("kilo:") ? 19_000 : 3_000),
      );
    }
const summary = Object.fromEntries(
  models.flatMap((model) =>
    ["A", "B"].map((v) => {
      const mine = rows.filter(
        (r) => r.model === model && r.variant === v && r.recruit !== null,
      );
      return [
        `${model} ${v}`,
        `${mine.filter((r) => r.recruit).length}/${mine.length}`,
      ];
    }),
  ),
);
console.log(summary);
writeFileSync(
  "docs/reports/settler-probe.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      situations: situations.map((s) => s.turn),
      summary,
      rows,
    },
    null,
    2,
  ) + "\n",
);
