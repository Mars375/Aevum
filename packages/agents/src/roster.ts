import type { GeneralConfig } from "@abs/contracts";

/**
 * Models measured to honour `response_format: json_schema` reliably.
 *
 * Deliberately short. Native enforcement looks like the safe default and is
 * not: `openai/gpt-oss-20b:free` fails 0/4 with it (schema mismatch, then
 * timeouts) and succeeds 2/2 without it, on the same prompt. Only models that
 * scored 2/2 in native mode stay here; everything else uses prompt mode, which
 * is both broader and, on a free tier, more reliable.
 */
export const NATIVE_SCHEMA_MODELS = new Set([
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
]);

export const supportsNativeSchema = (model: string) => NATIVE_SCHEMA_MODELS.has(model);

/**
 * Four distinct primaries, four vendor families, three providers.
 *
 * Two rules hold this roster together, both earned from measurement:
 *
 *  1. **No faction's first fallback is another faction's primary.** A model
 *     going down cannot turn one general into a copy of another — that is what
 *     ruined the first reference battle (QA defect D1).
 *  2. **Every chain spans all three providers.** OpenRouter, Groq and NVIDIA
 *     rate-limit independently, so no single exhausted quota can strand a
 *     general. This is the direct answer to the 12-rotation tournament, which
 *     collapsed to 0% service after roughly 350 calls on one tier.
 *
 * Measured latencies, on a mid-battle position:
 *   groq:openai/gpt-oss-120b            1.6s   won 3 of 4 tournament rotations
 *   nvidia:minimaxai/minimax-m3         1.3s
 *   nvidia:meta/llama-3.3-70b-instruct  27-34s
 *   poolside/laguna-s-2.1:free          4.5s
 *   nvidia:deepseek-ai/deepseek-v4      20-38s
 *   groq:groq/compound-mini             0.4s
 *   google/gemma-4-26b-a4b-it:free      4-8s
 *
 * Excluded on repeated measurement, not on capability flags:
 *   google/gemma-4-31b-it            HTTP 429 on 3/3   z-ai/glm-5.2      HTTP 429 on 3/3
 *   cohere/north-mini-code           timeout on 3/3    liquid/lfm-2.5    207-213s per order
 *   nvidia:mistralai/mistral-large-2 HTTP 404          nvidia:moonshotai/kimi-k2.6  HTTP 404
 *   qwen/qwen3.6-27b                 403 / 404 on both providers
 */
export const DEFAULT_GENERALS: GeneralConfig[] = [
  {
    factionId: "crimson",
    displayName: "Crimson",
    model: "groq:openai/gpt-oss-120b",
    fallbacks: ["nvidia:deepseek-ai/deepseek-v4-flash-0731", "google/gemma-4-26b-a4b-it:free"],
  },
  {
    factionId: "azure",
    displayName: "Azure",
    model: "nvidia:minimaxai/minimax-m3",
    fallbacks: ["google/gemma-4-26b-a4b-it:free", "groq:groq/compound-mini"],
  },
  {
    factionId: "verdant",
    displayName: "Verdant",
    model: "nvidia:meta/llama-3.3-70b-instruct",
    fallbacks: ["groq:groq/compound-mini", "nvidia/nemotron-3-super-120b-a12b:free"],
  },
  {
    factionId: "amber",
    displayName: "Amber",
    model: "poolside/laguna-s-2.1:free",
    fallbacks: ["nvidia:deepseek-ai/deepseek-v4-flash-0731", "groq:openai/gpt-oss-20b"],
  },
];
