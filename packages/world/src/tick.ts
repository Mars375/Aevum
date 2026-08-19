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
    | "HARD_YEAR"
    /** The world has no unclaimed land left. From here, growth is at someone's expense. */
    | "LAND_FULL"
    | "SEIZED"
    | "CEDED"
    | "TRADED"
    /** Bandits took what a civilisation failed to guard. */
    | "RAIDED"
    /** Bandits came and were driven off. */
    | "REPELLED";
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

/**
 * A raw unit value from (seed, tick, salt). Same mix as `season`, different
 * salt, so the harvest and the bandits are not the same die rolled twice.
 */
function noise(seed: number, tick: number, salt: number): number {
  let h = (seed * 0x27d4eb2d) ^ (tick * 0x165667b1) ^ (salt * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}

/** Civilisation ids are names, not numbers; this makes one a salt. */
const saltOf = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/**
 * Bandits.
 *
 * A world with no pressure but its own harvest settles into a long calm, and a
 * calm world is one nobody watches. Bandits keep it moving without any
 * civilisation having to be the aggressor.
 *
 * Two rules make them a pressure rather than a guillotine:
 *   - they are drawn to wealth. A rich, unguarded civilisation is raided often;
 *     a poor one is left alone, so raids do not simply finish off whoever is
 *     already losing.
 *   - what they take is a share of what is there, never a fixed amount. A
 *     village loses a village's worth and survives it; the same raid on an
 *     empire takes an empire's worth. Nothing is ever destroyed at a stroke.
 */
const RAID_MAX_POP_LOSS = 0.06;
const RAID_MAX_WEALTH_LOSS = 0.25;
const RAID_MAX_FOOD_LOSS = 0.2;

export interface Raid {
  /** 0 when the bandits never came. */
  strength: number;
  repelled: boolean;
}

/**
 * How much harder the world presses as an era ages.
 *
 * Without this, three civilisations settle into a guarded equilibrium and hold
 * it for a thousand years — measured, not guessed: an era that never resolves
 * is an era nobody finishes watching. Pressure rises slowly and then stops
 * rising, so a young world is survivable and an old one is not comfortable.
 */
export const pressure = (tick: number): number => 1 + Math.min(1.5, tick / 400);

export function raidOn(civ: Civ, seed: number, tick: number): Raid {
  const draw = noise(seed, tick, saltOf(civ.id));
  // Wealth per head is what attracts them: a large poor civilisation is not a
  // more tempting target than a small rich one.
  const perHead = civ.stock.wealth / Math.max(1, civ.population);
  // Bandits do not ride out for nothing. A civilisation with no surplus is left
  // alone — without this the pressure ground every civilisation down to twenty
  // souls and held them there forever, which is a worse stagnation than the one
  // it was meant to cure.
  if (perHead < 0.3) return { strength: 0, repelled: false };

  const chance = Math.min(0.35, (0.03 + perHead * 0.02) * pressure(tick));
  if (draw > chance) return { strength: 0, repelled: false };

  // Age raises how often they come, never how much they take in one visit: the
  // ceilings below are absolute, so a village always loses a village's share
  // and survives it.
  const strength = 0.35 + noise(seed, tick, saltOf(civ.id) ^ 0x5bf03635) * 0.65;
  const guard = civ.doctrine.posture === "GUARD" ? 1.6 : 1;
  const defence = (civ.soldiers * guard) / Math.max(1, civ.population / 20);
  return { strength, repelled: defence >= strength };
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

function tickCiv(civ: Civ, tick: number, harvest: number, freeLand: number, seed: number): { civ: Civ; events: TickEvent[] } {
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
  if (wantsLand && freeLand <= 0) {
    // Not a failure — a fact the ruler needs. Expansion from here is a foreign
    // policy question, not a forestry one.
    say("LAND_FULL", "plus une terre libre dans le monde");
  }
  if (wantsLand && freeLand > 0 && stock.timber >= 60) {
    stock.timber = round2(stock.timber - 60);
    territory += 1;
    say("EXPANDED", `frontiere portee a ${territory}`);
  } else if (territory > 1 && population < (territory - 1) * 15) {
    // Land nobody works reverts. A civilisation shrinks quietly, without a war.
    territory -= 1;
    say("LOST_LAND", `terre abandonnee, frontiere a ${territory}`);
  }

  soldiers = Math.max(0, Math.round(soldiers + population * s.military * 0.05 - soldiers * 0.02));

  const raid = raidOn({ ...civ, population, soldiers, stock, territory }, seed, tick);
  if (raid.strength > 0 && raid.repelled) {
    // Driving them off still costs soldiers. A garrison that never bleeds is a
    // garrison nobody has a reason to fund.
    soldiers = Math.max(0, soldiers - Math.ceil(soldiers * 0.05 * raid.strength));
    say("REPELLED", "bandits repousses");
  } else if (raid.strength > 0) {
    const lostPop = Math.min(
      Math.floor(population * RAID_MAX_POP_LOSS * raid.strength),
      Math.max(0, population - 1),
    );
    const lostWealth = round2(stock.wealth * RAID_MAX_WEALTH_LOSS * raid.strength);
    const lostFood = round2(stock.food * RAID_MAX_FOOD_LOSS * raid.strength);
    population -= lostPop;
    soldiers = Math.max(0, soldiers - Math.ceil(soldiers * 0.15 * raid.strength));
    stock.wealth = round2(stock.wealth - lostWealth);
    stock.food = round2(stock.food - lostFood);
    say("RAIDED", `pillage : ${lostPop} morts, ${Math.round(lostWealth)} richesse et ${Math.round(lostFood)} vivres emportes`);
  }

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
  const freeLand = world.land - world.civs.reduce((n, c) => n + c.territory, 0);
  // Canonical id order, as everywhere else in this project: the result must not
  // depend on the order civilisations happen to sit in the array.
  const civs = [...world.civs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((civ) => {
      if (!isAlive(civ)) return civ;
      const r = tickCiv(civ, tick, harvest, freeLand, world.seed);
      events.push(...r.events);
      return r.civ;
    });

  return { world: { ...world, tick, civs: contact(civs, tick, events) }, events };
}

/**
 * What civilisations do to each other.
 *
 * Deliberately thin. The engine decides outcomes; postures are what rulers
 * chose, and this only resolves them. Everything here is a pure function of
 * the civilisation list in canonical id order, so contact cannot depend on who
 * happens to be first in the array.
 */
function contact(civs: Civ[], tick: number, events: TickEvent[]): Civ[] {
  const alive = civs.filter(isAlive);
  if (alive.length < 2) return civs;

  const byId = new Map(civs.map((c) => [c.id, { ...c }]));

  // Trade is mutual or it does not happen: a civilisation cannot enrich itself
  // by declaring goodwill at someone who is arming against it.
  const traders = alive.filter((c) => c.doctrine.posture === "TRADE");
  if (traders.length >= 2) {
    for (const c of traders) {
      const partner = byId.get(c.id)!;
      const gain = Math.round(partner.population * 0.05);
      partner.stock = { ...partner.stock, wealth: round2(partner.stock.wealth + gain) };
      events.push({ tick, civ: c.id, kind: "TRADED", detail: `commerce avec ${traders.length - 1} voisin(s), +${gain} richesse` });
    }
  }

  for (const aggressor of alive.filter((c) => c.doctrine.posture === "PRESSURE")) {
    // The weakest living neighbour, by soldiers then by id so the choice is
    // never left to array order.
    const target = alive
      .filter((c) => c.id !== aggressor.id && c.territory > 1)
      .sort((a, b) => a.soldiers - b.soldiers || a.id.localeCompare(b.id))[0];
    if (!target) continue;

    const attacker = byId.get(aggressor.id)!;
    const defender = byId.get(target.id)!;
    // Guarding is worth something, or nobody would ever choose it over pressing.
    const defence = defender.soldiers * (defender.doctrine.posture === "GUARD" ? 1.5 : 1);
    if (attacker.soldiers <= defence * 1.2) continue;

    // Land changes hands and both sides pay for it. A seizure that costs the
    // taker nothing would make PRESSURE the only rational posture.
    attacker.territory += 1;
    defender.territory -= 1;
    attacker.soldiers = Math.max(0, attacker.soldiers - Math.ceil(defence * 0.3));
    defender.soldiers = Math.max(0, defender.soldiers - Math.ceil(defender.soldiers * 0.4));
    events.push({ tick, civ: attacker.id, kind: "SEIZED", detail: `terre prise a ${defender.id}` });
    events.push({ tick, civ: defender.id, kind: "CEDED", detail: `terre perdue au profit de ${attacker.id}` });
  }

  return civs.map((c) => byId.get(c.id)!);
}
