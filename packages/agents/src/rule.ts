import { z } from "zod";
import type { Civ, DecisionPoint, Ruling, World } from "@abs/world";
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
 * What a model may call its explanation.
 *
 * Every ruling in a hundred-year run came back with an empty reason, and the
 * cause was mine: rewriting the closing instruction dropped any mention of
 * explaining why, so models stopped explaining. The prompt asks for it again —
 * and since the word for it varies, all the obvious ones are read. A chronicle
 * of blank reasons is a chronicle nobody can read.
 */
const REASON_KEYS = ["reasoning", "reason", "rationale", "why", "justification", "explanation"] as const;

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
  const obj = { ...(value as Record<string, unknown>) };
  if (typeof obj.reasoning !== "string") {
    const alias = REASON_KEYS.find((k) => typeof obj[k] === "string" && (obj[k] as string).trim());
    if (alias) obj.reasoning = obj[alias];
  }
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

/**
 * A vow written the way one would naturally write it.
 *
 * The schema asks for two flat fields because strict structured output has no
 * good way to say "an object or nothing". Models reasonably answer with
 * `vow: { metric, floor }` instead. Reading both is a line of code; losing every
 * vow to a shape preference is not worth defending.
 */
/**
 * A null field is a model saying "nothing here", which is what absent means.
 *
 * Caught by the preflight before it cost a rotation: one model answered
 * `vowMetric: "none", vowFloor: null`, and the whole ruling — shares, posture,
 * creed and all — was thrown away because zod's `.optional()` accepts undefined
 * and not null. Rejecting a good answer to enforce a form is the failure this
 * file already guards against everywhere else.
 */
const dropNulls = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null));
};

const liftVow = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const obj = value as Record<string, unknown>;
  if (obj.vowMetric !== undefined) return obj;
  const nested = obj.vow;
  if (typeof nested !== "object" || nested === null) return obj;
  const inner = nested as Record<string, unknown>;
  if (typeof inner.metric !== "string") return obj;
  return { ...obj, vowMetric: inner.metric, vowFloor: inner.floor };
};

const RulingAnswerSchema = z.preprocess((v) => dropNulls(liftVow(lift(v))), z.object({
  reasoning: z.string().default(""),
  creed: z.string().default(""),
  // Defaulted, not required: a ruler woken by a famine has no reason to
  // reconsider its foreign policy, and rejecting the whole answer over a
  // missing posture would throw away a good one.
  posture: z.enum(["TRADE", "GUARD", "PRESSURE"]).optional(),
  // Same reasoning as posture: a ruler woken by a famine has no reason to
  // reconsider which frontier it wants next, and rejecting a good answer over a
  // missing field would be throwing away governing to enforce a form.
  claim: z.enum(["plain", "forest", "hill", "river"]).optional(),
  vowMetric: z.enum(["food", "soldiers", "territory", "population", "none"]).optional(),
  vowFloor: z.number().min(0).optional(),
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
  /** The board, so a ruler is told what its frontier actually touches. */
  world?: World,
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
    userPromptWorld(civ, point, world),
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

  const { reasoning, creed, posture, claim, vowMetric, vowFloor, ...work } = answer.data;
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
    doctrine: {
      ...work,
      ...(posture ? { posture } : {}),
      ...(claim ? { claim } : {}),
      // "none" is a real answer and not a missing one: it means this ruler
      // swears nothing new, which leaves the standing vow untouched rather
      // than clearing it.
      ...(vowMetric && vowMetric !== "none" && vowFloor !== undefined
        ? { vow: { metric: vowMetric, floor: vowFloor, sworn: point.tick } }
        : {}),
      ...(creed.trim() ? { creed: creed.trim() } : {}),
    },
    reason: reasoning.trim(),
    model: provider.lastModel?.() ?? general.model,
    // Stamped by the caller, which is the only thing that knows how long this
    // decision waited for a model to be free.
    deferredBy: 0,
    context: [...point.evidence],
    service: null,
    consequenceRef: null,
  };
}
