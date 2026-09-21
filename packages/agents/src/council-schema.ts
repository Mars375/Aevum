import { ModernizationProjectSchema } from "../../world/src/modernization.js";

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
        kind: {
          type: "string",
          enum: ["settle", "build", "research", "trade"],
        },
        targetTile: { type: ["integer", "null"], minimum: 0 },
        targetCity: { type: ["string", "null"] },
        targetTech: {
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
        targetBuilding: {
          type: ["string", "null"],
          enum: [null, "granary", "workshop", "market", "walls", "academy"],
        },
        rationale: { type: "string", maxLength: 800 },
      }),
    ],
  },
});

export const MODERN_COUNCIL_JSON_SCHEMA = object({
  ...STRATEGIC_COUNCIL_JSON_SCHEMA.properties,
  modernization: {
    type: ["string", "null"],
    enum: [null, ...ModernizationProjectSchema.options],
  },
});
/** spectator-9 schema: modern contract plus the required nullable infrastructure command. */
export const INFRASTRUCTURE_COUNCIL_JSON_SCHEMA = object({
  ...MODERN_COUNCIL_JSON_SCHEMA.properties,
  infrastructure: {
    type: ["object", "null"],
    properties: {
      city: { type: "string" },
      kind: {
        type: "string",
        enum: [
          "foundry",
          "thermal_plant",
          "solar_array",
          "research_center",
          "automated_factory",
          "spaceport",
        ],
      },
    },
    required: ["city", "kind"],
    additionalProperties: false,
  },
});

/**
 * spectator-10 : le contrat v9, plus la commande d'accord.
 *
 * Plate et à champs nuls à dessein. Une forme imbriquée se rend moins
 * fidèlement qu'une forme plate, et un accord malformé coule la réponse — la
 * tolérance accordée au plan ne s'y étend pas, parce qu'un plan est une
 * annotation et un accord un engagement qui déplace des ressources.
 */
const PARCEL = {
  type: ["object", "null"],
  properties: {
    food: { type: "integer", minimum: 0 },
    timber: { type: "integer", minimum: 0 },
    ore: { type: "integer", minimum: 0 },
    wealth: { type: "integer", minimum: 0 },
  },
  required: ["food", "timber", "ore", "wealth"],
  additionalProperties: false,
} as const;

export const AGREEMENT_COUNCIL_JSON_SCHEMA = object({
  ...INFRASTRUCTURE_COUNCIL_JSON_SCHEMA.properties,
  agreement: {
    type: ["object", "null"],
    properties: {
      action: {
        type: "string",
        enum: ["propose", "accept", "decline", "renounce"],
      },
      // On répond à une offre par son identifiant : une offre remplacée ne doit
      // pas être acceptée à la place de celle qui l'a remplacée.
      offerId: { type: ["string", "null"] },
      target: { type: ["string", "null"] },
      kind: {
        type: ["string", "null"],
        enum: [null, "nonaggression", "transfer"],
      },
      duration: { type: ["integer", "null"], enum: [null, 4, 8, 12] },
      give: PARCEL,
      receive: PARCEL,
    },
    required: [
      "action",
      "offerId",
      "target",
      "kind",
      "duration",
      "give",
      "receive",
    ],
    additionalProperties: false,
  },
});
