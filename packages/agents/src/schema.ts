/**
 * JSON Schema handed to the API's `strict` structured-output mode.
 *
 * Deliberately hand-written rather than generated from `DecisionSchema`. Strict
 * mode has requirements a converter makes awkward to control — every property
 * must appear in `required`, `additionalProperties` must be false everywhere —
 * and generating it would cost a dependency for a schema this small.
 *
 * The duplication is guarded: `agents.test.ts` validates one sample against
 * both this schema and the zod one, so they cannot drift apart silently.
 */
export const ORDER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "orders"],
  properties: {
    reasoning: {
      type: "string",
      description: "One or two sentences on why these orders. Written for a spectator.",
    },
    orders: {
      type: "array",
      description: "Exactly one order per squad you command.",
      items: {
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
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
            },
          },
        },
      },
    },
  },
} as const;
