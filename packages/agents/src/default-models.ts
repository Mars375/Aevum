import type { FactionId } from "@abs/contracts";

/** Same tested model, four independent rulers and observations. No silent fallback. */
export function defaultCouncilModels(
  env: NodeJS.ProcessEnv = process.env,
): Record<FactionId, string> {
  const configured = env.NOUS_MODEL?.trim().replace(/^nous:/, "");
  const model = `nous:${configured || "meituan/longcat-2.0:free"}`;
  return { amber: model, azure: model, crimson: model, verdant: model };
}
