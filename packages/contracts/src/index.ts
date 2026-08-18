import { z } from "zod";

/**
 * Versioned data contracts shared by the engine, the agents and the replay
 * player. This module is the single source of truth: nothing here imports the
 * engine or the network, so both sides can depend on it without a cycle.
 */

export const CONTRACTS_VERSION = "2.0.0";
export const RULESET_VERSION = "v1";
export const RULESET_VERSIONS = ["v1", "v2"] as const;
export const RulesetVersionSchema = z.enum(RULESET_VERSIONS);
export type RulesetVersion = z.infer<typeof RulesetVersionSchema>;

/** v2 only. See docs/spec/rules-v2.md. */
export const ARMY_BUDGET = 20;
export const MAX_SQUADS_PER_FACTION = 4;
export const MAX_MEMORY_ENTRIES = 8;
export const MAX_DIPLOMACY_MESSAGE_CHARS = 200;
/** A betrayal takes effect at the end of the FOLLOWING turn, never instantly. */
export const ALLIANCE_BREAK_DELAY_TURNS = 1;
export const PROPOSAL_TTL_TURNS = 3;
export const GRID_SIZE = 16;
export const MAX_TURNS = 12;
export const MAX_REASONING_CHARS = 2000;

export const FACTION_IDS = ["crimson", "azure", "verdant", "amber"] as const;
export const FactionIdSchema = z.enum(FACTION_IDS);
export type FactionId = z.infer<typeof FactionIdSchema>;

export const ArchetypeSchema = z.enum(["MELEE", "RANGED", "SCOUT", "HEAVY"]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export interface ArchetypeStats {
  hp: number;
  movement: number;
  range: number;
  damage: number;
  /** Chebyshev sight radius. Unused at v1, where visibility is total. */
  vision: number;
  /** Army-budget cost. Unused at v1, where composition is imposed. */
  cost: number;
}

/**
 * MELEE and RANGED keep their exact v1 numbers, so a v1 replay resolves
 * identically under the v2 engine (invariant I20). SCOUT and HEAVY exist only
 * at v2 — the scout barely fights and sees furthest, the heavy is blind and
 * absorbs.
 */
export const ARCHETYPES: Record<Archetype, ArchetypeStats> = {
  MELEE: { hp: 10, movement: 2, range: 1, damage: 4, vision: 4, cost: 6 },
  RANGED: { hp: 8, movement: 1, range: 4, damage: 3, vision: 6, cost: 7 },
  SCOUT: { hp: 6, movement: 3, range: 1, damage: 2, vision: 9, cost: 4 },
  HEAVY: { hp: 16, movement: 1, range: 1, damage: 6, vision: 3, cost: 10 },
};

/** Archetypes a v1 battle may contain. Guards I20 against a v2 unit leaking in. */
export const V1_ARCHETYPES: readonly Archetype[] = ["MELEE", "RANGED"];

export const Vec2Schema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});
export type Vec2 = z.infer<typeof Vec2Schema>;

export const SquadSchema = z.object({
  id: z.string(),
  factionId: FactionIdSchema,
  archetype: ArchetypeSchema,
  position: Vec2Schema,
  hp: z.number().int(),
  maxHp: z.number().int(),
});
export type Squad = z.infer<typeof SquadSchema>;

export const WorldStateSchema = z.object({
  turn: z.number().int(),
  /** Living squads only. A destroyed squad is removed, never resurrected (invariant I1). */
  squads: z.array(SquadSchema),
});
export type WorldState = z.infer<typeof WorldStateSchema>;

/** An enemy seen on an earlier turn and lost since. Fog made playable. */
export const RememberedSquadSchema = SquadSchema.extend({
  /** Turn the position was last observed. The general may act on stale news. */
  lastSeenTurn: z.number().int(),
});
export type RememberedSquad = z.infer<typeof RememberedSquadSchema>;

/** One line of the engine-built digest handed back to a general. */
export const MemoryEntrySchema = z.object({
  turn: z.number().int(),
  lost: z.array(z.string()),
  destroyed: z.array(z.string()),
  diplomacy: z.array(z.string()),
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

/**
 * What a single general is shown.
 *
 * Distinct from WorldState on purpose, and that separation is what let v2 add
 * fog of war without touching the engine: `enemySquads` becomes "what you can
 * see", `rememberedEnemies` "what you last saw". At v1 the fields carry total
 * visibility and the v2-only fields stay empty.
 */
export const LocalViewSchema = z.object({
  turn: z.number().int(),
  maxTurns: z.number().int(),
  gridSize: z.number().int(),
  you: FactionIdSchema,
  yourSquads: z.array(SquadSchema),
  /** Currently visible. At v1 this is every enemy. */
  enemySquads: z.array(SquadSchema),
  /** v2 only: last known position of enemies now out of sight. */
  rememberedEnemies: z.array(RememberedSquadSchema).default([]),
  /** v2 only: factions currently allied with you. */
  allies: z.array(FactionIdSchema).default([]),
  /** v2 only: alliance proposals awaiting your answer. */
  pendingProposals: z.array(FactionIdSchema).default([]),
  /** v2 only: engine-built digest, capped at MAX_MEMORY_ENTRIES. */
  memory: z.array(MemoryEntrySchema).default([]),
  /** v2 only: points spent and the ceiling, so a general can reason about it. */
  budget: z.object({ spent: z.number().int(), total: z.number().int() }).nullable().default(null),
});
export type LocalView = z.infer<typeof LocalViewSchema>;

export const OrderActionSchema = z.enum(["MOVE", "ATTACK", "HOLD"]);
export type OrderAction = z.infer<typeof OrderActionSchema>;

export const OrderSchema = z.object({
  squadId: z.string(),
  action: OrderActionSchema,
  target: Vec2Schema,
});
export type Order = z.infer<typeof OrderSchema>;

export const DiplomacyActionSchema = z.enum(["PROPOSE_ALLIANCE", "ACCEPT_ALLIANCE", "BREAK_ALLIANCE", "SURRENDER"]);
export type DiplomacyAction = z.infer<typeof DiplomacyActionSchema>;

/**
 * At most one per general per turn — that is the "bounded" in bounded
 * diplomacy. `message` is theatre: it is recorded and shown, and has no
 * mechanical effect whatsoever. Said explicitly so nobody believes a model can
 * negotiate anything beyond the four verbs above.
 */
export const DiplomacySchema = z.object({
  action: DiplomacyActionSchema,
  /** Omitted for SURRENDER, required otherwise. */
  target: FactionIdSchema.nullable().default(null),
  message: z.string().default(""),
});
export type Diplomacy = z.infer<typeof DiplomacySchema>;

/** Exactly what a general's model must return. Mirrored as JSON Schema in @abs/agents. */
export const DecisionSchema = z.object({
  reasoning: z.string(),
  orders: z.array(OrderSchema),
  /** v2 only. Absent or null at v1, and ignored by the v1 engine. */
  diplomacy: DiplomacySchema.nullable().default(null),
});
export type Decision = z.infer<typeof DecisionSchema>;

/** What a general answers when asked to buy an army, before turn 1. */
export const CompositionChoiceSchema = z.object({
  reasoning: z.string(),
  squads: z.array(ArchetypeSchema),
});
export type CompositionChoice = z.infer<typeof CompositionChoiceSchema>;

export const REJECTION_REASONS = [
  "UNKNOWN_SQUAD",
  "FOREIGN_SQUAD",
  "DEAD_SQUAD",
  "DUPLICATE_ORDER",
  "ORDER_MISSING",
  "OUT_OF_BOUNDS",
  "MOVE_TOO_FAR",
] as const;

export const DIPLOMACY_REJECTIONS = [
  "DUPLICATE_DIPLOMACY",
  "NO_SUCH_PROPOSAL",
  "SELF_TARGETED",
  "DEAD_FACTION",
  "NOT_ALLIED",
  "MISSING_TARGET",
  "ALREADY_ALLIED",
] as const;
export const DiplomacyRejectionSchema = z.enum(DIPLOMACY_REJECTIONS);
export type DiplomacyRejection = z.infer<typeof DiplomacyRejectionSchema>;

export const COMPOSITION_REJECTIONS = ["OVER_BUDGET", "TOO_MANY_SQUADS", "EMPTY", "NO_OFFENSE"] as const;
export const CompositionRejectionSchema = z.enum(COMPOSITION_REJECTIONS);
export const RejectionReasonSchema = z.enum(REJECTION_REASONS);
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const BattleEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ORDER_REJECTED"), squadId: z.string(), reason: RejectionReasonSchema }),
  z.object({ type: z.literal("ORDER_MISSING"), squadId: z.string() }),
  z.object({ type: z.literal("MOVE_OK"), squadId: z.string(), from: Vec2Schema, to: Vec2Schema }),
  z.object({ type: z.literal("MOVE_BLOCKED"), squadId: z.string(), attempted: Vec2Schema }),
  z.object({ type: z.literal("ATTACK_HIT"), squadId: z.string(), targetSquadId: z.string(), at: Vec2Schema, damage: z.number().int() }),
  z.object({ type: z.literal("ATTACK_MISSED"), squadId: z.string(), at: Vec2Schema }),
  z.object({ type: z.literal("ATTACK_OUT_OF_RANGE"), squadId: z.string(), at: Vec2Schema, distance: z.number().int(), range: z.number().int() }),
  z.object({ type: z.literal("ATTACK_FRIENDLY_BLOCKED"), squadId: z.string(), at: Vec2Schema }),
  z.object({ type: z.literal("SQUAD_DESTROYED"), squadId: z.string(), factionId: FactionIdSchema }),
  z.object({ type: z.literal("FACTION_ELIMINATED"), factionId: FactionIdSchema }),
  /**
   * Emitted when every model in a general's fallback chain failed. The squads
   * hold, and the replay says so — the client never invents an order.
   */
  z.object({ type: z.literal("GENERAL_UNREACHABLE"), factionId: FactionIdSchema, error: z.string() }),

  // ---- v2 ----
  z.object({ type: z.literal("ATTACK_ALLY_BLOCKED"), squadId: z.string(), at: Vec2Schema }),
  z.object({ type: z.literal("COMPOSITION_REJECTED"), factionId: FactionIdSchema, reason: CompositionRejectionSchema }),
  z.object({ type: z.literal("DIPLOMACY_REJECTED"), factionId: FactionIdSchema, reason: DiplomacyRejectionSchema }),
  z.object({ type: z.literal("ALLIANCE_PROPOSED"), from: FactionIdSchema, to: FactionIdSchema, message: z.string() }),
  z.object({ type: z.literal("ALLIANCE_FORMED"), a: FactionIdSchema, b: FactionIdSchema }),
  /** Announced the turn it is declared; it only bites at `effectiveTurn`. */
  z.object({ type: z.literal("ALLIANCE_BREAK_DECLARED"), from: FactionIdSchema, to: FactionIdSchema, effectiveTurn: z.number().int() }),
  z.object({ type: z.literal("ALLIANCE_BROKEN"), a: FactionIdSchema, b: FactionIdSchema }),
  z.object({ type: z.literal("FACTION_SURRENDERED"), factionId: FactionIdSchema, message: z.string() }),
]);
export type BattleEvent = z.infer<typeof BattleEventSchema>;

export const TelemetrySchema = z.object({
  factionId: FactionIdSchema,
  /** Model asked for first; differs from `servedModel` when the chain fell back. */
  requestedModel: z.string(),
  servedModel: z.string().nullable(),
  /**
   * Set by the provider itself rather than inferred by comparing model names —
   * a stand-in provider legitimately serves under a different name without any
   * fallback having occurred.
   */
  fellBack: z.boolean(),
  attempts: z.number().int(),
  latencyMs: z.number().int(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  /** Always 0 on the free tier. Recorded so a paid run stays auditable. */
  costUsd: z.number(),
  error: z.string().nullable(),
});
export type Telemetry = z.infer<typeof TelemetrySchema>;

export const DecisionRecordSchema = z.object({
  factionId: FactionIdSchema,
  reasoning: z.string(),
  orders: z.array(OrderSchema),
  diplomacy: DiplomacySchema.nullable().default(null),
  telemetry: TelemetrySchema,
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export const AllianceStateSchema = z.object({
  /** Sorted, deduplicated pairs "a|b". Always symmetric (invariant I15). */
  pairs: z.array(z.string()).default([]),
  surrendered: z.array(FactionIdSchema).default([]),
});
export type AllianceState = z.infer<typeof AllianceStateSchema>;

export const TurnRecordSchema = z.object({
  turn: z.number().int(),
  decisions: z.array(DecisionRecordSchema),
  events: z.array(BattleEventSchema),
  stateAfter: WorldStateSchema,
  /** v2 only. Absent on v1 replays. */
  alliances: AllianceStateSchema.nullable().default(null),
});
export type TurnRecord = z.infer<typeof TurnRecordSchema>;

export const OutcomeSchema = z.object({
  kind: z.enum(["VICTORY", "DRAW", "ANNIHILATION", "ALLIANCE_VICTORY"]),
  winner: FactionIdSchema.nullable(),
  /** v2 only: every faction of a jointly winning alliance. No tie-break. */
  winners: z.array(FactionIdSchema).default([]),
  reason: z.string(),
  finalTurn: z.number().int(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

export const GeneralConfigSchema = z.object({
  factionId: FactionIdSchema,
  displayName: z.string(),
  model: z.string(),
  /** Ordered chain tried on 429, timeout or malformed output. */
  fallbacks: z.array(z.string()),
});
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;

export const BattleConfigSchema = z.object({
  /** Which ruleset the engine plays. Defaults to v1 so old configs keep working. */
  rulesetVersion: RulesetVersionSchema.default("v1"),
  seed: z.number().int(),
  maxTurns: z.number().int().default(MAX_TURNS),
  gridSize: z.number().int().default(GRID_SIZE),
  generals: z.array(GeneralConfigSchema).length(4),
});
export type BattleConfig = z.infer<typeof BattleConfigSchema>;

export const ReplayManifestSchema = z.object({
  replayVersion: z.literal("1"),
  rulesetVersion: RulesetVersionSchema,
  contractsVersion: z.string(),
  battleId: z.string(),
  createdAt: z.string(),
  config: BattleConfigSchema,
});
export type ReplayManifest = z.infer<typeof ReplayManifestSchema>;

export const ReplaySchema = z.object({
  manifest: ReplayManifestSchema,
  initialState: WorldStateSchema,
  turns: z.array(TurnRecordSchema),
  outcome: OutcomeSchema,
});
export type Replay = z.infer<typeof ReplaySchema>;

/** Chebyshev distance: the eight directions all cost one step. */
export function distance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function inBounds(p: Vec2, gridSize = GRID_SIZE): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < gridSize && p.y < gridSize;
}
