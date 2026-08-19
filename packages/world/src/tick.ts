import {
  LAND_KINDS,
  isAlive,
  landCount,
  type Civ,
  type Doctrine,
  type LandKind,
  type Lands,
  type Stock,
  type World,
} from "./state.js";

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
    | "REPELLED"
    /** A disaster struck. The land a civilisation covets carries a risk too. */
    | "DISASTER"
    /** A promise a predecessor made no longer holds. */
    | "VOW_BROKEN";
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

/** How many workers one parcel of land can carry before crowding. */
const WORKERS_PER_LAND = 25;

/**
 * Disasters.
 *
 * Bandits already keep a world from settling, but they only ever take what is
 * portable, so the land itself carried no risk — a civilisation that seized
 * every river was simply better off, with nothing to weigh against it. Each
 * disaster is tied to the ground that invites it, which is what turns "which
 * land do we covet" from an optimisation into a bet.
 *
 * Pure functions of (seed, tick, civ) like the seasons and the bandits, and
 * proportional like them: a share of what is there, never a fixed amount, so a
 * village loses a village's worth.
 */
export const DISASTERS = [
  {
    kind: "flood",
    label: "crue",
    // Rivers feed you and drown you. The scarcest, most contested land is also
    // the only one that can take a year's grain in a night.
    invites: (c: Civ) => c.lands.river,
    strike: (c: Civ) => ({ food: -0.35, population: -0.03, timber: -0.15 }),
  },
  {
    kind: "plague",
    label: "peste",
    // Crowding, not size: a large civilisation on ample land is no more exposed
    // than a small one.
    invites: (c: Civ) => Math.max(0, c.population / Math.max(1, c.territory) / 25 - 1) * 4,
    strike: () => ({ population: -0.12, food: 0, timber: 0 }),
  },
  {
    kind: "fire",
    label: "incendie",
    invites: (c: Civ) => c.lands.forest * 0.6,
    strike: () => ({ timber: -0.5, population: -0.01, food: -0.05 }),
  },
] as const;

export interface Disaster {
  kind: string;
  label: string;
  severity: number;
  strike: { food: number; population: number; timber: number };
}

export function disasterOn(civ: Civ, seed: number, tick: number): Disaster | null {
  const draw = noise(seed, tick, saltOf(civ.id) ^ 0x1b873593);
  let floor = 0;
  for (const d of DISASTERS) {
    // Exposure buys likelihood, and nothing else: the severity of a flood does
    // not grow with the number of rivers, or holding many would be fatal rather
    // than risky.
    const chance = Math.min(0.05, d.invites(civ) * 0.004);
    if (draw >= floor && draw < floor + chance) {
      const severity = 0.4 + noise(seed, tick, saltOf(civ.id) ^ 0x27d4eb2f) * 0.6;
      const s = d.strike(civ);
      return { kind: d.kind, label: d.label, severity, strike: s };
    }
    floor += chance;
  }
  return null;
}

/** Is a standing vow still held? Null when there is nothing to hold. */
export function vowHeld(civ: Civ): boolean | null {
  const vow = civ.doctrine.vow;
  if (!vow) return null;
  const value =
    vow.metric === "food"
      ? civ.stock.food
      : vow.metric === "soldiers"
        ? civ.soldiers
        : vow.metric === "territory"
          ? civ.territory
          : civ.population;
  return value >= vow.floor;
}

function produce(civ: Civ, harvest: number): Stock {
  const s = shares(civ.doctrine);
  const workers = civ.population;

  /**
   * Each activity is limited by the land that carries it, not by territory in
   * general. Everyone in the mines is worth nothing without hills — which is
   * the whole reason land now has kinds, and the reason a ruler has to think
   * about what it takes rather than only how much.
   *
   * A little is always possible on unsuited ground (the 0.15 floor): a
   * civilisation with no forest can still cut something, just badly. Zero would
   * make a single bad expansion unrecoverable.
   */
  const carried = (share: number, parcels: number, rate: number) => {
    const assigned = workers * share;
    const capacity = parcels * WORKERS_PER_LAND;
    const effective = Math.min(assigned, capacity) + Math.max(0, assigned - capacity) * 0.15;
    return effective * rate;
  };

  // A farmer feeds several people — that is the whole reason a civilisation can
  // afford anyone who is not a farmer. The first measurement had this backwards
  // (0.9 produced against 0.8 eaten) and every civilisation starved by tick 12.
  return {
    // Only food follows the season. A bad year is a bad harvest, not a mine
    // that stops working. Rivers water the fields too, which is what makes them
    // the land everyone wants and the reason they are scarce.
    food: (carried(s.farming, civ.lands.plain + civ.lands.river * 0.5, 2.5)) * harvest,
    timber: carried(s.forestry, civ.lands.forest, 1.2),
    ore: carried(s.mining, civ.lands.hill, 0.8),
    wealth: carried(s.trade, civ.lands.river, 1.0),
  };
}

export const LAND_LABEL: Record<LandKind, string> = {
  plain: "plaine",
  forest: "foret",
  hill: "colline",
  river: "fleuve",
};

/**
 * How much a civilisation would miss one parcel of a kind it already has.
 *
 * Used only to decide what to abandon and what a raider takes first, so it is
 * a ranking and not a price: the last river is worth more than the tenth plain.
 */
const value = (lands: Lands, kind: LandKind): number => (kind === "river" ? 3 : kind === "plain" ? 2 : 1) / lands[kind];

/** Take one parcel of the wanted kind, or the next best thing that exists. */
function takeFrom(pool: Lands, wanted: LandKind): { kind: LandKind; pool: Lands } | null {
  const order: LandKind[] = [wanted, ...LAND_KINDS.filter((k) => k !== wanted)];
  for (const kind of order) {
    if (pool[kind] > 0) return { kind, pool: { ...pool, [kind]: pool[kind] - 1 } };
  }
  return null;
}

function tickCiv(
  civ: Civ,
  tick: number,
  harvest: number,
  free: Lands,
  seed: number,
): { civ: Civ; events: TickEvent[]; free: Lands } {
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
  let lands = { ...civ.lands };
  let pool = free;
  const freeLand = landCount(pool);
  const wantsLand = population / WORKERS_PER_LAND > territory;

  if (wantsLand && freeLand <= 0) {
    // Not a failure — a fact the ruler needs. Expansion from here is a foreign
    // policy question, not a forestry one.
    say("LAND_FULL", "plus une terre libre dans le monde");
  }
  if (wantsLand && freeLand > 0 && stock.timber >= 60) {
    // The ruler's standing claim decides what gets taken. When that kind has
    // run out, something else is taken rather than nothing: a civilisation that
    // needs land takes what is there.
    const taken = takeFrom(pool, civ.doctrine.claim)!;
    pool = taken.pool;
    lands = { ...lands, [taken.kind]: lands[taken.kind] + 1 };
    stock.timber = round2(stock.timber - 60);
    territory += 1;
    const asked = taken.kind === civ.doctrine.claim ? "" : ` (faute de ${civ.doctrine.claim})`;
    say("EXPANDED", `${LAND_LABEL[taken.kind]} annexee${asked}, frontiere a ${territory}`);
  } else if (territory > 1 && population < (territory - 1) * 15) {
    // Land nobody works reverts, and the least useful goes first — a
    // civilisation abandons the hill it cannot man before the field it eats
    // from. It returns to the world rather than vanishing.
    const giveUp = [...LAND_KINDS]
      .filter((k) => lands[k] > 0)
      .sort((a, b) => value(lands, a) - value(lands, b) || a.localeCompare(b))[0]!;
    lands = { ...lands, [giveUp]: lands[giveUp] - 1 };
    pool = { ...pool, [giveUp]: pool[giveUp] + 1 };
    territory -= 1;
    say("LOST_LAND", `${LAND_LABEL[giveUp]} abandonnee, frontiere a ${territory}`);
  }

  soldiers = Math.max(0, Math.round(soldiers + population * s.military * 0.05 - soldiers * 0.02));

  const disaster = disasterOn({ ...civ, population, stock, territory, lands: civ.lands }, seed, tick);
  if (disaster) {
    const hit = (share: number) => Math.abs(share) * disaster.severity;
    const lostPop = Math.min(Math.floor(population * hit(disaster.strike.population)), Math.max(0, population - 1));
    population -= lostPop;
    stock.food = round2(stock.food * (1 - hit(disaster.strike.food)));
    stock.timber = round2(stock.timber * (1 - hit(disaster.strike.timber)));
    say("DISASTER", `${disaster.label} : ${lostPop} morts, greniers et reserves entames`);
  }

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

  // Checked after everything else, on the year as it ends: a promise is kept or
  // broken by the state a ruler leaves behind, not by the state it inherited.
  let vowBrokenOn = civ.vowBrokenOn;
  if (vowBrokenOn === null) {
    const held = vowHeld({ ...civ, population, soldiers, territory, stock });
    if (held === false) {
      vowBrokenOn = tick;
      const vow = civ.doctrine.vow!;
      say("VOW_BROKEN", `serment rompu : ${vow.metric} sous ${vow.floor}, jure en l'an ${vow.sworn}`);
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
    civ: { ...civ, population, territory, lands, soldiers, stock, advances, fellOnTick, vowBrokenOn, ticksSinceDecision: civ.ticksSinceDecision + 1 },
    events,
    free: pool,
  };
}

export function tickWorld(world: World): TickResult {
  const tick = world.tick + 1;
  // One season for the whole world: civilisations share a climate, so a bad
  // year is something neighbours can talk about rather than private bad luck.
  const harvest = season(world.seed, tick);
  const events: TickEvent[] = [];
  // One shared pool, walked in canonical id order: when the last river is
  // taken, which civilisation got it must not depend on array order.
  let free = { ...world.free };
  // Canonical id order, as everywhere else in this project: the result must not
  // depend on the order civilisations happen to sit in the array.
  const civs = [...world.civs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((civ) => {
      if (!isAlive(civ)) return civ;
      const r = tickCiv(civ, tick, harvest, free, world.seed);
      events.push(...r.events);
      free = r.free;
      return r.civ;
    });

  return { world: { ...world, tick, free, civs: contact(civs, tick, events) }, events };
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
    // The aggressor takes what it came for, falling back to whatever the
    // defender actually holds.
    const seized = takeFrom(defender.lands, attacker.doctrine.claim)!;
    defender.lands = seized.pool;
    attacker.lands = { ...attacker.lands, [seized.kind]: attacker.lands[seized.kind] + 1 };
    attacker.territory += 1;
    defender.territory -= 1;
    attacker.soldiers = Math.max(0, attacker.soldiers - Math.ceil(defence * 0.3));
    defender.soldiers = Math.max(0, defender.soldiers - Math.ceil(defender.soldiers * 0.4));
    events.push({ tick, civ: attacker.id, kind: "SEIZED", detail: `${LAND_LABEL[seized.kind]} prise a ${defender.id}` });
    events.push({ tick, civ: defender.id, kind: "CEDED", detail: `${LAND_LABEL[seized.kind]} perdue au profit de ${attacker.id}` });
  }

  return civs.map((c) => byId.get(c.id)!);
}
