import type { Civ, Stock, World } from "./state.js";
import type { Building, City } from "./civilization-state.js";
import type { TickEvent } from "./events.js";
import { shares } from "./tick.js";
import { season } from "./chance.js";

export const BUILDING_RULES: Record<
  Building,
  { timber: number; ore: number; wealth: number; years: number }
> = {
  granary: { timber: 35, ore: 0, wealth: 15, years: 4 },
  workshop: { timber: 45, ore: 15, wealth: 20, years: 5 },
  market: { timber: 35, ore: 5, wealth: 25, years: 4 },
  walls: { timber: 45, ore: 30, wealth: 30, years: 6 },
  academy: { timber: 60, ore: 15, wealth: 60, years: 8 },
};
export const TECHNOLOGIES = [
  {
    name: "irrigation",
    cost: 50,
    requires: [] as string[],
    effect: "+20% food",
  },
  {
    name: "masonry",
    cost: 80,
    requires: ["irrigation"],
    effect: "+25% housing",
  },
  {
    name: "metallurgy",
    cost: 100,
    requires: [],
    effect: "+20% ore and army strength",
  },
  {
    name: "coinage",
    cost: 110,
    requires: ["irrigation"],
    effect: "+25% trade income",
  },
  {
    name: "engineering",
    cost: 160,
    requires: ["masonry", "metallurgy"],
    effect: "faster river crossings and construction",
  },
  {
    name: "scholarship",
    cost: 200,
    requires: ["coinage"],
    effect: "+30% research",
  },
] as const;
export const round = (n: number) => Math.round(n * 100) / 100;
export function affordable(stock: Stock, cost: Partial<Stock>): boolean {
  return Object.entries(cost).every(([k, n]) => stock[k as keyof Stock] >= n);
}
export function pay(stock: Stock, cost: Partial<Stock>): void {
  for (const [k, n] of Object.entries(cost))
    stock[k as keyof Stock] = round(stock[k as keyof Stock] - n);
}

/**
 * L'économie de `spectator-11` : un monde où quelque chose manque.
 *
 * Mesuré sur trois parties longues (`docs/reports/pourquoi-pas-de-guerre.md`) :
 * la population croissait exactement pareil pour les quatre civilisations, quoi
 * qu'elles décident — le logement ne la bornait jamais, les vivres
 * s'accumulaient sans fin (8 358 en réserve pour un besoin de 976). Fonder une
 * ville ne rapportait rien ; aucun dirigeant ne le faisait, aucune frontière ne
 * se touchait, aucune guerre n'avait de raison.
 *
 * Trois règles, et seulement pour `spectator-11` : le monde continu (w8) et
 * les parties déjà jouées gardent l'ancienne économie, rejouable à l'identique.
 *
 *  - un logement qui borne : 110 places par ville, 15 par case, +25 % avec la
 *    maçonnerie — une capitale seule plafonne vers 125 habitants ;
 *  - une croissance qui suit les réserves, de 0,4 % à 2 % par tour, au lieu
 *    d'un seuil tout ou rien toujours franchi ;
 *  - des réserves qui se gâtent : au-delà de dix fois le besoin (quinze par
 *    grenier), un cinquième de l'excédent se perd chaque tour.
 */
export const ECONOMY_V11 = {
  housingPerCity: 110,
  housingPerTile: 15,
  masonry: 1.25,
  growthFloor: 0.004,
  growthCeiling: 0.02,
  /** Réserves, en tours de besoin, où la croissance atteint son plafond. */
  growthReserve: 6,
  storagePerNeed: 10,
  storagePerGranary: 5,
  spoilage: 0.2,
} as const;

/** Le logement d'une civilisation, selon l'économie en vigueur. */
export function housingCapacity(
  civ: Pick<Civ, "territory" | "advances">,
  cityCount: number,
  economy: "classic" | "v11" = "classic",
): number {
  const masonry = civ.advances.includes("masonry");
  if (economy === "v11")
    return Math.floor(
      (cityCount * ECONOMY_V11.housingPerCity +
        civ.territory * ECONOMY_V11.housingPerTile) *
        (masonry ? ECONOMY_V11.masonry : 1),
    );
  return (cityCount * 140 + civ.territory * 35) * (masonry ? 1.25 : 1);
}

/** Mutates only the new tick's private copy; all expenditure is paid up front. */
export function develop(
  world: World,
  civ: Civ,
  events: TickEvent[],
  options?: {
    foodMultiplier: number;
    research: string | null;
    manual: boolean;
    production?: Stock;
    seasonTick?: number;
    /** `v11` : logement, croissance et réserves de `spectator-11`. */
    economy?: "classic" | "v11";
  },
): void {
  const cities = world.simulation!.cities.filter((c) => c.owner === civ.id);
  const has = (b: Building) =>
    cities.filter((c) => c.buildings.includes(b)).length;
  const say = (kind: TickEvent["kind"], detail: string) =>
    events.push({ tick: world.tick, civ: civ.id, kind, detail });
  const s = shares(civ.doctrine);
  const workers = Math.max(0, civ.population - civ.soldiers);
  const carried = (share: number, capacity: number, rate: number) => {
    const assigned = workers * share;
    return (
      (Math.min(assigned, capacity * 40) +
        Math.max(0, assigned - capacity * 40) * 0.3) *
      rate
    );
  };
  const harvest =
    season(world.seed, options?.seasonTick ?? world.tick) *
    (options?.foodMultiplier ?? 1);
  const gain = {
    food:
      carried(
        s.farming,
        civ.lands.plain + civ.lands.river * 0.7 + cities.length * 0.5,
        3.2,
      ) *
      harvest *
      (civ.advances.includes("irrigation") ? 1.2 : 1) *
      (1 + has("granary") * 0.12),
    timber:
      carried(s.forestry, civ.lands.forest + 0.3, 0.9) *
      (1 + has("workshop") * 0.15),
    ore:
      carried(s.mining, civ.lands.hill + 0.2, 0.65) *
      (civ.advances.includes("metallurgy") ? 1.2 : 1),
    wealth:
      civ.population * 0.07 +
      carried(s.trade, cities.length + civ.lands.river, 0.65) *
        (1 + has("market") * 0.2) *
        (civ.advances.includes("coinage") ? 1.25 : 1),
  };
  if (options?.production) {
    Object.assign(gain, options.production);
    gain.food *= harvest;
  }
  if (civ.doctrine.focus === "science" && !options?.production) {
    for (const key of ["food", "timber", "ore", "wealth"] as const)
      gain[key] *= 0.9;
  }
  const foodNeed = civ.population * 0.8 + civ.soldiers * 0.4;
  const food = civ.stock.food + gain.food - foodNeed;
  const wage = civ.soldiers * 0.45 + cities.length * 0.5;
  const money = civ.stock.wealth + gain.wealth - wage;
  civ.stock = {
    food: round(Math.max(0, food)),
    timber: round(civ.stock.timber + gain.timber),
    ore: round(civ.stock.ore + gain.ore),
    wealth: round(Math.max(0, money)),
  };
  if (food < 0) {
    const lost = Math.min(civ.population, Math.ceil(-food / 2));
    civ.population -= lost;
    say("STARVED", `famine : ${lost} morts`);
  } else if (options?.economy === "v11") {
    const v = ECONOMY_V11;
    // Les réserves au-delà de ce que l'on peut garder se gâtent.
    const storage =
      foodNeed * (v.storagePerNeed + has("granary") * v.storagePerGranary);
    if (civ.stock.food > storage)
      civ.stock.food = round(
        civ.stock.food - (civ.stock.food - storage) * v.spoilage,
      );
    const housing = housingCapacity(civ, cities.length, "v11");
    const reserve = foodNeed > 0 ? civ.stock.food / foodNeed : 0;
    if (reserve > 1 && civ.population < housing) {
      const rate =
        v.growthFloor +
        (v.growthCeiling - v.growthFloor) *
          Math.min(1, (reserve - 1) / (v.growthReserve - 1));
      civ.population += Math.min(
        Math.floor(housing - civ.population),
        Math.max(1, Math.floor(civ.population * rate)),
      );
      say("GREW", `population : ${civ.population}`);
    }
  } else {
    const housing = housingCapacity(civ, cities.length);
    if (civ.stock.food > foodNeed * 3 && civ.population < housing) {
      civ.population += Math.min(
        Math.floor(housing - civ.population),
        Math.max(1, Math.floor(civ.population * 0.015)),
      );
      say("GREW", `population : ${civ.population}`);
    }
  }
  if (money < 0) {
    const loss = Math.min(civ.soldiers, Math.ceil(-money / 0.45));
    civ.soldiers -= loss;
    say("SHORTAGE", `solde impayée : ${loss} déserteurs`);
  }
  civ.soldiers = Math.min(civ.soldiers, Math.floor(civ.population * 0.3));
  if (!civ.population) {
    civ.fellOnTick = world.tick;
    civ.soldiers = 0;
    say("COLLAPSED", "la civilisation s'est éteinte");
    return;
  }

  // Reserves have storage costs: hoarding alone is not an infinite growth engine.
  civ.stock.food = round(
    Math.min(civ.stock.food, civ.population * (12 + has("granary") * 3)) * 0.99,
  );
  const desired = Math.floor(civ.population * Math.min(0.25, s.military * 0.6));
  const recruits = Math.max(
    0,
    Math.min(
      desired - civ.soldiers,
      2 + has("workshop"),
      Math.floor(civ.stock.ore / 2),
      Math.floor(civ.stock.wealth / 3),
    ),
  );
  if (recruits && civ.stock.food > foodNeed * 2 && money >= 0) {
    pay(civ.stock, { ore: recruits * 2, wealth: recruits * 3 });
    civ.soldiers += recruits;
    say("RECRUITED", `${recruits} soldats équipés et recrutés`);
  }
  civ.science = round(
    (civ.science ?? 0) +
      Math.sqrt(workers) *
        0.24 *
        (1 + has("academy") * 0.5) *
        (civ.doctrine.focus === "science" ? 1.4 : 1) *
        (civ.advances.includes("scholarship") ? 1.3 : 1),
  );
  const techs = [...TECHNOLOGIES].sort((a, b) => {
    const rank = (name: string) =>
      (civ.doctrine.focus === "military" && name === "metallurgy") ||
      (civ.doctrine.focus === "industry" && name === "masonry")
        ? -1
        : 0;
    return rank(a.name) - rank(b.name);
  });
  const next = techs.find(
    (t) =>
      (!options?.manual || t.name === options.research) &&
      !civ.advances.includes(t.name) &&
      t.requires.every((r) => civ.advances.includes(r)),
  );
  if (next && civ.science >= next.cost) {
    civ.science = round(civ.science - next.cost);
    civ.advances.push(next.name);
    say("ADVANCE", `progrès : ${next.name} (${next.effect})`);
  }
  for (const city of cities)
    if (!options?.manual || city.queue) build(world, civ, city, events);
  civ.ticksSinceDecision += 1;
  const vow = civ.doctrine.vow;
  if (vow && civ.vowBrokenOn === null) {
    const value = vow.metric === "food" ? civ.stock.food : civ[vow.metric];
    if (value < vow.floor) {
      civ.vowBrokenOn = world.tick;
      say("VOW_BROKEN", `serment rompu : ${vow.metric} sous ${vow.floor}`);
    }
  }
}

function build(world: World, civ: Civ, city: City, events: TickEvent[]): void {
  if (city.queue) {
    city.queue.remaining -= civ.advances.includes("engineering") ? 2 : 1;
    if (city.queue.remaining <= 0) {
      city.buildings.push(city.queue.building);
      events.push({
        tick: world.tick,
        civ: civ.id,
        kind: "BUILT",
        detail: `${world.board[city.position]!.name} : ${city.queue.building} achevé`,
      });
      city.queue = null;
    }
    return;
  }
  const first: Building =
    civ.doctrine.focus === "science"
      ? "academy"
      : civ.doctrine.focus === "military"
        ? "walls"
        : civ.doctrine.focus === "industry"
          ? "workshop"
          : "granary";
  const order: Building[] = [
    first,
    "granary",
    "market",
    "workshop",
    "walls",
    "academy",
  ];
  const next = order.find((b) => !city.buildings.includes(b));
  if (!next || civ.stock.food < civ.population * 1.5) return;
  const { years, ...cost } = BUILDING_RULES[next];
  // Keep a year's army payroll instead of bankrupting the city to decorate it.
  if (
    !affordable(civ.stock, {
      ...cost,
      wealth: cost.wealth + civ.soldiers * 0.45,
    })
  )
    return;
  pay(civ.stock, cost);
  city.queue = { building: next, remaining: years };
}
