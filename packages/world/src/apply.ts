import { type World } from "./state.js";
import type { Ruling } from "./journal.js";
import { tickWorld, type TickEvent } from "./tick.js";

/** Apply a ruling. Unspecified doctrine fields keep their previous value. */
export function applyRuling(world: World, ruling: Ruling): World {
  return {
    ...world,
    civs: world.civs.map((civ) =>
      civ.id === ruling.civ
        ? { ...civ, doctrine: { ...civ.doctrine, ...ruling.doctrine }, ticksSinceDecision: 0 }
        : civ,
    ),
  };
}

/**
 * Recompute a world from its journal.
 *
 * The free half of the design: ticks cost nothing to replay, so only the
 * rulings need storing. W4 holds because tickWorld is pure.
 */
export function replay(
  origin: World,
  rulings: Ruling[],
  untilTick: number,
): { world: World; events: TickEvent[] } {
  let world = origin;
  const events: TickEvent[] = [];
  // Rulings are keyed by the tick they were made on, so they can be looked up
  // rather than scanned once per tick.
  const byTick = new Map<number, Ruling[]>();
  for (const r of rulings) byTick.set(r.tick, [...(byTick.get(r.tick) ?? []), r]);

  while (world.tick < untilTick) {
    const stepped = tickWorld(world);
    world = stepped.world;
    events.push(...stepped.events);
    for (const ruling of byTick.get(world.tick) ?? []) world = applyRuling(world, ruling);
  }
  return { world, events };
}
