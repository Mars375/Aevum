import type { FactionId } from "@abs/contracts";

/** Same tested model, four independent rulers and observations. No silent fallback. */
export function defaultCouncilModels(
  env: NodeJS.ProcessEnv = process.env,
): Record<FactionId, string> {
  // AEVUM_COUNCIL_MODEL : une référence complète, chez n'importe quel
  // fournisseur (`kilo:…`, `nous:…`). NOUS_MODEL reste lu, pour Nous seul.
  const full = env.AEVUM_COUNCIL_MODEL?.trim();
  const configured = env.NOUS_MODEL?.trim().replace(/^nous:/, "");
  const model = full || `nous:${configured || "meituan/longcat-2.0:free"}`;
  return { amber: model, azure: model, crimson: model, verdant: model };
}
