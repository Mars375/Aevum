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

/**
 * The rules a world was lived under.
 *
 * w1 counted territory as a single number: every acre identical, and a doctrine
 * free to mine without hills. w2 gave land four kinds, each carrying one kind
 * of work. w3 adds disaster — so the land a civilisation covets carries a risk
 * as well as a yield — and vows, which give a ruler something its successor
 * inherits besides words.
 *
 * So the version is bumped rather than the old worlds quietly re-interpreted.
 * The same discipline as I20 in the battle rules — a recorded run must keep
 * meaning what it meant when it was recorded. w1 journals stay on disk as
 * records, with the reports written from them; they are no longer replayable,
 * and the code says so instead of silently producing different numbers.
 */
export const WORLD_VERSION = "w3";

export const RESOURCES = ["food", "timber", "ore", "wealth"] as const;
export const ResourceSchema = z.enum(RESOURCES);
export type Resource = z.infer<typeof ResourceSchema>;

/**
 * Land is not interchangeable.
 *
 * The first version counted territory as a single number, which made every
 * acre identical and expansion a purely quantitative question. It also made
 * doctrine free: a ruler could put everyone in the mines whether or not it held
 * a single hill.
 *
 * Four kinds, each limiting one activity. Deliberately NOT a map: these are
 * counts, not tiles, and nothing here claims adjacency, distance or borders
 * drawn on a surface. A real map would need pathing, frontiers and a renderer
 * for all of it; this gets heterogeneous land — which is what makes "what do we
 * take next" a question — at a fraction of the cost.
 */
export const LAND_KINDS = ["plain", "forest", "hill", "river"] as const;
export const LandKindSchema = z.enum(LAND_KINDS);
export type LandKind = z.infer<typeof LandKindSchema>;

export const LandsSchema = z.object({
  plain: z.number().int().min(0),
  forest: z.number().int().min(0),
  hill: z.number().int().min(0),
  river: z.number().int().min(0),
});
export type Lands = z.infer<typeof LandsSchema>;

export const noLand = (): Lands => ({ plain: 0, forest: 0, hill: 0, river: 0 });
export const landCount = (l: Lands): number => l.plain + l.forest + l.hill + l.river;

/** Which activity each kind of land carries. A doctrine cannot outrun its ground. */
export const LAND_CARRIES: Record<LandKind, "farming" | "forestry" | "mining" | "trade"> = {
  plain: "farming",
  forest: "forestry",
  hill: "mining",
  river: "trade",
};

/** What a ruler can bind its successors to. Each is a floor the engine can read. */
export const VOW_METRICS = ["food", "soldiers", "territory", "population"] as const;
export const VowMetricSchema = z.enum(VOW_METRICS);
export type VowMetric = z.infer<typeof VowMetricSchema>;

export const VowSchema = z.object({
  metric: VowMetricSchema,
  floor: z.number().min(0),
  /** The year it was sworn, so a successor knows how old the promise is. */
  sworn: z.number().int(),
});
export type Vow = z.infer<typeof VowSchema>;

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
  /**
   * A promise made to one's successors, and checked by the engine.
   *
   * Every decision is already taken by what amounts to a new ruler: the model
   * has no memory between calls, so continuity has only ever been the creed —
   * words inherited from people who are gone. A vow is the same inheritance
   * made accountable: a floor a predecessor committed to, which the engine
   * watches every year and reports as kept or broken.
   *
   * Deliberately structured rather than free text. A promise a machine cannot
   * check is a promise nobody can check, and this project does not have one
   * model judge another.
   */
  vow: VowSchema.nullable().default(null),
  /**
   * What kind of land this civilisation reaches for when it expands, and takes
   * first when it seizes.
   *
   * Standing policy like the rest: a ruler that has decided its people need
   * grain does not need to be woken again to say so the next time a frontier
   * opens.
   */
  claim: LandKindSchema.default("plain"),
});
export type Doctrine = z.infer<typeof DoctrineSchema>;

export const CivSchema = z.object({
  id: FactionIdSchema,
  population: z.number(),
  /**
   * Land held, by kind. `territory` is the total and is derived from it — kept
   * as a field because every reader, the chronicle included, wants the number
   * without summing four others.
   */
  lands: LandsSchema,
  territory: z.number(),
  stock: StockSchema,
  doctrine: DoctrineSchema,
  /** Standing forces. Cost upkeep whether used or not. */
  soldiers: z.number(),
  /** Unlocked advances, in the order they were reached. */
  advances: z.array(z.string()).default([]),
  /** Ticks since this civilisation last had to decide anything. */
  ticksSinceDecision: z.number().int().default(0),
  /**
   * The year a standing vow was broken, if it was. Cleared when a ruler swears
   * a new one — a successor answers for its own promise, not its ancestors'.
   */
  vowBrokenOn: z.number().int().nullable().default(null),
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
  /**
   * Unclaimed land, by kind.
   *
   * Finite per kind, not just in total: a world can run out of rivers while
   * plains remain, and then trade stops being something a ruler can simply
   * decide to do.
   */
  free: LandsSchema.default({ plain: 26, forest: 18, hill: 14, river: 6 }),
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
  claim: "plain",
  vow: null,
};

export function newCiv(id: Civ["id"]): Civ {
  return {
    id,
    population: 100,
    // Everyone starts with one of each: no civilisation is born unable to do
    // something, and every difference that follows was chosen or taken.
    lands: { plain: 1, forest: 1, hill: 1, river: 1 },
    territory: 4,
    stock: { food: 200, timber: 80, ore: 40, wealth: 50 },
    doctrine: { ...DEFAULT_DOCTRINE },
    soldiers: 5,
    advances: [],
    ticksSinceDecision: 0,
    vowBrokenOn: null,
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

/**
 * The unclaimed world, once the founders have taken their four each.
 *
 * Deliberately unequal by kind: plains are common and rivers are scarce, so
 * "who gets the rivers" is settled early and permanently — which is the same
 * property that made finite land produce a history rather than a cycle.
 */
export const FREE_LAND: Lands = { plain: 30, forest: 18, hill: 10, river: 6 };

export function newWorld(ids: Civ["id"][], seed: number, land = DEFAULT_LAND): World {
  const civs = ids.map(newCiv);
  const taken = civs.reduce((n, c) => n + landCount(c.lands), 0);
  return {
    worldVersion: WORLD_VERSION,
    tick: 0,
    seed,
    land: taken + landCount(FREE_LAND),
    free: { ...FREE_LAND },
    civs,
  };
}
