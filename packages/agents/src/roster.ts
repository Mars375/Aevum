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
  // Banc apparié du 23 septembre, en mode natif : 20/20 tours consécutifs chacun.
  "kilo:dots-studio/dots-3-note-preview:free",
  "kilo:nex-agi/nex-n2.5-mini:free",
  // Le même dots par OpenRouter, mesuré le 24 septembre dans les mêmes conditions.
  "openrouter:dots-studio/dots-3-note-preview:free",
]);

export const supportsNativeSchema = (model: string) => NATIVE_SCHEMA_MODELS.has(model);

/**
 * Models that must be told not to reason, or they reason past any deadline.
 *
 * Measured on one council, same prompt, only this field changing:
 * `dots-3-note-preview` timed out past 45 s without it, and answered in 6 s
 * (398 tokens, valid) with `reasoning: { effort: "none" }`. The same lesson as
 * `longcat-2.0`, which reasoned to its 6000-token ceiling and answered nothing —
 * except that `longcat` ignores the field, so it cannot be listed here. Only
 * measured models: a provider that does not know the field may refuse the call.
 */
export const REASONING_OFF_MODELS = new Set([
  "kilo:dots-studio/dots-3-note-preview:free",
  "kilo:nex-agi/nex-n2.5-mini:free",
  // Le banc l'a mesuré par OpenRouter raisonnement bridé : le servir sans,
  // c'est servir un modèle qui n'a pas été mesuré.
  "openrouter:dots-studio/dots-3-note-preview:free",
]);

export const reasoningOff = (model: string) =>
  REASONING_OFF_MODELS.has(model) ? { reasoning: { effort: "none" } } : {};

/**
 * Four primaries, four vendors, and NVIDIA demoted to deep fallback.
 *
 * Three rules hold this roster together, each earned from a failure:
 *
 *  1. **No primary appears anywhere in another faction's chain.** A model going
 *     down must not turn one general into a copy of another — defect D1, which
 *     ruined the first reference battle.
 *  2. **Every chain reaches all four providers.** Four independent quotas per
 *     chain, because the 12-rotation tournament collapsed to 0% service when a
 *     single tier ran out.
 *  3. **A primary sits on a provider with headroom.** NVIDIA's credits are spent
 *     and it returns HTTP 429 with no reset header, so minimax-m3 played 0 of 45
 *     turns. It is now only ever a deep fallback: an outage there costs a hop,
 *     not a contender.
 *
 * verdant's primary is `nvidia/nemotron-3-super-120b-a12b:free` — a bare
 * OpenRouter id despite the NVIDIA name, so it draws on OpenRouter's daily
 * quota, never on the exhausted `nvidia:` build. It replaces
 * `google/gemma-4-26b-a4b-it:free`, whose free tier now answers HTTP 429;
 * Nemotron Super passed preflight 4/4 through askRuler with the production
 * parser, served by itself each time.
 *
 * Measured on a mid-battle v2 position:
 *   groq:groq/compound-mini          1.2-1.3s  2/2   (fallback, not primary)
 *   mistral:mistral-large-latest     2.2-2.4s  2/2
 *   google/gemma-4-26b-a4b-it:free  10.7-17.1s 2/2
 *   poolside/laguna-s-2.1:free       4.5s      2/2
 *   nvidia:minimaxai/minimax-m3      HTTP 429  0/2   <- demoted
 *   nvidia/nemotron-3-super          1/2             <- promoted: 4/4 with askRuler later
 */
export const DEFAULT_GENERALS: GeneralConfig[] = [
  {
    factionId: "crimson",
    displayName: "Crimson",
    model: "mistral:mistral-large-latest",
    fallbacks: ["groq:groq/compound-mini", "nvidia/nemotron-3.5-lightning:free", "nvidia:deepseek-ai/deepseek-v4-flash-0731"],
  },
  {
    factionId: "azure",
    displayName: "Azure",
    model: "groq:openai/gpt-oss-120b",
    fallbacks: ["mistral:mistral-medium-latest", "poolside/laguna-xs-2.1:free", "nvidia:meta/llama-3.3-70b-instruct"],
  },
  {
    factionId: "verdant",
    displayName: "Verdant",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    fallbacks: ["mistral:magistral-small-latest", "groq:openai/gpt-oss-20b", "nvidia:deepseek-ai/deepseek-v4-flash-0731"],
  },
  {
    factionId: "amber",
    displayName: "Amber",
    model: "poolside/laguna-s-2.1:free",
    fallbacks: ["mistral:ministral-8b-latest", "groq:groq/compound-mini", "nvidia:meta/llama-3.3-70b-instruct"],
  },
];
