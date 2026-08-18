/**
 * Model references carry their provider.
 *
 * A bare id goes to OpenRouter (`google/gemma-4-26b-a4b-it:free`); a
 * `groq:` prefix goes to Groq (`groq:qwen/qwen3.6-27b`). Groq speaks the same
 * OpenAI chat-completions shape, so this is a routing concern rather than a
 * second provider implementation.
 */

export type ProviderName = "openrouter" | "groq";

export interface Endpoint {
  url: string;
  /** Env var holding the key. Never inlined, never logged. */
  keyEnv: string;
}

export const ENDPOINTS: Record<ProviderName, Endpoint> = {
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", keyEnv: "OPENROUTER_API_KEY" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
};

export interface ModelRef {
  provider: ProviderName;
  /** Id as the endpoint expects it, prefix stripped. */
  model: string;
}

export function parseModelRef(ref: string): ModelRef {
  if (ref.startsWith("groq:")) return { provider: "groq", model: ref.slice(5) };
  return { provider: "openrouter", model: ref };
}

/**
 * Whether a reference is free under the 0 EUR ceiling.
 *
 * OpenRouter marks free models with a `:free` suffix, so that is checkable.
 * **Groq cannot be checked this way**: its models have no free/paid marker
 * because the free tier is a property of the *account*, not of the model — an
 * account with no payment method is rate-limited rather than billed. The
 * guarantee there comes from the account having no card on file, which this
 * code cannot verify. Stated plainly rather than implied.
 */
export function isFreeRef(ref: string): boolean {
  const { provider, model } = parseModelRef(ref);
  return provider === "groq" ? true : model.endsWith(":free");
}
