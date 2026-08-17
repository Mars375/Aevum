import { z } from "zod";

/**
 * Versioned data contracts shared by the engine, the agents and the replay
 * player. This module is the single source of truth: nothing here imports the
 * engine or the network, so both sides can depend on it without a cycle.
 */

export const CONTRACTS_VERSION = "1.0.0";
export const RULESET_VERSION = "v1";
export const GRID_SIZE = 16;
export const MAX_TURNS = 12;
export const MAX_REASONING_CHARS = 2000;

export const FACTION_IDS = ["crimson", "azure", "verdant", "amber"] as const;
export const FactionIdSchema = z.enum(FACTION_IDS);
export type FactionId = z.infer<typeof FactionIdSchema>;

export const ArchetypeSchema = z.enum(["MELEE", "RANGED"]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

/** Fixed at ruleset v1: no army budget, no customisation. See docs/spec/rules.md. */
export const ARCHETYPES: Record<Archetype, { hp: number; movement: number; range: number; damage: number }> = {
  MELEE: { hp: 10, movement: 2, range: 1, damage: 4 },
  RANGED: { hp: 8, movement: 1, range: 4, damage: 3 },
};

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

/**
 * What a single general is shown. Distinct from WorldState on purpose: phase 2
 * introduces fog of war by filtering this projection, leaving the engine alone.
 */
export const LocalViewSchema = z.object({
  turn: z.number().int(),
  maxTurns: z.number().int(),
  gridSize: z.number().int(),
  you: FactionIdSchema,
  yourSquads: z.array(SquadSchema),
  enemySquads: z.array(SquadSchema),
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

/** Exactly what a general's model must return. Mirrored as JSON Schema in @abs/agents. */
export const DecisionSchema = z.object({
  reasoning: z.string(),
  orders: z.array(OrderSchema),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const REJECTION_REASONS = [
  "UNKNOWN_SQUAD",
  "FOREIGN_SQUAD",
  "DEAD_SQUAD",
  "DUPLICATE_ORDER",
  "ORDER_MISSING",
  "OUT_OF_BOUNDS",
  "MOVE_TOO_FAR",
] as const;
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
  telemetry: TelemetrySchema,
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export const TurnRecordSchema = z.object({
  turn: z.number().int(),
  decisions: z.array(DecisionRecordSchema),
  events: z.array(BattleEventSchema),
  stateAfter: WorldStateSchema,
});
export type TurnRecord = z.infer<typeof TurnRecordSchema>;

export const OutcomeSchema = z.object({
  kind: z.enum(["VICTORY", "DRAW", "ANNIHILATION"]),
  winner: FactionIdSchema.nullable(),
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
  seed: z.number().int(),
  maxTurns: z.number().int().default(MAX_TURNS),
  gridSize: z.number().int().default(GRID_SIZE),
  generals: z.array(GeneralConfigSchema).length(4),
});
export type BattleConfig = z.infer<typeof BattleConfigSchema>;

export const ReplayManifestSchema = z.object({
  replayVersion: z.literal("1"),
  rulesetVersion: z.literal(RULESET_VERSION),
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
