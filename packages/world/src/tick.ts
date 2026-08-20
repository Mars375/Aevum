import { census, isAlive, type Civ, type Doctrine, type Stock, type World } from "./state.js";
import { disasterOn, raidOn, season } from "./chance.js";
import { LAND_LABEL, contact, reachable, value } from "./borders.js";
import type { TickEvent, TickResult } from "./events.js";

/**
 * One year of the world.
 *
 * What a civilisation produces, eats, loses and reaches — and nothing about
 * how the dice fall or who may take whose land, which live in chance.ts and
 * borders.ts. Splitting them was not tidying: this file had grown to six
 * hundred lines mixing harvests, bandits and diplomacy, and three of the bugs
 * this project has had were edits made in the wrong one of those.
 */

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

/** Ceilings on what one raid may take. Absolute: a village loses a village's share. */
const RAID_MAX_POP_LOSS = 0.06;
const RAID_MAX_WEALTH_LOSS = 0.25;
const RAID_MAX_FOOD_LOSS = 0.2;

/** How many workers one parcel of land can carry before crowding. */
const WORKERS_PER_LAND = 25;

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
   *
   * But that floor is people making do on ground they hold. A civilisation
   * that holds nothing has no ground at all, and must produce nothing — else
   * losing every place would leave it quietly alive forever, which is not a
   * world, it is a bookkeeping error.
   */
  const floor = civ.territory > 0 ? 0.15 : 0;

  /**
   * Monter la garde n'est pas gratuit.
   *
   * Mesuré sur quatre cents choix de posture : 79 % de garde, 12 % de commerce,
   * 8 % de pression. Elle donnait la moitié de défense en plus et ne coûtait
   * rien — strictement meilleure que les deux autres, donc le seul choix
   * défendable, donc pas un choix. Des gens de guet sont des gens qui ne
   * travaillent pas : c'est ce que dit ce facteur, et il transforme un défaut
   * en décision.
   */
  const watch = civ.doctrine.posture === "GUARD" ? 0.94 : 1;

  const carried = (share: number, parcels: number, rate: number) => {
    const assigned = workers * share;
    const capacity = parcels * WORKERS_PER_LAND;
    const effective = Math.min(assigned, capacity) + Math.max(0, assigned - capacity) * floor;
    return effective * rate * watch;
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

function tickCiv(
  civ: Civ,
  tick: number,
  harvest: number,
  seed: number,
): { civ: Civ; events: TickEvent[]; wants: "expand" | "abandon" | null } {
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
  } else if (stock.food > population * 6) {
    /**
     * On ne fait pas d'enfants sur un grenier a moitie vide.
     *
     * A quatre annees de vivres, une civilisation grandissait jusqu'au plafond
     * que sa terre pouvait nourrir et s'y installait au ras de l'alarme :
     * mesure, 22 % du temps sous le seuil de famine et 38 % des decisions
     * levees etaient des famines. La famine n'etait plus un evenement, c'etait
     * l'etat d'equilibre, et le monde ne posait plus qu'une question.
     *
     * A six, l'equilibre garde une reserve. Mesure sur huit mondes de trois
     * cents ans : 2 % du temps sous le seuil, 452 decisions au lieu de 575, et
     * un melange enfin varie — pillages 21 %, progres 20 %, catastrophes 19 %.
     * La population, elle, ne bouge presque pas (650 contre 672) : ce n'est pas
     * un rabotage, c'est une reserve.
     */
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
  const lands = civ.lands;
  const wants: "expand" | "abandon" | null =
    population / WORKERS_PER_LAND > territory && stock.timber >= 60
      ? "expand"
      : territory > 1 && population < (territory - 1) * 15
        ? "abandon"
        : null;

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
    wants,
  };
}

export function tickWorld(world: World): TickResult {
  const tick = world.tick + 1;
  // One season for the whole world: civilisations share a climate, so a bad
  // year is something neighbours can talk about rather than private bad luck.
  const harvest = season(world.seed, tick);
  const events: TickEvent[] = [];
  const board = world.board.map((p) => ({ ...p }));
  const wanted = new Map<string, "expand" | "abandon" | null>();
  // Canonical id order, as everywhere else in this project: the result must not
  // depend on the order civilisations happen to sit in the array.
  const civs = [...world.civs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((civ) => {
      if (!isAlive(civ)) return civ;
      const r = tickCiv(civ, tick, harvest, world.seed);
      events.push(...r.events);
      wanted.set(civ.id, r.wants);
      return r.civ;
    });

  // Movement on the board happens after every civilisation has lived its year,
  // in canonical id order: when two civilisations reach for the same empty
  // place, which one gets it must not depend on array order.
  for (const civ of [...civs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isAlive(civ)) continue;
    const want = wanted.get(civ.id);
    if (want === "expand") {
      const target = reachable(board, world.size, civ.id, civ.doctrine.claim, null);
      if (target === null) {
        // Not a failure — a fact the ruler needs. Growth from here is a foreign
        // policy question, not a forestry one.
        events.push({ tick, civ: civ.id, kind: "LAND_FULL", detail: "plus un lieu libre a portee de nos frontieres" });
      } else {
        board[target]!.owner = civ.id;
        civ.stock = { ...civ.stock, timber: round2(civ.stock.timber - 60) };
        const asked = board[target]!.kind === civ.doctrine.claim ? "" : ` (faute de ${civ.doctrine.claim})`;
        events.push({ tick, civ: civ.id, kind: "EXPANDED", detail: `${board[target]!.name} occupee, ${LAND_LABEL[board[target]!.kind]}${asked}` });
      }
    } else if (want === "abandon") {
      // The least useful goes first — a civilisation abandons the hill it
      // cannot man before the field it eats from — and it returns to the world
      // as a neutral place rather than vanishing.
      const mine = board
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.owner === civ.id)
        .sort((a, b) => value(civ.lands, a.p.kind) - value(civ.lands, b.p.kind) || a.i - b.i);
      const giveUp = mine[0];
      if (giveUp && mine.length > 1) {
        board[giveUp.i]!.owner = null;
        if (civ.capital === giveUp.i) {
          const seat = board.findIndex((p, i) => p.owner === civ.id && i !== giveUp.i);
          civ.capital = seat >= 0 ? seat : null;
          if (seat >= 0) events.push({ tick, civ: civ.id, kind: "CAPITAL_MOVED", detail: `siege transfere a ${board[seat]!.name}` });
        }
        events.push({ tick, civ: civ.id, kind: "LOST_LAND", detail: `${giveUp.p.name} abandonnee` });
      }
    }
  }

  /**
   * A civilisation that dies lets go of its land.
   *
   * Found by running one: crimson was extinguished in year 393 and still held
   * thirteen places. Ruins that nobody can enter would freeze a third of the
   * board forever and quietly end the world's history — the survivors would
   * have nowhere left to grow. The places go back to being unclaimed, which is
   * what they were before anyone arrived.
   */
  for (const civ of civs) {
    // Any dead civilisation, not only one that died this year. Comparing the
    // year of death to the current year worked exactly once and then silently
    // stopped — a world resumed, or a fixture that starts from a state rather
    // than from year zero, would never pass through the year it needed.
    if (isAlive(civ)) continue;
    let released = 0;
    for (const place of board) {
      if (place.owner === civ.id) {
        place.owner = null;
        released += 1;
      }
    }
    civ.capital = null;
    if (released > 0) {
      events.push({ tick, civ: civ.id, kind: "LOST_LAND", detail: `${released} lieux retournent au monde` });
    }
  }

  const after = contact({ ...world, tick, board, civs }, events);
  // The board is the truth; the holdings on each civilisation are a reading of
  // it, taken once everything that could move has moved.
  return { world: census(after), events };
}

/**
 * What civilisations do to each other.
 *
 * Deliberately thin. The engine decides outcomes; postures are what rulers
 * chose, and this only resolves them. Everything here is a pure function of
 * the civilisation list in canonical id order, so contact cannot depend on who
 * happens to be first in the array.
 */