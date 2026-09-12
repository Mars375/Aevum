const faction = {
  type: "string",
  enum: ["amber", "azure", "crimson", "verdant"],
};
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
/** Explicit provider schema: never send an empty schema in strict JSON mode. */
export const COUNCIL_JSON_SCHEMA = object({
  civ: faction,
  turn: { type: "integer", minimum: 0 },
  objective: { type: "string", maxLength: 1000 },
  focus: {
    type: "string",
    enum: ["balanced", "growth", "industry", "science", "military"],
  },
  research: {
    type: ["string", "null"],
    enum: [
      null,
      "irrigation",
      "masonry",
      "metallurgy",
      "coinage",
      "engineering",
      "scholarship",
    ],
  },
  recruitSettler: { type: "boolean" },
  construction: {
    type: "array",
    maxItems: 16,
    items: object({
      city: { type: "string" },
      building: {
        type: "string",
        enum: ["granary", "workshop", "market", "walls", "academy"],
      },
    }),
  },
  diplomacy: {
    type: "array",
    maxItems: 3,
    items: object({
      target: faction,
      proposal: { type: "string", enum: ["peace", "trade", "war"] },
    }),
  },
  orders: {
    type: "array",
    maxItems: 64,
    items: object({
      unit: { type: "string" },
      action: {
        type: "string",
        enum: [
          "move",
          "defend",
          "attack",
          "settle",
          "explore",
          "retreat",
          "escort",
        ],
      },
      target: { type: "integer", minimum: 0 },
      reason: { type: "string", maxLength: 800 },
      escort: { type: ["string", "null"] },
    }),
  },
});

/** Keep the old provider contract unchanged for archived rule versions. */
export const STRATEGIC_COUNCIL_JSON_SCHEMA = object({
  ...COUNCIL_JSON_SCHEMA.properties,
  plan: {
    anyOf: [
      { type: "null" },
      object({
        kind: { type: "string", enum: ["settle", "build", "research", "trade"] },
        targetTile: { type: ["integer", "null"], minimum: 0 },
        targetCity: { type: ["string", "null"] },
        targetTech: { type: ["string", "null"], enum: [null, "irrigation", "masonry", "metallurgy", "coinage", "engineering", "scholarship"] },
        targetBuilding: { type: ["string", "null"], enum: [null, "granary", "workshop", "market", "walls", "academy"] },
        rationale: { type: "string", maxLength: 800 },
      }),
    ],
  },
});
