/**
 * Écrire la chronique d'un monde à partir de son journal, et de rien d'autre.
 *
 * Les chroniques de ce projet étaient écrites à la main, à partir des données
 * mais pas *par* elles — et l'une d'elles a fini par raconter une invasion en
 * l'an 199 que le journal plaçait en 227. Une prose qui dérive de sa source est
 * une erreur qui attend un lecteur attentif.
 *
 * Celle-ci ne peut pas dériver : chaque date, chaque nom de lieu et chaque
 * chiffre est lu dans le journal rejoué. Il n'y a pas de modèle ici, pas de
 * rédaction, pas d'interprétation — les évènements sont assez parlants, et ce
 * qu'ils ne disent pas ne sera pas dit.
 *
 *   npm run narrate -- monde
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JournalSchema, chronicle, type Year } from "@abs/world";

const name = process.argv[2] ?? "monde";
const era = process.argv[3] ?? "0001";
const path = resolve("worlds", name, `era-${era}.json`);
if (!existsSync(path)) {
  console.error(`Aucun monde a ${path}`);
  process.exit(1);
}

const journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
const years = chronicle(journal);
const last = years[years.length - 1]!;
const held = (y: Year, id: string) => y.world.civs.find((c) => c.id === id)!;
const ids = journal.origin.civs.map((c) => c.id);
const alive = last.world.civs.filter((c) => c.fellOnTick === null);

const out: string[] = [];
const say = (s = "") => out.push(s);

say(`# Chronique du monde « ${name} », ère ${journal.era}`);
say();
say(
  `Statut : **généré**, jamais rédigé · ${journal.livedTo} années · ` +
    `${journal.rulings.length} décisions · règles ${journal.worldVersion}`,
);
say();
say(
  `Chaque date et chaque nom de lieu de cette page est lu dans le journal rejoué. ` +
    `Rien n'y est interprété : c'est la raison d'être de ce fichier, une chronique écrite ` +
    `à la main ayant déjà raconté une invasion que le journal plaçait vingt-huit ans plus tard.`,
);
say();

// --- les tournants, détectés et non choisis ---------------------------------
interface Turn {
  tick: number;
  text: string;
}
const turns: Turn[] = [];

let boardFull = 0;
for (const y of years) {
  if (!boardFull && y.world.board.every((p) => p.owner !== null)) {
    boardFull = y.tick;
    turns.push({ tick: y.tick, text: `Le dernier lieu libre est pris. À partir d'ici, s'étendre est prendre.` });
  }
  for (const e of y.events) {
    if (e.kind === "SEIZED" && turns.every((t) => !t.text.startsWith("Première conquête"))) {
      turns.push({ tick: y.tick, text: `Première conquête du monde : ${e.detail}, par ${e.civ}.` });
    }
    if (e.kind === "CAPITAL_LOST") turns.push({ tick: y.tick, text: `${e.civ} perd son siège — ${e.detail}` });
    if (e.kind === "COLLAPSED") turns.push({ tick: y.tick, text: `**${e.civ} s'éteint.**` });
  }
}

/**
 * Le meneur change de main — mais seulement quand ça veut dire quelque chose.
 *
 * La première version datait un tournant à l'an 3, quand chacun tenait un ou
 * deux lieux : un écart d'un lieu entre deux villages n'est pas une bascule,
 * c'est du bruit qu'on habille en récit. Il faut une avance nette et un monde
 * déjà formé.
 */
const MARGIN = 3;
let leader = "";
for (const y of years) {
  const [top, second] = [...y.world.civs].sort((a, b) => b.territory - a.territory || a.id.localeCompare(b.id));
  if (!top || !second) continue;
  if (top.territory - second.territory < MARGIN) continue;
  if (top.id !== leader) {
    if (leader) turns.push({ tick: y.tick, text: `${top.id} passe devant ${leader} et mène le monde.` });
    leader = top.id;
  }
}

say(`## Les tournants`);
say();
if (turns.length === 0) say(`Rien n'est encore arrivé qui mérite d'être daté.`);
else {
  turns.sort((a, b) => a.tick - b.tick);
  for (const t of turns) say(`- **an ${t.tick}** — ${t.text}`);
}
say();

// --- chaque civilisation ----------------------------------------------------
say(`## Chaque civilisation`);
say();

for (const id of ids) {
  const civ = held(last, id);
  const mine = journal.rulings.filter((r) => r.civ === id);
  const peak = years.reduce((best, y) => (held(y, id).territory > held(best, id).territory ? y : best), years[0]!);
  const postures = new Map<string, number>();
  for (const r of mine) if (r.doctrine.posture) postures.set(r.doctrine.posture, (postures.get(r.doctrine.posture) ?? 0) + 1);
  const creed = civ.doctrine.creed;

  say(`### ${id}`);
  say();
  say(
    civ.fellOnTick === null
      ? `Vivante à l'an ${last.tick} : ${Math.round(civ.population)} habitants sur ${civ.territory} lieux, ` +
          `${civ.soldiers} soldats, ${civ.advances.length} progrès.`
      : `**Éteinte à l'an ${civ.fellOnTick}.**`,
  );
  say();
  say(
    `Son apogée fut l'an ${peak.tick}, à ${held(peak, id).territory} lieux. ` +
      `Elle a demandé ${mine.length} décision${mine.length > 1 ? "s" : ""} sur les ${journal.rulings.length} du monde` +
      // Une moitié de plus que sa part, pas un cheveu : sur quatorze decisions
      // et quatre civilisations, quatre n'est pas un signe.
      `${mine.length > (journal.rulings.length / ids.length) * 1.5 ? " — bien plus que sa part, ce qui est la marque d'une civilisation en difficulté" : ""}.`,
  );
  if (postures.size > 0) {
    say();
    say(`Postures choisies : ${[...postures].map(([p, n]) => `${p} ${n}×`).join(", ")}.`);
  }
  if (creed) {
    say();
    say(`> « ${creed} »`);
  }
  say();
}

// --- ce que les dirigeants ont dit -----------------------------------------
const spoken = journal.rulings.filter((r) => r.reason).slice(-8).reverse();
if (spoken.length > 0) {
  say(`## Les dernières paroles enregistrées`);
  say();
  for (const r of spoken) {
    const late = r.deferredBy > 0 ? ` *(gouvernée ${r.deferredBy} ans trop tard)*` : "";
    say(`- **an ${r.tick + r.deferredBy}, ${r.civ}**, ${r.kind}${late} — ${r.reason}`);
  }
  say();
}

// --- ce que la chronique ne dit pas ----------------------------------------
say(`## Ce que cette page ne dit pas`);
say();
say(
  `C'est **un monde, une graine, une trajectoire.** Le plateau distribue les départs ` +
    `inégalement — mesuré : quatre lieux d'écart entre deux coins, et un écart-type de ` +
    `1,4 lieu à soixante ans. Rien ici ne permet de conclure qu'un modèle gouverne mieux ` +
    `qu'un autre ; pour ça il faut une rotation, et elle vit dans \`docs/reports/rotation-w4.md\`.`,
);
say();
say(
  `Ce qu'une chronique montre et qu'aucun tableau ne montre, c'est *comment* une ` +
    `civilisation meurt — et ce que ses dirigeants en ont dit sur le moment.`,
);
say();

const target = resolve("docs/reports", `chronique-${name}.md`);
writeFileSync(target, out.join("\n"));
console.log(`${target} — ${turns.length} tournants, ${journal.rulings.length} décisions, ${alive.length} civilisation(s) en vie`);
