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
 * of work. w3 added disaster and vows.
 *
 * w4 puts the land on a board. Until now a civilisation simply *had* seven
 * plains, as if land were a stock you accumulate; there was no elsewhere for it
 * to come from. Now every place exists in its own right, starts unowned, and
 * has neighbours — so land is taken from somewhere, from someone, and only
 * where a civilisation already reaches.
 *
 * So the version is bumped rather than the old worlds quietly re-interpreted.
 * The same discipline as I20 in the battle rules — a recorded run must keep
 * meaning what it meant when it was recorded. w1 journals stay on disk as
 * records, with the reports written from them; they are no longer replayable,
 * and the code says so instead of silently producing different numbers.
 */
export const WORLD_VERSION = "w4";

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

/**
 * One place in the world.
 *
 * Neutral until somebody takes it. Its position is its index on a square
 * board, which is what gives it neighbours — and neighbours are the whole
 * point: a civilisation can only reach what it already borders, so a frontier
 * is a real thing rather than an accounting entry.
 */
export const PlaceSchema = z.object({
  kind: LandKindSchema,
  owner: FactionIdSchema.nullable(),
});
export type Place = z.infer<typeof PlaceSchema>;

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
   * Land held, by kind, and its total.
   *
   * Both are now *derived from the board* and recomputed every tick. They stay
   * on the civilisation because production, the decision rules and every reader
   * want them without walking eighty-one places — but the board is the truth.
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
  /** Side of the square board. */
  size: z.number().int().default(9),
  /**
   * Every place in the world, in row-major order.
   *
   * The single source of truth about who holds what. `free` is derived from it
   * for readers who only want to know what is left.
   */
  board: z.array(PlaceSchema),
  /** Unclaimed land, by kind. Derived from the board every tick. */
  free: LandsSchema.default({ plain: 0, forest: 0, hill: 0, river: 0 }),
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
    // Filled from the board at founding: what a civilisation can do is now
    // decided by where it happens to start, not by a gift of one of each.
    lands: noLand(),
    territory: 0,
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

/** Row-major index, and the four places that touch it. Edges have fewer. */
export const at = (size: number, x: number, y: number) => y * size + x;

export function neighbours(size: number, index: number): number[] {
  const x = index % size;
  const y = Math.floor(index / size);
  const out: number[] = [];
  if (x > 0) out.push(at(size, x - 1, y));
  if (x < size - 1) out.push(at(size, x + 1, y));
  if (y > 0) out.push(at(size, x, y - 1));
  if (y < size - 1) out.push(at(size, x, y + 1));
  return out;
}

/** Which kinds the board is made of, and in what proportion. */
const KIND_WEIGHTS: Array<[LandKind, number]> = [
  ["plain", 0.46],
  ["forest", 0.24],
  ["hill", 0.18],
  ["river", 0.12],
];

/**
 * Lay out a world.
 *
 * The board is drawn from the seed, so the same world is the same world every
 * time it is replayed — and rivers are scarce, which is what makes "who reaches
 * them first" a story rather than a formality.
 */
export function newWorld(ids: Civ["id"][], seed: number, size = 9): World {
  const board: Place[] = [];
  for (let i = 0; i < size * size; i += 1) {
    // Same cheap mix as the seasons, different salt.
    let h = (seed * 0x2545f491) ^ ((i + 1) * 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
    h ^= h >>> 16;
    let roll = (h >>> 0) / 0x100000000;
    let kind: LandKind = "plain";
    for (const [k, w] of KIND_WEIGHTS) {
      if (roll < w) {
        kind = k;
        break;
      }
      roll -= w;
    }
    board.push({ kind, owner: null });
  }

  // Founders start one place each, spread to the corners: nobody begins next to
  // anybody, so the first century is expansion into empty land and the meeting
  // happens later, on purpose.
  const corners = [at(size, 1, 1), at(size, size - 2, 1), at(size, 1, size - 2), at(size, size - 2, size - 2)];
  const civs = ids.map(newCiv);
  civs.forEach((civ, i) => {
    const home = corners[i % corners.length]!;
    board[home]!.owner = civ.id;
  });

  return { worldVersion: WORLD_VERSION, tick: 0, seed, land: size * size, size, board, free: noLand(), civs };
}

/** Recount holdings from the board. The board is the truth; these are readings. */
export function census(world: World): World {
  const byCiv = new Map<string, Lands>(world.civs.map((c) => [c.id, noLand()]));
  const free = noLand();
  for (const place of world.board) {
    const held = place.owner === null ? null : byCiv.get(place.owner);
    // A place whose owner is not in this world counts as neutral rather than
    // throwing: the board and the roll of civilisations are two files, and one
    // being edited without the other must degrade, not crash.
    if (held) held[place.kind] += 1;
    else free[place.kind] += 1;
  }
  return {
    ...world,
    free,
    civs: world.civs.map((c) => {
      const lands = byCiv.get(c.id)!;
      return { ...c, lands, territory: landCount(lands) };
    }),
  };
}
