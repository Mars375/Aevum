import type { GeneralConfig } from "@abs/contracts";

/**
 * One distinct preferred model per faction — model diversity is the point of
 * the exercise — each falling back onto the two models that scored 2/2 in the
 * provider probe. See docs/research/providers.md for the measurements.
 *
 * Models excluded on evidence: dots-3-note-preview (always truncates),
 * gemma-4-31b-it (429 on every attempt), lfm-2.5-2.6b (207-213s per order).
 */
const PROVEN_A = "google/gemma-4-26b-a4b-it:free";
const PROVEN_B = "nvidia/nemotron-3-super-120b-a12b:free";

export const DEFAULT_GENERALS: GeneralConfig[] = [
  { factionId: "crimson", displayName: "Crimson", model: PROVEN_A, fallbacks: [PROVEN_B] },
  { factionId: "azure", displayName: "Azure", model: PROVEN_B, fallbacks: [PROVEN_A] },
  { factionId: "verdant", displayName: "Verdant", model: "openai/gpt-oss-20b:free", fallbacks: [PROVEN_A, PROVEN_B] },
  { factionId: "amber", displayName: "Amber", model: "nvidia/nemotron-nano-9b-v2:free", fallbacks: [PROVEN_B, PROVEN_A] },
];
