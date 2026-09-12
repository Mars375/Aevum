import { census, newWorld, neighbours, type Civ, type World } from "./state.js";
import type { TickEvent, TickResult } from "./events.js";
import { develop, round } from "./development.js";
import { advanceUnits, initializeUnits } from "./units.js";

/** New campaigns explicitly opt into w10; archived constructors retain w8. */
export function newCivilizationWorld(ids: Civ["id"][], seed: number, size = 13): World {
  if (!Number.isInteger(size) || size < 7 || size > 32 || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error("A civilization world requires 2–4 distinct factions and a board side of 7–32.");
  const world = census(newWorld([...ids].sort(), seed, size));
  world.worldVersion = "w10";
  world.simulation = { cities: [], units: [], relations: [], nextUnit: 0 };
  for (const civ of world.civs) {
    civ.science = 0;
    civ.doctrine = {...civ.doctrine, farming:.55, forestry:.15, mining:.08, trade:.17, military:.05, focus:"balanced"};
    world.simulation.cities.push({id:`city-${civ.id}`,owner:civ.id,position:civ.capital!,founded:0,buildings:[],queue:null});
  }
  for (let i = 0; i < world.civs.length; i++) for (let j = i+1; j < world.civs.length; j++) world.simulation.relations.push({a:world.civs[i]!.id,b:world.civs[j]!.id,status:"peace",since:0,truceUntil:0});
  initializeUnits(world);
  return world;
}

function diplomacy(world: World, events: TickEvent[]): void {
  for (const relation of world.simulation!.relations) {
    const a = world.civs.find(c => c.id === relation.a)!, b = world.civs.find(c => c.id === relation.b)!;
    if (a.fellOnTick !== null || b.fellOnTick !== null) { relation.status = "peace"; continue; }
    const adjacent = world.board.some((p,i) => p.owner === a.id && neighbours(world.size,i).some(n => world.board[n]!.owner === b.id));
    const peaceful = a.doctrine.posture !== "PRESSURE" && b.doctrine.posture !== "PRESSURE";
    if (relation.status === "war") {
      const exhausted = world.tick - relation.since >= 20 && (a.soldiers < 3 || b.soldiers < 3);
      if (peaceful || exhausted) {
        relation.status = "peace"; relation.since = world.tick; relation.truceUntil = world.tick + 12;
        events.push({tick:world.tick,civ:a.id,kind:"PEACE",detail:`trêve de douze ans avec ${b.id}`});
      }
    } else if (adjacent && world.tick >= relation.truceUntil && ((a.doctrine.posture === "PRESSURE" && a.soldiers > Math.max(4,b.soldiers * 1.15)) || (b.doctrine.posture === "PRESSURE" && b.soldiers > Math.max(4,a.soldiers * 1.15)))) {
      relation.status = "war"; relation.since = world.tick;
      events.push({tick:world.tick,civ:a.id,kind:"WAR",detail:`guerre déclarée entre ${a.id} et ${b.id}`});
    } else if (adjacent && a.doctrine.posture === "TRADE" && b.doctrine.posture === "TRADE") {
      if (relation.status !== "trade") relation.since = world.tick;
      relation.status = "trade";
      const income = round(Math.min(a.population,b.population) * .04);
      a.stock.wealth = round(a.stock.wealth + income); b.stock.wealth = round(b.stock.wealth + income);
      // Trade moves real grain from surplus to shortage; it never creates food.
      const donor = a.stock.food/a.population > b.stock.food/b.population ? a : b;
      const receiver = donor === a ? b : a;
      const grain = round(Math.max(0, Math.min(donor.stock.food - donor.population * 4, receiver.population * 3 - receiver.stock.food, 20)));
      donor.stock.food = round(donor.stock.food-grain); receiver.stock.food = round(receiver.stock.food+grain);
      if (world.tick % 8 === 0) events.push({tick:world.tick,civ:a.id,kind:"TRADED",detail:`commerce avec ${b.id} : ${income} richesse chacun, ${grain} vivres transférés`});
    } else if (relation.status === "trade") { relation.status = "peace"; relation.since = world.tick; }
  }
}

export function cleanup(world: World, events: TickEvent[]): World {
  const sim = world.simulation!;
  for (const civ of world.civs) {
    const holdings = world.board.map((p,i) => p.owner === civ.id ? i : -1).filter(i => i >= 0);
    if (civ.fellOnTick === null && (civ.population <= 0 || holdings.length === 0)) {
      civ.fellOnTick = world.tick;
      events.push({tick:world.tick,civ:civ.id,kind:"COLLAPSED",detail:"la civilisation a perdu son dernier foyer"});
    }
    if (civ.fellOnTick !== null) {
      civ.population = 0; civ.soldiers = 0; civ.capital = null;
      for (const i of holdings) world.board[i]!.owner = null;
      sim.cities = sim.cities.filter(c => c.owner !== civ.id);
      sim.units = sim.units.filter(u => u.owner !== civ.id);
    } else if (civ.capital === null || world.board[civ.capital]?.owner !== civ.id) {
      civ.capital = sim.cities.find(c => c.owner === civ.id)?.position ?? holdings[0]!;
      if (!sim.cities.some(c => c.position === civ.capital)) sim.cities.push({id:`refuge-${civ.id}-${world.tick}`,position:civ.capital,owner:civ.id,founded:world.tick,buildings:[],queue:null});
      events.push({tick:world.tick,civ:civ.id,kind:"CAPITAL_MOVED",detail:`nouveau siège : ${world.board[civ.capital]!.name}`});
    }
  }
  return census(world);
}

/** Explicit phases; no random source, IO, mutation of the input, or hidden state. */
export function tickCivilization(input: World): TickResult {
  if (!input.simulation) throw new Error("w10 world is missing its simulation state");
  let world = census({
    ...input, board: input.board.map(p => ({...p})),
    civs: input.civs.map(c => ({...c, stock:{...c.stock}, doctrine:{...c.doctrine}, advances:[...c.advances]})),
    simulation: {
      ...input.simulation,
      cities: input.simulation.cities.map(c => ({...c,buildings:[...c.buildings],queue:c.queue ? {...c.queue} : null})),
      units: input.simulation.units.map(u => ({...u})),
      relations: input.simulation.relations.map(r => ({...r})),
    },
  });
  world.tick++;
  world.civs.sort((a,b) => a.id.localeCompare(b.id));
  const events: TickEvent[] = [];
  world = cleanup(world,events);
  for (const civ of world.civs) if (civ.fellOnTick === null) develop(world,civ,events);
  world = cleanup(world,events);
  diplomacy(world,events);
  advanceUnits(world,events);
  world = cleanup(world,events);
  return {world,events};
}
