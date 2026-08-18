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
 * Four distinct primaries, four model families, spread across two providers.
 *
 * Two rules hold this roster together, both earned from the first reference
 * battle where a single model decided 62.5% of the game and one general never
 * once played its own (QA defect D1):
 *
 *  1. **No faction's first fallback is another faction's primary.** A model
 *     going down cannot turn one general into a copy of another.
 *  2. **Every chain spans both providers.** OpenRouter and Groq rate-limit
 *     independently, so one provider throttling completely still leaves every
 *     general a path to a model. This is the property that makes a battle
 *     finish on a free tier.
 *
 * Groq is 10-40x faster (0.4-4.9s against 4.5-60s) but rate-limits hard per
 * minute; OpenRouter is slower but steadier. Mixing them plays each to its
 * strength rather than betting the battle on either.
 *
 * Excluded on repeated measurement, not on capability flags:
 *   google/gemma-4-31b-it     HTTP 429 on 3/3          z-ai/glm-5.2       HTTP 429 on 3/3
 *   cohere/north-mini-code    60s timeout on 3/3       liquid/lfm-2.5     207-213s per order
 *   groq:qwen/qwen3.6-27b     HTTP 403, access-gated   dots-3-note        truncates every time
 */
export const DEFAULT_GENERALS: GeneralConfig[] = [
  {
    factionId: "crimson",
    displayName: "Crimson",
    model: "groq:openai/gpt-oss-120b", // Groq, 1.6s
    fallbacks: ["google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3.5-lightning:free"],
  },
  {
    factionId: "azure",
    displayName: "Azure",
    // Was nemotron-3-ultra-550b, the largest free model — and the slowest at
    // 47.3s, cut by the 60s timeout often enough that azure was served its own
    // model only 5 times out of 12. A contender that only plays half the time
    // cannot be ranked, so the flagship moves down the chain and a fast,
    // reliable model of the same family takes the primary slot.
    model: "nvidia/nemotron-3-super-120b-a12b:free", // OpenRouter, native, 13.2s
    fallbacks: ["groq:groq/compound", "nvidia/nemotron-3-ultra-550b-a55b:free"],
  },
  {
    factionId: "verdant",
    displayName: "Verdant",
    model: "groq:groq/compound-mini", // Groq, 0.4-1.5s
    fallbacks: ["poolside/laguna-xs-2.1:free", "nvidia/nemotron-3-nano-30b-a3b:free"],
  },
  {
    factionId: "amber",
    displayName: "Amber",
    model: "poolside/laguna-s-2.1:free", // OpenRouter, 4.5s
    fallbacks: ["groq:openai/gpt-oss-20b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
  },
];
