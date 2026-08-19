import { z } from "zod";
import { FactionIdSchema } from "@abs/contracts";
import { DoctrineSchema, WorldSchema, type World } from "./state.js";
import { DECISION_KINDS } from "./decide.js";

/**
 * The world's memory.
 *
 * A battle replay stores every state because a battle is short. A world that
 * never ends cannot: storing 500 full states would make the file grow without
 * bound and re-reading it grow with it. So the journal stores the initial
 * world, then only what a ruler decided — the ticks in between are recomputed
 * by the engine, which is deterministic and therefore free.
 *
 * W4 — replaying the journal through the engine reproduces the state exactly.
 * This is the same contract the battle replays hold, and it is what makes the
 * world auditable rather than merely observed.
 */

export const RulingSchema = z.object({
  tick: z.number().int(),
  civ: FactionIdSchema,
  kind: z.enum(DECISION_KINDS),
  /** What the ruler changed. Absent fields are left as they were. */
  doctrine: DoctrineSchema.partial(),
  /** The ruler's own words, kept verbatim — this is the civilisation's history. */
  reason: z.string(),
  /** Which model answered, or null when the doctrine answered by default. */
  model: z.string().nullable(),
});
export type Ruling = z.infer<typeof RulingSchema>;

export const JournalSchema = z.object({
  worldVersion: z.literal("w1"),
  /** The world at tick 0. Everything after is derived. */
  origin: WorldSchema,
  /**
   * How far this world has lived.
   *
   * Not derivable from the rulings, and assuming otherwise silently reset a
   * 120-year world to year 0 on the first resume: a world can live centuries
   * without a single ruler being woken, and those centuries are real.
   */
  livedTo: z.number().int().default(0),
  rulings: z.array(RulingSchema),
});
export type Journal = z.infer<typeof JournalSchema>;

export const newJournal = (origin: World): Journal => ({
  worldVersion: "w1",
  origin,
  livedTo: origin.tick,
  rulings: [],
});
