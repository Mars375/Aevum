import { isAlive, type Civ, type Doctrine, type Stock, type World } from "./state.js";

/**
 * One tick of the world.
 *
 * Pure and deterministic, like every engine in this project: no clock, no
 * network, no global state. Same world in, same world out, forever. That is
 * what lets a continuous world be replayed and audited rather than merely
 * watched.
 *
 * It is also deliberately cheap. This runs hundreds of times between two LLM
 * calls, so nothing here may be expensive or clever.
 */

export interface TickEvent {
  tick: number;
  civ: Civ["id"];
  /** Machine-readable so the decision detector and the chronicle can both read it. */
  kind:
    | "GREW"
    | "STARVED"
    | "EXPANDED"
    | "LOST_LAND"
    | "ADVANCE"
    | "COLLAPSED"
    | "SURPLUS"
    | "SHORTAGE"
    | "HARD_YEAR";
  detail: string;
}

export interface TickResult {
  world: World;
  events: TickEvent[];
}

/** Shares are normalised here so a ruler may answer in any scale it likes. */
export function shares(d: Doctrine): Record<"farming" | "forestry" | "mining" | "trade" | "military", number> {
  const raw = { farming: d.farming, forestry: d.forestry, mining: d.mining, trade: d.trade, military: d.military };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return { farming: 1, forestry: 0, mining: 0, trade: 0, military: 0 };
  return {
    farming: raw.farming / total,
    forestry: raw.forestry / total,
    mining: raw.mining / total,
    trade: raw.trade / total,
    military: raw.military / total,
  };
}

/** Advances are milestones, not victories: passing one changes nothing about whether the world continues. */
const ADVANCES: Array<{ name: string; when: (c: Civ) => boolean }> = [
  { name: "irrigation", when: (c) => c.stock.food >= 600 },
  { name: "masonry", when: (c) => c.stock.timber >= 400 && c.territory >= 8 },
  { name: "metallurgy", when: (c) => c.stock.ore >= 300 },
  { name: "coinage", when: (c) => c.stock.wealth >= 500 },
  { name: "engineering", when: (c) => c.advances.includes("masonry") && c.advances.includes("metallurgy") },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Years are not alike.
 *
 * A world where the harvest is the same every tick has no history — the first
 * measurement showed exactly that: 79% of the wake-ups were "nothing has
 * happened for forty ticks". Adversity has to come from somewhere, and it must
 * not come from Math.random(), which would break replay.
 *
 * So the season is a pure function of (seed, tick): the same world lives the
 * same years, every time it is replayed, while no ruler can predict them from
 * the doctrine it wrote.
 */
export function season(seed: number, tick: number): number {
  // xorshift-style mix over the two integers. Cheap, deterministic, and good
  // enough for "was this a hard year" — it is not being used for cryptography.
  let h = (seed * 0x9e3779b1) ^ (tick * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
  h ^= h >>> 13;
  const unit = (h >>> 0) / 0x100000000;
  // Famine years are rarer than good ones, and harsher: 0.55x to 1.35x.
  return 0.55 + unit ** 0.7 * 0.8;
}

function produce(civ: Civ, harvest: number): Stock {
  const s = shares(civ.doctrine);
  const workers = civ.population;
  // Land limits what people can work: doubling population on the same territory
  // does not double output. This is what makes expansion matter.
  const land = Math.min(1, civ.territory / Math.max(1, workers / 25));
  const yieldOf = (share: number, rate: number) => workers * share * rate * land;

  // A farmer feeds several people — that is the whole reason a civilisation can
  // afford anyone who is not a farmer. The first measurement had this backwards
  // (0.9 produced against 0.8 eaten) and every civilisation starved by tick 12.
  return {
    // Only food follows the season. A bad year is a bad harvest, not a mine
    // that stops working.
    food: yieldOf(s.farming, 2.5) * harvest,
    timber: yieldOf(s.forestry, 1.2),
    ore: yieldOf(s.mining, 0.8),
    wealth: yieldOf(s.trade, 1.0),
  };
}

function tickCiv(civ: Civ, tick: number, harvest: number): { civ: Civ; events: TickEvent[] } {
  const events: TickEvent[] = [];
  const say = (kind: TickEvent["kind"], detail: string) => events.push({ tick, civ: civ.id, kind, detail });

  const gained = produce(civ, harvest);
  if (harvest < 0.75) say("HARD_YEAR", `mauvaise recolte (${harvest.toFixed(2)}x)`);
  const s = shares(civ.doctrine);

  // Everyone eats; soldiers eat more and cost coin.
  const eaten = civ.population * 0.8 + civ.soldiers * 1.5;
  const upkeep = civ.soldiers * 0.6;

  const stock: Stock = {
    food: round2(civ.stock.food + gained.food - eaten),
    timber: round2(civ.stock.timber + gained.timber),
    ore: round2(civ.stock.ore + gained.ore),
    wealth: round2(civ.stock.wealth + gained.wealth - upkeep),
  };

  let population = civ.population;
  let territory = civ.territory;
  let soldiers = civ.soldiers;

  if (stock.food < 0) {
    // Famine: people die and the granary empties. Never a negative store —
    // debt in food is just death.
    const lost = Math.min(population, Math.ceil(-stock.food / 2));
    population -= lost;
    stock.food = 0;
    say("STARVED", `famine, ${lost} morts`);
  } else if (stock.food > population * 4) {
    population += Math.max(1, Math.floor(population * 0.02));
    say("GREW", `abondance, population ${population}`);
  }

  if (stock.wealth < 0) {
    // Unpaid soldiers desert rather than the treasury going negative.
    const deserted = Math.min(soldiers, Math.ceil(-stock.wealth / 2));
    soldiers -= deserted;
    stock.wealth = 0;
    say("SHORTAGE", `solde impayee, ${deserted} desertions`);
  }

  // Expansion is bought with timber and people, and only while both allow.
  const wantsLand = population / 25 > territory;
  if (wantsLand && stock.timber >= 60) {
    stock.timber = round2(stock.timber - 60);
    territory += 1;
    say("EXPANDED", `frontiere portee a ${territory}`);
  } else if (territory > 1 && population < (territory - 1) * 15) {
    // Land nobody works reverts. A civilisation shrinks quietly, without a war.
    territory -= 1;
    say("LOST_LAND", `terre abandonnee, frontiere a ${territory}`);
  }

  soldiers = Math.max(0, Math.round(soldiers + population * s.military * 0.05 - soldiers * 0.02));

  const advances = [...civ.advances];
  for (const a of ADVANCES) {
    if (advances.includes(a.name)) continue;
    if (a.when({ ...civ, stock, territory, advances })) {
      advances.push(a.name);
      say("ADVANCE", `progres : ${a.name}`);
    }
  }

  let fellOnTick = civ.fellOnTick;
  if (population <= 0) {
    population = 0;
    fellOnTick = tick;
    say("COLLAPSED", "la civilisation s'est éteinte");
  } else if (stock.food > population * 10 && stock.wealth > 400) {
    say("SURPLUS", "greniers et coffres pleins");
  }

  return {
    civ: { ...civ, population, territory, soldiers, stock, advances, fellOnTick, ticksSinceDecision: civ.ticksSinceDecision + 1 },
    events,
  };
}

export function tickWorld(world: World): TickResult {
  const tick = world.tick + 1;
  // One season for the whole world: civilisations share a climate, so a bad
  // year is something neighbours can talk about rather than private bad luck.
  const harvest = season(world.seed, tick);
  const events: TickEvent[] = [];
  // Canonical id order, as everywhere else in this project: the result must not
  // depend on the order civilisations happen to sit in the array.
  const civs = [...world.civs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((civ) => {
      if (!isAlive(civ)) return civ;
      const r = tickCiv(civ, tick, harvest);
      events.push(...r.events);
      return r.civ;
    });

  return { world: { ...world, tick, civs }, events };
}
