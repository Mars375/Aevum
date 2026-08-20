import type { Civ, World } from "./state.js";

/**
 * What a year did, in words the whole package shares.
 *
 * Kept apart from the loop that emits them because the border rules emit them
 * too, and a module that owns both the events and the loop would have to be
 * imported by everything that only wanted the words.
 */
export interface TickEvent {
  tick: number;
  civ: Civ["id"];
  /** Machine-readable so the decision detector and the chronicle can both read it. */
  kind:
    | "GREW"
    | "STARVED"
    | "EXPANDED"
    | "LOST_LAND"
    | "ADVANCE"
    | "COLLAPSED"
    | "SURPLUS"
    | "SHORTAGE"
    | "HARD_YEAR"
    /** The world has no unclaimed land left. From here, growth is at someone's expense. */
    | "LAND_FULL"
    | "SEIZED"
    | "CEDED"
    | "TRADED"
    /** Bandits took what a civilisation failed to guard. */
    | "RAIDED"
    /** Bandits came and were driven off. */
    | "REPELLED"
    /** A disaster struck. The land a civilisation covets carries a risk too. */
    | "DISASTER"
    /** A promise a predecessor made no longer holds. */
    | "VOW_BROKEN"
    /** A capital changed hands. Not the same as losing a field. */
    | "CAPITAL_LOST"
    | "CAPITAL_MOVED";
  detail: string;
}

export interface TickResult {
  world: World;
  events: TickEvent[];
}

/** Shares are normalised here so a ruler may answer in any scale it likes. */
