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
}

export const ENDPOINTS: Record<ProviderName, Endpoint> = {
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", keyEnv: "OPENROUTER_API_KEY" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/chat/completions", keyEnv: "NVIDIA_API_KEY" },
};

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
