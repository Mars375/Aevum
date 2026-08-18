import { DecisionSchema, MAX_REASONING_CHARS, type Decision, type GeneralConfig, type LocalView, type Telemetry } from "@abs/contracts";
import { systemPrompt, userPrompt } from "./prompt.js";
import { ORDER_JSON_SCHEMA } from "./schema.js";

export interface ProviderResult {
  /** null when every model in the chain failed. The caller must NOT invent orders. */
  decision: Decision | null;
  telemetry: Telemetry;
}

export interface OrderProvider {
  decide(view: LocalView, general: GeneralConfig): Promise<ProviderResult>;
}

export interface OpenRouterOptions {
  apiKey: string;
  /**
   * Must cover reasoning tokens, which are billed against the completion budget
   * before the model emits its first brace. 800 truncates most free models and
   * 3000 clears a turn-1 prompt — but 3000 still truncated mid-battle in the
   * reference run, where the position is richer and the reasoning longer, so
   * the default is 6000. See docs/reports/qa-audit.md, defect D3.
   */
  maxTokens?: number;
  /** Free-tier latency spans 3.7s to 213s; without a ceiling one squad freezes a battle. */
  timeoutMs?: number;
  /** Attempts per model before moving to the next link in the chain. */
  attemptsPerModel?: number;
  freeModelsOnly?: boolean;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  baseUrl?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class RetryableError extends Error {}

export class OpenRouterProvider implements OrderProvider {
  private readonly opts: Required<Omit<OpenRouterOptions, "apiKey">> & { apiKey: string };

  constructor(options: OpenRouterOptions) {
    this.opts = {
      apiKey: options.apiKey,
      maxTokens: options.maxTokens ?? 6000,
      timeoutMs: options.timeoutMs ?? 60_000,
      attemptsPerModel: options.attemptsPerModel ?? 2,
      freeModelsOnly: options.freeModelsOnly ?? true,
      fetchImpl: options.fetchImpl ?? fetch,
      sleepImpl: options.sleepImpl ?? sleep,
      baseUrl: options.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions",
    };
  }

  async decide(view: LocalView, general: GeneralConfig): Promise<ProviderResult> {
    const chain = [general.model, ...general.fallbacks];
    const started = Date.now();
    let attempts = 0;
    let lastError = "no model attempted";

    for (const model of chain) {
      if (this.opts.freeModelsOnly && !model.endsWith(":free")) {
        // Budget ceiling comes from the launch GATE, so this is a hard refusal
        // rather than a warning: a paid model must never be reached by accident.
        lastError = `refused ${model}: budget is 0 EUR, only ":free" models are allowed`;
        continue;
      }

      for (let attempt = 1; attempt <= this.opts.attemptsPerModel; attempt += 1) {
        attempts += 1;
        try {
          const { decision, usage } = await this.call(model, view, general);
          return {
            decision,
            telemetry: {
              factionId: general.factionId,
              requestedModel: general.model,
              servedModel: model,
              fellBack: model !== general.model,
              attempts,
              latencyMs: Date.now() - started,
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              costUsd: usage.cost ?? 0,
              error: null,
            },
          };
        } catch (err) {
          lastError = `${model}: ${(err as Error).message}`;
          if (!(err instanceof RetryableError)) break; // permanent for this model, try the next
          if (attempt < this.opts.attemptsPerModel) {
            await this.opts.sleepImpl(500 * 2 ** (attempt - 1)); // bounded exponential backoff
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

  private async call(model: string, view: LocalView, general: GeneralConfig) {
    const res = await this.opts.fetchImpl(this.opts.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "ai-battle-simulator",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(view) },
        ],
        max_tokens: this.opts.maxTokens,
        temperature: 0.4,
        response_format: {
          type: "json_schema",
          json_schema: { name: "battle_orders", strict: true, schema: ORDER_JSON_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs),
    });

    if (res.status === 429 || res.status >= 500) {
      // Rate limiting is the nominal regime on the free tier, not an incident.
      throw new RetryableError(`HTTP ${res.status}`);
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(choice?.message?.content ?? "");
    } catch {
      throw new RetryableError("response was not valid JSON");
    }

    const result = DecisionSchema.safeParse(parsed);
    if (!result.success) throw new RetryableError(`schema mismatch: ${result.error.issues[0]?.message ?? "unknown"}`);

    return {
      decision: {
        reasoning: result.data.reasoning.slice(0, MAX_REASONING_CHARS),
        orders: result.data.orders,
      },
      usage: payload.usage ?? {},
    };
  }
}
