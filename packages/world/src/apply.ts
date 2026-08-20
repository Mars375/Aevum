import { census, type World } from "./state.js";
import type { Ruling } from "./journal.js";
import { tickWorld } from "./tick.js";
import type { TickEvent } from "./events.js";

/** Apply a ruling. Unspecified doctrine fields keep their previous value. */
export function applyRuling(world: World, ruling: Ruling): World {
  return {
    ...world,
    civs: world.civs.map((civ) => {
      if (civ.id !== ruling.civ) return civ;
      // A ruler answers for its own promise, not its ancestors': swearing a new
      // vow wipes the record of the old one being broken. Saying nothing about
      // vows leaves both the promise and its verdict standing.
      const swore = ruling.doctrine.vow !== undefined;
      return {
        ...civ,
        doctrine: { ...civ.doctrine, ...ruling.doctrine },
        ticksSinceDecision: 0,
        vowBrokenOn: swore ? null : civ.vowBrokenOn,
      };
    }),
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
  // The origin is laid out but never counted: census once so the very first
  // tick sees the founders' holdings rather than four empty civilisations.
  let world = census(origin);
  const events: TickEvent[] = [];
  // Rulings are keyed by the tick they were made on, so they can be looked up
  // rather than scanned once per tick.
  /**
   * A ruling takes effect when it was ANSWERED, not when it was asked.
   *
   * `tick` records the year the question was raised — which is what a chronicle
   * wants to show — and `deferredBy` how many years it waited for a model. The
   * engine needs the other end: applying a deferred ruling at the year it was
   * asked would put a decision into force before the ruler had made it.
   *
   * Found by a world contradicting its own journal: `monde` reported amber
   * extinct in year 194 while replaying the same journal showed it alive at
   * 290. Four rulings had been deferred, and every year after the first one
   * diverged. That is invariant W4 — replaying the journal reproduces the
   * state — failing silently, which is the worst way for it to fail.
   */
  const byTick = new Map<number, Ruling[]>();
  for (const r of rulings) {
    const effective = r.tick + r.deferredBy;
    byTick.set(effective, [...(byTick.get(effective) ?? []), r]);
  }

  while (world.tick < untilTick) {
    const stepped = tickWorld(world);
    world = stepped.world;
    events.push(...stepped.events);
    for (const ruling of byTick.get(world.tick) ?? []) world = applyRuling(world, ruling);
  }
  return { world, events };
}
