import { z } from "zod";
import { FactionIdSchema } from "@abs/contracts";

/**
 * A world that does not end.
 *
 * The battle rulesets model a match: it starts, it resolves, it produces a
 * winner. This models a place. Nothing here terminates — victory conditions
 * become milestones a civilisation passes, not states the simulation stops in.
 *
 * The consequence that shapes everything else: a continuous world has no finite
 * call budget. At one LLM call per civilisation per tick it would spend a day's
 * quota in an afternoon and stop being continuous. So the engine ticks on its
 * own, deterministically and for free, and a ruler is woken only when something
 * actually needs deciding.
 */

export const WORLD_VERSION = "w1";

export const RESOURCES = ["food", "timber", "ore", "wealth"] as const;
export const ResourceSchema = z.enum(RESOURCES);
export type Resource = z.infer<typeof ResourceSchema>;

export const StockSchema = z.object({
  food: z.number(),
  timber: z.number(),
  ore: z.number(),
  wealth: z.number(),
});
export type Stock = z.infer<typeof StockSchema>;

/** How a civilisation currently spends its people. Set by its ruler, held between decisions. */
export const DoctrineSchema = z.object({
  /** Shares of the workforce. Normalised by the engine; they need not sum to 1. */
  farming: z.number().min(0),
  forestry: z.number().min(0),
  mining: z.number().min(0),
  trade: z.number().min(0),
  military: z.number().min(0),
  /**
   * How this civilisation carries itself towards its neighbours. It belongs in
   * the doctrine rather than beside it: like the work shares, it is a standing
   * policy that holds until a ruler changes it.
   *
   * One posture, not one per neighbour: friendly to the east and hostile to
   * the west is a richer model, but it multiplies the questions a ruler must
   * answer in a single call, and W5 exists precisely because four questions at
   * once get four poor answers.
   */
  posture: z.enum(["TRADE", "GUARD", "PRESSURE"]).default("GUARD"),
  /**
   * What this civilisation tells itself it is doing, written by its own rulers
   * and inherited by their successors. This is the only thing that "evolves" —
   * the model's weights never change, but the context it inherits does.
   */
  creed: z.string().default(""),
});
export type Doctrine = z.infer<typeof DoctrineSchema>;

export const CivSchema = z.object({
  id: FactionIdSchema,
  population: z.number(),
  /** Tiles held. Growth and loss are slow and mechanical. */
  territory: z.number(),
  stock: StockSchema,
  doctrine: DoctrineSchema,
  /** Standing forces. Cost upkeep whether used or not. */
  soldiers: z.number(),
  /** Unlocked advances, in the order they were reached. */
  advances: z.array(z.string()).default([]),
  /** Ticks since this civilisation last had to decide anything. */
  ticksSinceDecision: z.number().int().default(0),
  /** Set when a civilisation collapses. It stays in the world as a ruin. */
  fellOnTick: z.number().int().nullable().default(null),
});
export type Civ = z.infer<typeof CivSchema>;

export const WorldSchema = z.object({
  worldVersion: z.literal(WORLD_VERSION),
  tick: z.number().int(),
  seed: z.number().int(),
  /**
   * Total workable land in the world.
   *
   * Finite, and that is the entire point. While there is free land the
   * civilisations grow past each other without ever meeting; once it runs out,
   * every further acre one gains is one another loses, and they finally have a
   * reason to have a foreign policy at all.
   */
  land: z.number().int().default(80),
  civs: z.array(CivSchema),
});
export type World = z.infer<typeof WorldSchema>;

export const DEFAULT_DOCTRINE: Doctrine = {
  farming: 0.4,
  forestry: 0.2,
  mining: 0.2,
  trade: 0.15,
  military: 0.05,
  posture: "GUARD",
  creed: "",
};

export function newCiv(id: Civ["id"]): Civ {
  return {
    id,
    population: 100,
    territory: 4,
    stock: { food: 200, timber: 80, ore: 40, wealth: 50 },
    doctrine: { ...DEFAULT_DOCTRINE },
    soldiers: 5,
    advances: [],
    ticksSinceDecision: 0,
    fellOnTick: null,
  };
}

export const isAlive = (c: Civ): boolean => c.fellOnTick === null;

export const living = (world: World): Civ[] => world.civs.filter(isAlive);

/**
 * A world that does not end still has to stop.
 *
 * The one thing that terminates it is being the only one left: with nobody to
 * trade with, raid, or be raided by, what remains is not a civilisation but a
 * solitaire. That is when the era closes and a new world opens.
 */
export const isOver = (world: World): boolean => living(world).length <= 1;

/** Total workable land, sized so it runs out while the world is still young. */
export const DEFAULT_LAND = 80;

export function newWorld(ids: Civ["id"][], seed: number, land = DEFAULT_LAND): World {
  return { worldVersion: WORLD_VERSION, tick: 0, seed, land, civs: ids.map(newCiv) };
}
