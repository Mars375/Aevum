import { DecisionSchema, MAX_REASONING_CHARS, type Decision, type GeneralConfig, type LocalView, type Telemetry } from "@abs/contracts";
import { ENDPOINTS, isFreeRef, parseModelRef, readRateLimit, type ProviderName, type RateLimit } from "./endpoints.js";
import { extractJson } from "./json.js";
import { jsonModeInstruction, systemPrompt, userPrompt } from "./prompt.js";
import { systemPromptV2, userPromptV2 } from "./prompt-v2.js";
import { ORDER_JSON_SCHEMA_V2 } from "./schema-v2.js";
import { supportsNativeSchema } from "./roster.js";
import { ORDER_JSON_SCHEMA } from "./schema.js";

export interface ProviderResult {
  /** null when every model in the chain failed. The caller must NOT invent orders. */
  decision: Decision | null;
  telemetry: Telemetry;
}

export interface OrderProvider {
  decide(view: LocalView, general: GeneralConfig): Promise<ProviderResult>;
}

export interface RemoteProviderOptions {
  /** One key per endpoint actually used. A missing key skips that endpoint. */
  apiKeys: Partial<Record<ProviderName, string>>;
  /**
   * Overrides the per-provider ceiling from ENDPOINTS. Leave unset: the
   * defaults are set per provider precisely because Groq reserves the whole
   * allowance against its per-minute token budget and the others do not.
   */
  maxTokens?: number;
  /** Free-tier latency spans 3.7s to 213s; without a ceiling one squad freezes a battle. */
  timeoutMs?: number;
  /** Attempts per model before moving to the next link in the chain. */
  attemptsPerModel?: number;
  freeModelsOnly?: boolean;
  /**
   * Which ruleset the prompts and schema describe. v2 adds fog, remembered
   * sightings and bounded diplomacy to what a general is told.
   */
  ruleset?: "v1" | "v2";
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class RetryableError extends Error {
  /** Milliseconds the provider itself asked us to wait, when it said so. */
  constructor(message: string, readonly retryAfterMs: number | null = null) {
    super(message);
  }
}

/** Longest we will ever sit on a single 429 before giving the next model a go. */
const MAX_BACKOFF_MS = 75_000;

/**
 * How long we are willing to wait for a FALLBACK when another provider is still
 * untried. Chains span four providers precisely so a drained bucket costs a
 * hop, not a minute of idling.
 */
const HOP_INSTEAD_OF_WAITING_MS = 3_000;

/**
 * A general's OWN model gets the full patience budget, not the hop budget.
 *
 * Hopping instead of waiting was tuned for throughput, and it quietly wrecked
 * the tournament: a primary whose bucket was drained was never served, because
 * a fallback was always available. Three of four contenders played 0 of 48
 * turns on their own model, which makes a ranking meaningless — the whole point
 * of a clean rotation is that the contender actually played.
 *
 * So identity outranks speed for the primary, and speed outranks identity for
 * the fallbacks. Being served by somebody else's model is not a cheaper
 * result; it is a different measurement.
 */
const WAIT_FOR_OWN_MODEL_MS = MAX_BACKOFF_MS;

export class RemoteProvider implements OrderProvider {
  private readonly opts: Required<Omit<RemoteProviderOptions, "apiKeys">> & {
    apiKeys: Partial<Record<ProviderName, string>>;
  };

  constructor(options: RemoteProviderOptions) {
    this.opts = {
      apiKeys: options.apiKeys,
      maxTokens: options.maxTokens ?? 0, // 0 = use the per-provider default
      timeoutMs: options.timeoutMs ?? 60_000,
      attemptsPerModel: options.attemptsPerModel ?? 2,
      freeModelsOnly: options.freeModelsOnly ?? true,
      ruleset: options.ruleset ?? "v1",
      fetchImpl: options.fetchImpl ?? fetch,
      sleepImpl: options.sleepImpl ?? sleep,
    };
  }

  /** Last thing each provider told us about our allowance. */
  private readonly limits = new Map<ProviderName, RateLimit>();
  /**
   * Why the last `ask` came back empty, and which model answered when it did.
   *
   * A battle records this per turn; `ask` recorded nothing, so the first live
   * world reported twelve silent rulers and could not say whether they had been
   * rate-limited, refused, or never called at all. Silence with no reason is
   * indistinguishable from a bug.
   */
  private lastAskError: string | null = null;
  private lastAskModel: string | null = null;

  /** The model that answered the last successful `ask`, or null. */
  lastModel(): string | null {
    return this.lastAskModel;
  }

  /** Why the last `ask` returned null. Null when it succeeded. */
  lastError(): string | null {
    return this.lastAskError;
  }

  /** Provider-reported allowance, for callers that want to pace themselves. */
  rateLimit(provider: ProviderName): RateLimit | undefined {
    return this.limits.get(provider);
  }

  /**
   * Wait out a token bucket we already know is empty, rather than firing a
   * request that will certainly 429 and burn an attempt.
   */
  private async waitIfDrained(provider: ProviderName, needed: number, budgetMs: number): Promise<boolean> {
    const limit = this.limits.get(provider);
    if (!limit || limit.remainingTokens === null) return true;
    if (limit.remainingTokens >= needed) return true;

    const wait = limit.resetTokensMs ?? 0;
    if (wait > budgetMs) return false; // not worth it: somebody else can serve
    if (wait > 0) {
      await this.opts.sleepImpl(wait);
      this.limits.delete(provider); // the bucket has refilled; stop assuming
    }
    return true;
  }

  async decide(view: LocalView, general: GeneralConfig): Promise<ProviderResult> {
    const chain = [general.model, ...general.fallbacks];
    const started = Date.now();
    let attempts = 0;
    let lastError = "no model attempted";

    for (const [position, model] of chain.entries()) {
      // Is a model on some other provider still untried? If so, hopping beats
      // waiting; if not, patience is all we have left.
      const thisProvider = parseModelRef(model).provider;
      const hasAlternative = chain
        .slice(position + 1)
        .some((m) => parseModelRef(m).provider !== thisProvider && this.opts.apiKeys[parseModelRef(m).provider]);
      const isPrimary = position === 0;
      const waitBudget = isPrimary ? WAIT_FOR_OWN_MODEL_MS : hasAlternative ? HOP_INSTEAD_OF_WAITING_MS : MAX_BACKOFF_MS;

      if (this.opts.freeModelsOnly && !isFreeRef(model)) {
        // Budget ceiling comes from the launch GATE, so this is a hard refusal
        // rather than a warning: a paid model must never be reached by accident.
        lastError = `refused ${model}: budget is 0 EUR, only free models are allowed`;
        continue;
      }
      if (!this.opts.apiKeys[parseModelRef(model).provider]) {
        lastError = `skipped ${model}: no key for ${parseModelRef(model).provider}`;
        continue;
      }

      for (let attempt = 1; attempt <= this.opts.attemptsPerModel; attempt += 1) {
        attempts += 1;
        try {
          const ref = parseModelRef(model);
          if (!(await this.waitIfDrained(ref.provider, this.tokensFor(ref.provider), waitBudget))) {
            lastError = `${model}: token bucket drained, hopping to the next provider`;
            break;
          }
          const { decision, usage } = await this.call(model, view, general);
          return {
            decision,
            telemetry: {
              factionId: general.factionId,
              requestedModel: general.model,
              servedModel: model,
              fellBack: model !== general.model,
              // Recorded even on a SUCCESSFUL fallback. Without it the replay
              // showed a general quietly served by another model and no reason
              // anywhere, which is exactly what made the tournament's result
              // impossible to diagnose.
              error: model === general.model ? null : lastError,
              attempts,
              latencyMs: Date.now() - started,
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              costUsd: usage.cost ?? 0,
            },
          };
        } catch (err) {
          lastError = `${model}: ${(err as Error).message}`;
          if (!(err instanceof RetryableError)) break; // permanent for this model, try the next
          if (attempt < this.opts.attemptsPerModel) {
            // Wait as long as the provider asked, not a flat 500ms. These
            // limits reset on the minute; the old backoff was three orders of
            // magnitude too short and simply burned both attempts instantly.
            const asked = err.retryAfterMs ?? 500 * 2 ** (attempt - 1);
            if (asked > waitBudget) break; // hop rather than idle
            await this.opts.sleepImpl(Math.min(asked, MAX_BACKOFF_MS));
          }
        }
      }
    }

    return {
      decision: null,
      telemetry: {
        factionId: general.factionId,
        requestedModel: general.model,
        servedModel: null,
        fellBack: false,
        attempts,
        latencyMs: Date.now() - started,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        error: lastError,
      },
    };
  }

  /**
   * One-shot free-form request over the same fallback chain, used for the
   * army-buying step. Reuses the retry, backoff, budget guard and JSON
   * extraction rather than opening a second, less careful path to the network.
   */
  async ask(general: GeneralConfig, sys: string, usr: string, schema: unknown): Promise<string | null> {
    this.lastAskError = null;
    this.lastAskModel = null;
    const reasons: string[] = [];

    for (const model of [general.model, ...general.fallbacks]) {
      if (this.opts.freeModelsOnly && !isFreeRef(model)) {
        reasons.push(`${model}: paid`);
        continue;
      }
      const ref = parseModelRef(model);
      if (!this.opts.apiKeys[ref.provider]) {
        reasons.push(`${model}: no key`);
        continue;
      }
      if (!(await this.waitIfDrained(ref.provider, this.tokensFor(ref.provider), MAX_BACKOFF_MS))) {
        reasons.push(`${model}: budget drained`);
        continue;
      }

      for (let attempt = 1; attempt <= this.opts.attemptsPerModel; attempt += 1) {
        try {
          const res = await this.opts.fetchImpl(ENDPOINTS[ref.provider].url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.opts.apiKeys[ref.provider]}`,
              "Content-Type": "application/json",
              "X-Title": "ai-battle-simulator",
            },
            body: JSON.stringify({
              model: ref.model,
              messages: [
                { role: "system", content: supportsNativeSchema(model) ? sys : `${sys}\n\nReply with a single JSON object and nothing else.` },
                { role: "user", content: usr },
              ],
              max_tokens: this.tokensFor(ref.provider),
              temperature: 0.6,
              ...(supportsNativeSchema(model)
                ? { response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema } } }
                : {}),
            }),
            signal: AbortSignal.timeout(this.opts.timeoutMs),
          });
          const limit = readRateLimit(res.headers);
          this.limits.set(ref.provider, limit);
          if (res.status === 429 || res.status >= 500) {
            throw new RetryableError(`HTTP ${res.status}`, limit.resetTokensMs ?? limit.resetRequestsMs);
          }
          if (!res.ok) {
            reasons.push(`${model}: HTTP ${res.status}`);
            break;
          }

          const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const parsed = extractJson(payload.choices?.[0]?.message?.content ?? "");
          if (parsed !== null) {
            this.lastAskModel = model;
            return JSON.stringify(parsed);
          }
          throw new RetryableError("no JSON object found");
        } catch (err) {
          const why = err instanceof Error ? err.message : String(err);
          if (!(err instanceof RetryableError)) {
            reasons.push(`${model}: ${why}`);
            break;
          }
          if (attempt < this.opts.attemptsPerModel) {
            await this.opts.sleepImpl(Math.min(err.retryAfterMs ?? 500 * 2 ** (attempt - 1), MAX_BACKOFF_MS));
          } else {
            reasons.push(`${model}: ${why}`);
          }
        }
      }
    }
    this.lastAskError = reasons.join("; ") || "no model attempted";
    return null;
  }

  private tokensFor(provider: ProviderName): number {
    return this.opts.maxTokens || ENDPOINTS[provider].maxTokens;
  }

  private async call(model: string, view: LocalView, general: GeneralConfig) {
    // Only six of the sixteen free models enforce a schema server-side. The
    // others are asked for JSON in the prompt and validated here instead —
    // demanding native support is what collapsed the roster onto one model.
    const native = supportsNativeSchema(model);
    const v2 = this.opts.ruleset === "v2";
    const sys = v2 ? systemPromptV2() : systemPrompt();
    const usr = v2 ? userPromptV2(view) : userPrompt(view);
    const schema = v2 ? ORDER_JSON_SCHEMA_V2 : ORDER_JSON_SCHEMA;
    const ref = parseModelRef(model);
    const endpoint = ENDPOINTS[ref.provider];

    const res = await this.opts.fetchImpl(endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKeys[ref.provider]}`,
        "Content-Type": "application/json",
        "X-Title": "ai-battle-simulator",
      },
      body: JSON.stringify({
        model: ref.model,
        messages: [
          { role: "system", content: native ? sys : `${sys}\n\n${jsonModeInstruction(v2)}` },
          { role: "user", content: usr },
        ],
        // Per-provider, because Groq reserves whatever we ask for.
        max_tokens: this.tokensFor(ref.provider),
        temperature: 0.4,
        ...(native
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: "battle_orders", strict: true, schema },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs),
    });

    const limit = readRateLimit(res.headers);
    this.limits.set(ref.provider, limit);

    if (res.status === 429 || res.status >= 500) {
      // Rate limiting is the nominal regime on a free tier, not an incident —
      // and the provider usually tells us exactly how long to wait.
      throw new RetryableError(`HTTP ${res.status}`, limit.resetTokensMs ?? limit.resetRequestsMs);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = (await res.json()) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };
    const choice = payload.choices?.[0];

    if (choice?.finish_reason === "length") {
      // Truncated by the token budget, not a model that cannot follow a schema.
      // Retryable so the diagnosis does not drift toward "this model is broken".
      throw new RetryableError("truncated: finish_reason=length, raise ABS_MAX_TOKENS");
    }

    const parsed = extractJson(choice?.message?.content ?? "");
    if (parsed === null) throw new RetryableError("no JSON object found in the answer");

    const result = DecisionSchema.safeParse(parsed);
    if (!result.success) throw new RetryableError(`schema mismatch: ${result.error.issues[0]?.message ?? "unknown"}`);

    return {
      decision: {
        reasoning: result.data.reasoning.slice(0, MAX_REASONING_CHARS),
        orders: result.data.orders,
        diplomacy: result.data.diplomacy ?? null,
      },
      usage: payload.usage ?? {},
    };
  }
}
