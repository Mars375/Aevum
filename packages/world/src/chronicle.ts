import { applyRuling } from "./apply.js";
import type { Journal, Ruling } from "./journal.js";
import { tickWorld, type TickEvent } from "./tick.js";
import type { World } from "./state.js";

/**
 * The years of a world, one entry each, ready to be read.
 *
 * The journal is deliberately tiny — an origin and a handful of decisions — so
 * anything that wants to *show* the world has to recompute it. That is cheap
 * (the engine is pure arithmetic) and it means the player recomputes the world
 * in the browser from the same code that lived it, rather than trusting a
 * separate rendering of what happened.
 */
export interface Year {
  tick: number;
  world: World;
  events: TickEvent[];
  /** Decisions taken at the end of this year, after its events. */
  rulings: Ruling[];
}

export function chronicle(journal: Journal): Year[] {
  const byTick = new Map<number, Ruling[]>();
  for (const r of journal.rulings) byTick.set(r.tick, [...(byTick.get(r.tick) ?? []), r]);

  const years: Year[] = [{ tick: journal.origin.tick, world: journal.origin, events: [], rulings: [] }];
  let world = journal.origin;

  while (world.tick < journal.livedTo) {
    const stepped = tickWorld(world);
    world = stepped.world;
    const rulings = byTick.get(world.tick) ?? [];
    for (const ruling of rulings) world = applyRuling(world, ruling);
    years.push({ tick: world.tick, world, events: stepped.events, rulings });
  }
  return years;
}
