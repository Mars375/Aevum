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
 * Four primaries, four vendors, four providers — and every chain reaches all
 * four providers.
 *
 * Two rules hold this roster together, both earned from measurement:
 *
 *  1. **No faction's first fallback is another faction's primary.** A model
 *     going down cannot turn one general into a copy of another — that is what
 *     ruined the first reference battle (QA defect D1).
 *  2. **Every chain spans all four providers.** OpenRouter, Groq, NVIDIA and
 *     Mistral rate-limit independently, so no single exhausted quota can strand
 *     a general. The 12-rotation tournament collapsed to 0% service on a single
 *     tier; this is the structural answer.
 *
 * Measured on a mid-battle position:
 *   mistral:mistral-large-latest        2.2-2.4s   2/2
 *   mistral:mistral-medium-latest       0.8-0.9s   2/2
 *   mistral:magistral-small-latest      1.1-1.2s   2/2
 *   mistral:ministral-8b-latest         1.2-1.3s   2/2
 *   groq:openai/gpt-oss-120b            1.6s       won 3 of 4 tournament rotations
 *   groq:groq/compound-mini             0.4-1.5s
 *   nvidia:minimaxai/minimax-m3         1.3-1.4s
 *   nvidia:meta/llama-3.3-70b-instruct  27-34s
 *   poolside/laguna-s-2.1:free          4.5s
 *   google/gemma-4-26b-a4b-it:free      4-8s
 *
 * Excluded on repeated measurement, not on capability flags:
 *   google/gemma-4-31b-it            HTTP 429 on 3/3   z-ai/glm-5.2      HTTP 429 on 3/3
 *   cohere/north-mini-code           timeout on 3/3    liquid/lfm-2.5    207-213s per order
 *   nvidia:mistralai/mistral-large-2 HTTP 404          nvidia:moonshotai/kimi-k2.6  HTTP 404
 */
export const DEFAULT_GENERALS: GeneralConfig[] = [
  {
    factionId: "crimson",
    displayName: "Crimson",
    model: "mistral:mistral-large-latest",
    fallbacks: ["groq:groq/compound-mini", "nvidia:deepseek-ai/deepseek-v4-flash-0731", "google/gemma-4-26b-a4b-it:free"],
  },
  {
    factionId: "azure",
    displayName: "Azure",
    model: "groq:openai/gpt-oss-120b",
    fallbacks: ["mistral:mistral-medium-latest", "nvidia:meta/llama-3.3-70b-instruct", "nvidia/nemotron-3-super-120b-a12b:free"],
  },
  {
    factionId: "verdant",
    displayName: "Verdant",
    model: "nvidia:minimaxai/minimax-m3",
    fallbacks: ["mistral:magistral-small-latest", "groq:openai/gpt-oss-20b", "poolside/laguna-xs-2.1:free"],
  },
  {
    factionId: "amber",
    displayName: "Amber",
    model: "poolside/laguna-s-2.1:free",
    fallbacks: ["mistral:ministral-8b-latest", "groq:groq/compound-mini", "nvidia:deepseek-ai/deepseek-v4-flash-0731"],
  },
];
