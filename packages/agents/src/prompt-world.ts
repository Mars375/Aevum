import type { Civ, DecisionPoint } from "@abs/world";

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

export function systemPromptWorld(): string {
  return [
    "You rule one civilisation in a world that does not end. There is no victory and no final turn.",
    "A deterministic engine simulates every year on its own. You are woken only when the world reaches something your standing doctrine cannot answer.",
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
    "You also leave a creed: what this civilisation believes about itself, in one or two sentences.",
    "Your successors inherit it and nothing else of you. Write it for them, not for a spectator.",
    "",
    "Answer with JSON only, matching the provided schema.",
  ].join("\n");
}

const pct = (n: number, total: number) => `${Math.round((n / (total || 1)) * 100)}%`;

export function userPromptWorld(civ: Civ, point: DecisionPoint): string {
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
    `- stores: ${Math.round(civ.stock.food)} food, ${Math.round(civ.stock.timber)} timber, ${Math.round(civ.stock.ore)} ore, ${Math.round(civ.stock.wealth)} wealth`,
    `- advances: ${civ.advances.length > 0 ? civ.advances.join(", ") : "none yet"}`,
    "",
    "Standing doctrine:",
    `- farming ${pct(d.farming, total)}, forestry ${pct(d.forestry, total)}, mining ${pct(d.mining, total)}, trade ${pct(d.trade, total)}, military ${pct(d.military, total)}`,
    d.creed ? `- creed inherited from your predecessors: "${d.creed}"` : "- no creed has been written yet. You are the first.",
    "",
    "Set the shares your people will work under until something else wakes you, and leave a creed.",
  ].join("\n");
}

/** Hand-written for `strict` structured output, like ORDER_JSON_SCHEMA and guarded the same way. */
export const RULING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "creed", "farming", "forestry", "mining", "trade", "military"],
  properties: {
    reasoning: { type: "string", description: "One or two sentences on why, written for a spectator." },
    creed: { type: "string", description: "What this civilisation believes about itself. Inherited by your successors." },
    farming: { type: "number", description: "Relative share of the workforce farming." },
    forestry: { type: "number" },
    mining: { type: "number" },
    trade: { type: "number" },
    military: { type: "number" },
  },
} as const;
