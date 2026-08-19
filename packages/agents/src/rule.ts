import { z } from "zod";
import type { Civ, DecisionPoint, Ruling } from "@abs/world";
import type { GeneralConfig } from "@abs/contracts";
import { RULING_JSON_SCHEMA, systemPromptWorld, userPromptWorld } from "./prompt-world.js";

/**
 * Ask a ruler what to do, and turn its answer into a ruling.
 *
 * A world that never ends will run for thousands of ticks, so this must never
 * throw and never block: an unreachable model, a malformed answer, a truncated
 * one — the world carries on under the doctrine already in force. Silence is a
 * valid answer here in a way it never was in a battle, where a missing order
 * meant a wasted turn.
 */

const SHARE_KEYS = ["farming", "forestry", "mining", "trade", "military"] as const;

/**
 * Find the shares wherever the model chose to put them.
 *
 * The schema asks for five flat numbers. Models answered with them nested
 * under `shares`, and then under `employment` — both at least as reasonable a
 * reading of a prompt that lists them as a group. Chasing container names one
 * at a time is a losing game, so this looks for the numbers themselves: any
 * nested object carrying most of the five is the answer, whatever it is
 * called. Parsing what models send rather than repairing it, the same choice
 * CompositionChoiceSchema makes in the battle rules.
 */
const lift = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const obj = value as Record<string, unknown>;
  if (SHARE_KEYS.every((k) => typeof obj[k] === "number")) return obj;

  for (const nested of Object.values(obj)) {
    if (typeof nested !== "object" || nested === null || Array.isArray(nested)) continue;
    const inner = nested as Record<string, unknown>;
    if (SHARE_KEYS.filter((k) => typeof inner[k] === "number").length >= 3) {
      // The outer object still carries reasoning and creed; only the shares move.
      return { ...obj, ...inner };
    }
  }
  return obj;
};

const RulingAnswerSchema = z.preprocess(lift, z.object({
  reasoning: z.string().default(""),
  creed: z.string().default(""),
  farming: z.number().min(0).max(1000),
  forestry: z.number().min(0).max(1000),
  mining: z.number().min(0).max(1000),
  trade: z.number().min(0).max(1000),
  military: z.number().min(0).max(1000),
}));

export interface RulerProvider {
  ask(general: GeneralConfig, sys: string, usr: string, schema: unknown): Promise<string | null>;
  /** Which model actually answered, when the provider tracks it. */
  lastModel?(): string | null;
}

export async function askRuler(
  provider: RulerProvider,
  general: GeneralConfig,
  civ: Civ,
  point: DecisionPoint,
  /**
   * Told why an answer was thrown away, and what it was.
   *
   * Without this the first live world reported nine silent rulers with no
   * reason, and the silence looked like a network problem when it was a
   * validation one. A rejection a caller cannot see is a rejection nobody
   * will ever fix.
   */
  onReject?: (why: string, raw: string) => void,
): Promise<Ruling | null> {
  const raw = await provider.ask(
    general,
    systemPromptWorld(),
    userPromptWorld(civ, point),
    RULING_JSON_SCHEMA,
  );
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    onReject?.("not JSON", raw);
    return null;
  }

  const answer = RulingAnswerSchema.safeParse(parsed);
  if (!answer.success) {
    onReject?.(answer.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "), raw);
    return null;
  }

  const { reasoning, creed, ...work } = answer.data;
  const total = work.farming + work.forestry + work.mining + work.trade + work.military;
  // A ruler who employs nobody has not answered the question. Better to keep
  // the standing doctrine than to install one that starves everyone.
  if (total <= 0) {
    onReject?.("employs nobody", raw);
    return null;
  }

  return {
    tick: point.tick,
    civ: civ.id,
    kind: point.kind,
    // The creed is only replaced when the ruler actually wrote one; an empty
    // string would silently erase what predecessors left behind.
    doctrine: { ...work, ...(creed.trim() ? { creed: creed.trim() } : {}) },
    reason: reasoning.trim(),
    model: provider.lastModel?.() ?? general.model,
  };
}
