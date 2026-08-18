/**
 * JSON Schemas for the v2 decision and the army-buying step.
 *
 * Hand-written like the v1 schema, and guarded the same way: a test validates
 * one sample against both this and the zod schema so they cannot drift.
 */

const ORDER_ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["squadId", "action", "target"],
  properties: {
    squadId: { type: "string" },
    action: { type: "string", enum: ["MOVE", "ATTACK", "HOLD"] },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: { x: { type: "integer" }, y: { type: "integer" } },
    },
  },
} as const;

export const ORDER_JSON_SCHEMA_V2 = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "orders", "diplomacy"],
  properties: {
    reasoning: { type: "string", description: "One or two sentences, written for a spectator." },
    orders: { type: "array", description: "Exactly one order per squad you command.", items: ORDER_ITEM },
    diplomacy: {
      // At most one action per turn, and null is a normal answer — most turns
      // have nothing diplomatic to say.
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["action", "target", "message"],
          properties: {
            action: { type: "string", enum: ["PROPOSE_ALLIANCE", "ACCEPT_ALLIANCE", "BREAK_ALLIANCE", "SURRENDER"] },
            target: { anyOf: [{ type: "null" }, { type: "string", enum: ["crimson", "azure", "verdant", "amber"] }] },
            message: { type: "string" },
          },
        },
      ],
    },
  },
} as const;

export const COMPOSITION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "squads"],
  properties: {
    reasoning: { type: "string" },
    squads: {
      type: "array",
      description: "Between 1 and 4 archetypes, total cost at most 20.",
      items: { type: "string", enum: ["MELEE", "RANGED", "SCOUT", "HEAVY"] },
    },
  },
} as const;
