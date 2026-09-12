import { frontier, type Civ, type DecisionPoint, type World } from "@abs/world";

/**
 * What a ruler is told, and what a ruler answers.
 *
 * Same discipline as the battle prompts: public world state and nothing else.
 * No key, no path, no environment value ever reaches a remote model.
 *
 * The difference from a battle is the creed. A general commands one battle and
 * is forgotten; a ruler inherits a text its predecessors wrote about this
 * civilisation, and leaves that text changed. The model's weights do not
 * change between calls — this is the only thing that actually evolves, and
 * calling it what it is (inherited doctrine, not learning) keeps the project
 * honest about what it demonstrates.
 */

export function systemPromptWorld(version = "w8"): string {
  if (version === "w10") return [
    "You govern a civilization in a deterministic strategy simulation. Choose policy; the engine executes it over years.",
    "Return JSON only, matching the provided schema. Explain your reasoning and preserve a short inherited creed.",
    "Workforce shares farming/forestry/mining/trade/military are normalized. Soldiers are part of population and do not produce.",
    "People consume food; armies cost wages, ore and recruitment money. Food deficits cause famine. Unpaid soldiers desert.",
    "Settlers cost 60 timber, 20 wealth and 50 food with a food reserve; they must physically reach adjacent unclaimed land.",
    "Cities build granaries, workshops, markets, walls and academies over several years, paying resources up front.",
    "Choose focus: balanced or growth prioritizes granaries; industry workshops and masonry; science academies with 10% lower production and 40% faster research; military walls and metallurgy.",
    "Research unlocks irrigation (food), masonry (housing), metallurgy (ore and combat), coinage (trade), engineering (river crossings and construction), scholarship (research).",
    "TRADE creates bilateral trade when both adjacent neighbors agree. GUARD defends with +25% strength. PRESSURE can declare war when your total army exceeds the neighbor by 15% and exceeds four soldiers.",
    "Armies move one adjacent tile per year, rivers slow crossings before engineering. Combat uses forces actually present, hills and city walls. Empty fronts can be vulnerable even with a large distant army.",
    "Peace follows mutual nonaggression or exhaustion after 20 war years; a twelve-year truce prevents immediate redeclaration.",
    "No land or no people means collapse. Existing cities and units are real state, not hypothetical plans. Do not invent actions outside the schema.",
  ].join("\n");
  return [
    "You rule one civilisation in a world that does not end. There is no victory and no final turn.",
    "A deterministic engine simulates every year on its own. You are woken only when the world reaches something your standing doctrine cannot answer.",
    "",
    "Land comes in four kinds, and each carries one kind of work. People put to work the ground cannot carry produce almost nothing.",
    "- plain carries farming.",
    "- forest carries forestry.",
    "- hill carries mining.",
    "- river carries trade, and waters fields too, which is why rivers are the scarcest land in the world.",
    "Each place carries about 25 workers.",
    "",
    "The world is a board of places, every one of them somewhere. You may only take what your own frontier touches:",
    "an unclaimed place beside you, or, under PRESSURE, a place held by a neighbour you actually border.",
    "Choose which kind you reach for; when none of that kind touches you, you take what does.",
    "Your seat is one of your places. Losing it costs you people and treasure, and you must sit down elsewhere —",
    "so a frontier that exposes your seat is worth more attention than one that exposes a field.",
    "",
    "You set how your people are employed. Shares are relative, not percentages — the engine normalises them.",
    "- farming feeds everyone. A farmer feeds several people; that surplus is what pays for everyone who is not a farmer.",
    "- forestry buys new land. Expanding a border costs timber.",
    "- mining and trade accumulate; they do not feed anyone.",
    "- military raises soldiers. Soldiers eat more than civilians and draw pay. Unpaid soldiers desert.",
    "",
    "Hard facts about this world:",
    "- Land limits what people can work. Doubling population on the same territory does not double output.",
    "- Harvests vary from year to year and you cannot predict them. Reserves are the only defence.",
    "- Stores never go negative: a food deficit kills people, a treasury deficit costs you soldiers.",
    "- A civilisation whose population reaches zero is gone for good. Nothing recovers it.",
    "",
    "Land in this world is finite. While some is unclaimed, you grow past your neighbours without ever meeting them; once it runs out, every acre you gain is one a neighbour loses.",
    "Choose how you carry yourself towards them:",
    "- TRADE enriches you, but only if a neighbour is trading too. You are told what your neighbours have chosen — read it before you choose.",
    "- GUARD takes land from nobody and makes you half again as costly to attack, but people on watch are people not working: it costs you 6% of everything you produce.",
    "- PRESSURE marches on a neighbour you border. If your soldiers clearly outnumber their defence you take a place; if they do not, your army is broken and most of it does not come back. Nothing stops you from trying either way.",
    "",
    "The world is not only unkind by season. Rivers flood, crowded cities take plague, and forests burn.",
    "Each disaster is invited by the ground that suffers it, so the land you covet carries a risk as well as a yield.",
    "",
    "You may also swear a vow: a floor your successors are bound to hold — food, soldiers, territory or population.",
    "The engine checks it every year and records the year it breaks. Swear one you believe can be held; a broken vow",
    "is inherited by everyone who follows you. Leave it out to keep the standing vow as it is.",
    "",
    "You also leave a creed: what this civilisation believes about itself, in one or two sentences.",
    "Your successors inherit it and nothing else of you. Write it for them, not for a spectator.",
    "",
    "Answer with JSON only, matching the provided schema.",
  ].join("\n");
}

const pct = (n: number, total: number) => `${Math.round((n / (total || 1)) * 100)}%`;

export function userPromptWorld(civ: Civ, point: DecisionPoint, world?: World): string {
  const d = civ.doctrine;
  const total = d.farming + d.forestry + d.mining + d.trade + d.military;

  return [
    `Year ${point.tick}. You rule ${civ.id}.`,
    "",
    "Why you were woken:",
    // W3: the evidence that raised the point travels with the question. A ruler
    // asked without being told why can only guess, and a reader cannot check.
    ...point.evidence.map((e) => `- ${e}`),
    "",
    "Your civilisation:",
    `- ${civ.population} people on ${civ.territory} territories, ${civ.soldiers} soldiers`,
    `- land: ${civ.lands.plain} plain, ${civ.lands.forest} forest, ${civ.lands.hill} hill, ${civ.lands.river} river`,
    ...(world
      ? [
          (() => {
            const f = frontier(world, civ.id);
            const free = world.board.filter((p) => p.owner === null).length;
            const seat = civ.capital !== null ? world.board[civ.capital]?.name : null;
            /**
             * Un voisin est visible : on voit s'il arme ou s'il commerce.
             *
             * Mesuré avant : 79 % des dirigeants choisissaient la garde. Le
             * commerce n'enrichit que s'il est mutuel et la pression ne réussit
             * qu'avec l'avantage militaire — deux choix qui dépendent
             * entièrement du voisin, et qu'on demandait à l'aveugle. Se garder
             * était la seule réponse défendable faute d'information.
             */
            const seen = f.neighbours.map((id) => {
              const other = world.civs.find((c) => c.id === id)!;
              return `${id} (${other.doctrine.posture}, ${other.soldiers} soldiers, ${other.territory} places)`;
            });
            return (
              `${seat ? `- your seat is ${seat}\n` : ""}- your frontier touches ${f.neutral} unclaimed place(s). ` +
              `${free} place(s) in the world are still unclaimed.\n` +
              (seen.length
                ? `- you border ${seen.join("; ")}`
                : "- you border no one yet: nobody can trade with you, and nobody can take from you")
            );
          })(),
        ]
      : []),
    `- stores: ${Math.round(civ.stock.food)} food, ${Math.round(civ.stock.timber)} timber, ${Math.round(civ.stock.ore)} ore, ${Math.round(civ.stock.wealth)} wealth`,
    `- advances: ${civ.advances.length > 0 ? civ.advances.join(", ") : "none yet"}`,
    ...(world?.simulation ? [
      `- development focus: ${d.focus ?? "balanced"}; science: ${civ.science ?? 0}`,
      `- cities: ${JSON.stringify(world.simulation.cities.filter(c => c.owner === civ.id))}`,
      `- units: ${JSON.stringify(world.simulation.units.filter(u => u.owner === civ.id))}`,
      `- diplomatic relations: ${JSON.stringify(world.simulation.relations.filter(r => r.a === civ.id || r.b === civ.id))}`,
      "- include focus in your answer: balanced, growth, industry, science or military.",
    ] : []),
    "",
    "Standing doctrine:",
    `- farming ${pct(d.farming, total)}, forestry ${pct(d.forestry, total)}, mining ${pct(d.mining, total)}, trade ${pct(d.trade, total)}, military ${pct(d.military, total)}`,
    `- posture towards neighbours: ${d.posture}`,
    `- land you reach for when expanding: ${d.claim}`,
    d.vow
      ? `- standing vow, sworn in year ${d.vow.sworn}: keep ${d.vow.metric} at or above ${d.vow.floor}${
          civ.vowBrokenOn !== null ? ` — BROKEN in year ${civ.vowBrokenOn}` : " — held so far"
        }`
      : "- no vow binds you. Your predecessors left none.",
    d.creed ? `- creed inherited from your predecessors: "${d.creed}"` : "- no creed has been written yet. You are the first.",
    "",
    // The closing list is what models actually answer to. Leaving a field out of
    // it means the field comes back empty, however carefully it was explained
    // above — measured twice now, first on the reasoning and then on the vow.
    "Answer with ALL of the following:",
    "- reasoning: why you are deciding this. Not decoration — it is what your civilisation will be remembered by. One or two sentences.",
    "- farming, forestry, mining, trade, military: the shares your people will work under.",
    "- claim: which of plain, forest, hill or river you will reach for next.",
    "- posture: TRADE, GUARD or PRESSURE.",
    "- vowMetric and vowFloor: the promise you bind your successors to, or vowMetric \"none\" to swear nothing new.",
    "- creed: what this civilisation believes about itself.",
    "All of it holds until something wakes you again.",
  ].join("\n");
}

/** Hand-written for `strict` structured output, like ORDER_JSON_SCHEMA and guarded the same way. */
export const RULING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "creed", "posture", "claim", "vowMetric", "vowFloor", "farming", "forestry", "mining", "trade", "military"],
  properties: {
    reasoning: { type: "string", description: "One or two sentences on why, written for a spectator." },
    creed: { type: "string", description: "What this civilisation believes about itself. Inherited by your successors." },
    posture: { type: "string", enum: ["TRADE", "GUARD", "PRESSURE"], description: "How you carry yourself towards your neighbours." },
    claim: { type: "string", enum: ["plain", "forest", "hill", "river"], description: "The kind of land you reach for when you expand or seize." },
    vowMetric: {
      type: "string",
      enum: ["food", "soldiers", "territory", "population", "none"],
      description: "What you bind your successors to hold, or \"none\" to swear nothing new.",
    },
    vowFloor: { type: "number", description: "The floor of that vow. Ignored when vowMetric is \"none\"." },
    farming: { type: "number", description: "Relative share of the workforce farming." },
    forestry: { type: "number" },
    mining: { type: "number" },
    trade: { type: "number" },
    military: { type: "number" },
  },
} as const;

export const CIVILIZATION_RULING_JSON_SCHEMA = {
  ...RULING_JSON_SCHEMA,
  required: [...RULING_JSON_SCHEMA.required, "focus"],
  properties: { ...RULING_JSON_SCHEMA.properties, focus: { type: "string", enum: ["balanced", "growth", "industry", "science", "military"] } },
};
