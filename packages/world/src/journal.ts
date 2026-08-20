import { z } from "zod";
import { FactionIdSchema } from "@abs/contracts";
import { DoctrineSchema, WORLD_VERSION, WorldSchema, type World } from "./state.js";
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
  /**
   * Ticks between the decision being raised and being answered.
   *
   * Zero almost always. Above zero means a ruler was queued behind a quota,
   * and that is worth recording: a civilisation governed late is not governed
   * the same as one governed on time.
   */
  deferredBy: z.number().int().default(0),
});
export type Ruling = z.infer<typeof RulingSchema>;

/** Read the header of a journal file without parsing the rest. */
export function worldVersionOf(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = (raw as Record<string, unknown>).worldVersion;
  return typeof v === "string" ? v : null;
}

export const JournalSchema = z.object({
  worldVersion: z.literal(WORLD_VERSION),
  /**
   * Which world this is.
   *
   * A world ends when one civilisation is all that remains, and then another
   * begins. Eras are numbered rather than overwritten so the ones that came
   * before stay readable — a civilisation that fell in era 3 still happened.
   */
  era: z.number().int().default(1),
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
  /**
   * The world's fingerprint at `livedTo`, written by whoever last lived it.
   *
   * A resume recomputes the state and compares. They must match, or the world
   * is being continued from a history it did not have — see fingerprint.ts for
   * the run that made this necessary.
   */
  fingerprint: z.string().nullable().default(null),
  rulings: z.array(RulingSchema),
});
export type Journal = z.infer<typeof JournalSchema>;

export const newJournal = (origin: World, era = 1): Journal => ({
  worldVersion: WORLD_VERSION,
  era,
  origin,
  livedTo: origin.tick,
  fingerprint: null,
  rulings: [],
});
