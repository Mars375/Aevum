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
    /** Une attaque a eu lieu et a echoue. Le choix etait au dirigeant. */
    | "ROUTED"
    | "HELD"
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

/** A replay-derived event. The engine still emits the unadorned TickEvent. */
export interface LifeEvent extends TickEvent {
  id: string;
  worldVersion: "w8";
  /** Consequences are facts of resolution, not claims that a ruling caused them. */
  attribution: "engine-only";
  /** Position in the engine's deterministic event order for this year. */
  order: number;
}

/**
 * Stable identity for one engine-emitted fact.
 *
 * The explicit tick and civilisation keep callers from deriving identity from
 * presentation text around an event. `detail` remains part of the fact because
 * two losses of different amounts in the same year are different evidence.
 */
export function eventId(event: TickEvent, tick: number, civ: Civ["id"]): string {
  const ordered = "order" in event && typeof event.order === "number" ? event.order : 0;
  return ["world-event-v1", tick, civ, ordered, event.kind, encodeURIComponent(event.detail)].join(":");
}

export function lifeEvent(event: TickEvent, order: number): LifeEvent {
  const ordered = { ...event, order };
  return {
    ...ordered,
    id: eventId(ordered, event.tick, event.civ),
    worldVersion: "w8",
    attribution: "engine-only",
  };
}

export interface TickResult {
  world: World;
  events: TickEvent[];
}

/** Shares are normalised here so a ruler may answer in any scale it likes. */
