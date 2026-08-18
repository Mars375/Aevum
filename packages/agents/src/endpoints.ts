/**
 * Model references carry their provider.
 *
 * A bare id goes to OpenRouter (`google/gemma-4-26b-a4b-it:free`); a
 * `groq:` prefix goes to Groq (`groq:qwen/qwen3.6-27b`). Groq speaks the same
 * OpenAI chat-completions shape, so this is a routing concern rather than a
 * second provider implementation.
 */

export type ProviderName = "openrouter" | "groq" | "nvidia";

export interface Endpoint {
  url: string;
  /** Env var holding the key. Never inlined, never logged. */
  keyEnv: string;
  /**
   * Per-provider completion ceiling.
   *
   * Measured, not guessed: Groq **reserves** the full `max_tokens` against its
   * per-minute token budget whether the model uses it or not. One call with
   * max_tokens 6000 drops remaining-tokens from 7828 to 1755 against an 8000
   * TPM limit — meaning exactly one Groq call per minute. That single setting
   * caused twelve HTTP 429s in the first v2 battle.
   *
   * OpenRouter and NVIDIA do not reserve, and their reasoning models genuinely
   * need the headroom mid-battle, so they keep 6000.
   */
  maxTokens: number;
}

export const ENDPOINTS: Record<ProviderName, Endpoint> = {
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", keyEnv: "OPENROUTER_API_KEY", maxTokens: 6000 },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY", maxTokens: 2000 },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/chat/completions", keyEnv: "NVIDIA_API_KEY", maxTokens: 6000 },
};

/**
 * What a provider told us about our remaining allowance, parsed from response
 * headers. We used to ignore these entirely and back off a flat 500ms against
 * limits that reset on the minute — three orders of magnitude too short.
 */
export interface RateLimit {
  remainingRequests: number | null;
  remainingTokens: number | null;
  /** Milliseconds until the token bucket refills. */
  resetTokensMs: number | null;
  resetRequestsMs: number | null;
}

/** "1m26.4s", "577ms", "1.289s" — Groq's duration format. */
function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const plain = Number(raw);
  if (Number.isFinite(plain)) return plain * 1000; // Retry-After, in seconds
  let ms = 0;
  let matched = false;
  for (const [, value, unit] of raw.matchAll(/([\d.]+)(ms|s|m|h)/g)) {
    matched = true;
    const n = Number(value);
    ms += unit === "ms" ? n : unit === "s" ? n * 1000 : unit === "m" ? n * 60_000 : n * 3_600_000;
  }
  return matched ? ms : null;
}

export function readRateLimit(headers: Headers): RateLimit {
  const num = (k: string) => {
    const v = headers.get(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // OpenRouter exposes a plain daily counter; Groq splits requests and tokens.
  const resetEpoch = num("x-ratelimit-reset");
  return {
    remainingRequests: num("x-ratelimit-remaining-requests") ?? num("x-ratelimit-remaining"),
    remainingTokens: num("x-ratelimit-remaining-tokens"),
    resetTokensMs: parseDuration(headers.get("x-ratelimit-reset-tokens")),
    resetRequestsMs:
      parseDuration(headers.get("x-ratelimit-reset-requests")) ??
      parseDuration(headers.get("retry-after")) ??
      // OpenRouter's reset is an absolute epoch in milliseconds.
      (resetEpoch && resetEpoch > 1e12 ? resetEpoch - Date.now() : null),
  };
}

export interface ModelRef {
  provider: ProviderName;
  /** Id as the endpoint expects it, prefix stripped. */
  model: string;
}

export function parseModelRef(ref: string): ModelRef {
  if (ref.startsWith("groq:")) return { provider: "groq", model: ref.slice(5) };
  if (ref.startsWith("nvidia:")) return { provider: "nvidia", model: ref.slice(7) };
  return { provider: "openrouter", model: ref };
}

/**
 * Whether a reference is free under the 0 EUR ceiling.
 *
 * OpenRouter marks free models with a `:free` suffix, so that is checkable.
 * **Groq and NVIDIA cannot be checked this way**: neither has a per-model
 * free/paid marker, because on both the free tier is a property of the
 * *account*, not of the model. An account with no payment method is
 * rate-limited or credit-limited rather than billed, and that — not this
 * function — is where the 0 EUR guarantee actually comes from. Stated plainly
 * rather than implied.
 */
export function isFreeRef(ref: string): boolean {
  const { provider, model } = parseModelRef(ref);
  return provider === "openrouter" ? model.endsWith(":free") : true;
}
