import { neighbours, type Civ, type World } from "./state.js";
import type { WorldUnit } from "./civilization-state.js";
import type { TickEvent } from "./events.js";
import { affordable, pay } from "./development.js";

const distance = (world: World, a: number, b: number) =>
  Math.abs((a % world.size) - (b % world.size)) +
  Math.abs(Math.floor(a / world.size) - Math.floor(b / world.size));
const atWar = (world: World, a: string, b: string) =>
  world.simulation!.relations.some(
    (r) =>
      r.status === "war" &&
      ((r.a === a && r.b === b) || (r.b === a && r.a === b)),
  );

/** Breadth-first pathing with stable neighbour order. Enemy land is an endpoint only. */
export function unitPath(
  world: World,
  unit: WorldUnit,
  target: number,
): number[] {
  if (!world.board[target]) return [];
  const queue = [unit.position],
    previous = new Map<number, number>([[unit.position, -1]]);
  for (let head = 0; head < queue.length; head++) {
    const position = queue[head]!;
    if (position === target) {
      const path = [position];
      while (previous.get(path[0]!) !== -1)
        path.unshift(previous.get(path[0]!)!);
      return path;
    }
    for (const next of neighbours(world.size, position)) {
      if (previous.has(next)) continue;
      const owner = world.board[next]!.owner;
      if (
        owner !== null &&
        owner !== unit.owner &&
        !(
          next === target &&
          unit.role === "soldier" &&
          atWar(world, unit.owner, owner)
        )
      )
        continue;
      previous.set(next, position);
      queue.push(next);
    }
  }
  return [];
}

function spawn(
  world: World,
  civ: Civ,
  role: WorldUnit["role"],
  strength = 1,
): WorldUnit {
  const unit: WorldUnit = {
    id: `${civ.id}-${world.simulation!.nextUnit++}`,
    owner: civ.id,
    role,
    position: civ.capital!,
    previous: civ.capital!,
    target: null,
    strength,
    task: "idle",
    cooldown: 0,
  };
  world.simulation!.units.push(unit);
  return unit;
}

function reconcile(world: World, civ: Civ, automaticSettlers = true): void {
  const sim = world.simulation!;
  if (civ.capital === null) return;
  const armies = sim.units
    .filter((u) => u.owner === civ.id && u.role === "soldier")
    .sort((a, b) => a.id.localeCompare(b.id));
  let difference = civ.soldiers - armies.reduce((s, u) => s + u.strength, 0);
  if (difference > 0) {
    for (const army of armies) {
      const add = Math.min(difference, Math.max(0, 12 - army.strength));
      army.strength += add;
      difference -= add;
    }
    while (difference > 0) {
      const amount = Math.min(12, difference);
      if (armies.length >= 4) {
        armies[0]!.strength += difference;
        break;
      }
      armies.push(spawn(world, civ, "soldier", amount));
      difference -= amount;
    }
  } else if (difference < 0) {
    for (const army of [...armies].reverse()) {
      const take = Math.min(-difference, army.strength);
      army.strength -= take;
      difference += take;
    }
    sim.units = sim.units.filter((u) => u.strength > 0);
  }
  const roles = [
    ["farmer", "farming"],
    ["lumberjack", "forestry"],
    ["miner", "mining"],
    ["merchant", "trade"],
  ] as const;
  for (const [role, employment] of roles) {
    const desired =
      civ.doctrine[employment] > 0 && civ.population > civ.soldiers ? 1 : 0;
    const current = sim.units.filter(
      (u) => u.owner === civ.id && u.role === role,
    );
    if (desired && !current.length) spawn(world, civ, role);
    if (!desired)
      sim.units = sim.units.filter(
        (u) => u.owner !== civ.id || u.role !== role,
      );
  }
  if (
    automaticSettlers &&
    world.tick % 8 === 0 &&
    civ.population > civ.territory * 28 &&
    !sim.units.some((u) => u.owner === civ.id && u.role === "settler") &&
    expansionTarget(world, civ) !== null &&
    affordable(civ.stock, {
      timber: 60,
      wealth: 20,
      food: civ.population * 2 + 50,
    })
  ) {
    pay(civ.stock, { timber: 60, wealth: 20, food: 50 });
    spawn(world, civ, "settler");
  }
}

export function initializeUnits(
  world: World,
  automaticSettlers = true,
  active?: string,
): void {
  for (const civ of world.civs)
    if (civ.fellOnTick === null && (!active || civ.id === active))
      reconcile(world, civ, automaticSettlers);
}

function expansionTarget(world: World, civ: Civ): number | null {
  const sites = world.board
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) =>
        p.owner === null &&
        neighbours(world.size, i).some((n) => world.board[n]!.owner === civ.id),
    );
  sites.sort(
    (a, b) =>
      Number(b.p.kind === civ.doctrine.claim) -
        Number(a.p.kind === civ.doctrine.claim) ||
      distance(world, civ.capital!, a.i) - distance(world, civ.capital!, b.i) ||
      a.i - b.i,
  );
  return sites[0]?.i ?? null;
}

function chooseTarget(world: World, civ: Civ, unit: WorldUnit): number | null {
  if (unit.role === "settler") return expansionTarget(world, civ);
  if (unit.role === "soldier") {
    const threats = world.board
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          p.owner && p.owner !== civ.id && atWar(world, civ.id, p.owner),
      );
    threats.sort(
      (a, b) =>
        distance(world, unit.position, a.i) -
          distance(world, unit.position, b.i) || a.i - b.i,
    );
    if (civ.doctrine.posture === "PRESSURE") {
      for (const { i } of threats)
        if (unitPath(world, unit, i).length) return i;
    }
    const border = world.board
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p, i }) =>
          p.owner === civ.id &&
          neighbours(world.size, i).some(
            (n) =>
              world.board[n]!.owner !== null &&
              world.board[n]!.owner !== civ.id,
          ),
      );
    border.sort(
      (a, b) =>
        distance(world, unit.position, a.i) -
          distance(world, unit.position, b.i) || a.i - b.i,
    );
    return border[0]?.i ?? civ.capital;
  }
  const kind =
    unit.role === "farmer"
      ? "plain"
      : unit.role === "lumberjack"
        ? "forest"
        : unit.role === "miner"
          ? "hill"
          : "river";
  const own = world.board
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.owner === civ.id);
  own.sort(
    (a, b) =>
      Number(b.p.kind === kind) - Number(a.p.kind === kind) ||
      distance(world, unit.position, a.i) -
        distance(world, unit.position, b.i) ||
      a.i - b.i,
  );
  return own[0]?.i ?? null;
}

function combat(
  world: World,
  attacker: Civ,
  unit: WorldUnit,
  target: number,
  events: TickEvent[],
): boolean {
  const sim = world.simulation!,
    owner = world.board[target]!.owner;
  const defender = world.civs.find((c) => c.id === owner)!;
  if (!defender || !atWar(world, attacker.id, defender.id)) return false;
  const guards = sim.units.filter(
    (u) =>
      u.role === "soldier" && u.owner === defender.id && u.position === target,
  );
  const garrison = guards.reduce((sum, u) => sum + u.strength, 0);
  const city = sim.cities.find((c) => c.position === target);
  const fort =
    (city?.buildings.includes("walls") ? 1.5 : 1) *
    (world.board[target]!.kind === "hill" ? 1.2 : 1) *
    (defender.doctrine.posture === "GUARD" ? 1.25 : 1);
  const attack =
    unit.strength * (attacker.advances.includes("metallurgy") ? 1.2 : 1);
  const defence =
    (garrison + (city ? 3 : 1)) *
    fort *
    (defender.advances.includes("metallurgy") ? 1.2 : 1);
  const lostAttack = Math.min(
    unit.strength,
    Math.max(1, Math.ceil(defence * 0.3)),
  );
  let lostDefence = Math.min(garrison, Math.max(1, Math.ceil(attack * 0.35)));
  attacker.soldiers -= lostAttack;
  attacker.population = Math.max(0, attacker.population - lostAttack);
  unit.strength -= lostAttack;
  defender.soldiers -= lostDefence;
  defender.population = Math.max(0, defender.population - lostDefence);
  for (const guard of guards) {
    const loss = Math.min(guard.strength, lostDefence);
    guard.strength -= loss;
    lostDefence -= loss;
  }
  const conquered =
    unit.strength > 0 &&
    attack > defence &&
    guards.every((g) => g.strength === 0);
  if (conquered) {
    world.board[target]!.owner = attacker.id;
    if (city) {
      city.owner = attacker.id;
      city.queue = null;
    }
    // Civilians flee to their seat; crews in captured territory are removed,
    // and can be reconstituted there next year by their owner's policy.
    sim.units = sim.units.filter(
      (u) =>
        !(
          u.owner === defender.id &&
          u.position === target &&
          u.role !== "soldier"
        ),
    );
    events.push({
      tick: world.tick,
      civ: attacker.id,
      kind: "SEIZED",
      detail: `${world.board[target]!.name} conquise sur ${defender.id}`,
    });
    events.push({
      tick: world.tick,
      civ: defender.id,
      kind: "CEDED",
      detail: `${world.board[target]!.name} perdue au profit de ${attacker.id}`,
    });
    if (defender.capital === target) {
      defender.capital = null;
      events.push({
        tick: world.tick,
        civ: defender.id,
        kind: "CAPITAL_LOST",
        detail: `siège perdu : ${world.board[target]!.name}`,
      });
    }
  } else
    events.push({
      tick: world.tick,
      civ: attacker.id,
      kind: "ROUTED",
      detail: `combat à ${world.board[target]!.name} : ${lostAttack} soldats perdus`,
    });
  return conquered;
}

export function advanceUnits(world: World, events: TickEvent[]): void {
  const sim = world.simulation!;
  for (const civ of world.civs)
    if (civ.fellOnTick === null) reconcile(world, civ);
  // Rotate initiative each year instead of giving the same faction priority forever.
  const ids = world.civs.map((c) => c.id).sort();
  const rank = (id: string) =>
    (ids.indexOf(id as Civ["id"]) + world.tick) % ids.length;
  const units = [...sim.units].sort(
    (a, b) => rank(a.owner) - rank(b.owner) || a.id.localeCompare(b.id),
  );
  for (const unit of units) {
    if (unit.strength <= 0 || !sim.units.includes(unit)) continue;
    const civ = world.civs.find((c) => c.id === unit.owner)!;
    unit.previous = unit.position;
    if (unit.cooldown > 0) {
      unit.cooldown--;
      continue;
    }
    unit.target = chooseTarget(world, civ, unit);
    if (unit.target === null) {
      unit.task = "idle";
      continue;
    }
    const path = unitPath(world, unit, unit.target),
      next = path[1];
    unit.task =
      unit.role === "settler"
        ? "settle"
        : unit.role === "soldier"
          ? unit.target === unit.position
            ? "guard"
            : "march"
          : "work";
    if (next !== undefined) {
      const owner = world.board[next]!.owner;
      if (owner && owner !== civ.id) {
        if (!combat(world, civ, unit, next, events)) continue;
      }
      unit.position = next;
      if (
        world.board[next]!.kind === "river" &&
        !civ.advances.includes("engineering")
      )
        unit.cooldown = 1;
    }
    if (
      unit.role === "settler" &&
      unit.position === unit.target &&
      world.board[unit.position]!.owner === null
    ) {
      world.board[unit.position]!.owner = civ.id;
      events.push({
        tick: world.tick,
        civ: civ.id,
        kind: "EXPANDED",
        detail: `${world.board[unit.position]!.name} colonisée par une expédition`,
      });
      const cities = sim.cities.filter((c) => c.owner === civ.id);
      if (
        world.board[unit.position]!.kind !== "river" &&
        cities.every((c) => distance(world, c.position, unit.position) >= 3) &&
        cities.length < 1 + Math.floor(civ.population / 180)
      ) {
        sim.cities.push({
          id: `city-${unit.id}`,
          owner: civ.id,
          position: unit.position,
          founded: world.tick,
          buildings: [],
          queue: null,
        });
        events.push({
          tick: world.tick,
          civ: civ.id,
          kind: "FOUNDED",
          detail: `ville fondée : ${world.board[unit.position]!.name}`,
        });
      }
      unit.strength = 0;
    }
  }
  sim.units = sim.units.filter((u) => u.strength > 0);
}
