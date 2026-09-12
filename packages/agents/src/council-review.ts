import type { GeneralConfig } from "@abs/contracts";
import type { CouncilAnswer } from "../../world/src/campaign.js";
import {
  resolveCouncil,
  type SpectatorState,
} from "../../world/src/spectator.js";
import { requestCouncil } from "./council.js";

/** Preview only public legality, never another ruler's unsubmitted decision. */
function issuesFor(state: SpectatorState, answer: CouncilAnswer): string[] {
  if (!answer.decision) return answer.error ? [answer.error] : [];
  return resolveCouncil(state, [answer.decision])
    .rejected.filter((issue) => issue.civ === answer.civ)
    .map((issue) => `${issue.unit ?? "Conseil"}: ${issue.detail}`);
}

/** One bounded correction by the same model; the engine remains authoritative. */
export async function requestValidatedCouncil(
  state: SpectatorState,
  civ: GeneralConfig["factionId"],
  mode: "local" | "remote",
  model: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<CouncilAnswer> {
  const first = await requestCouncil(state, civ, mode, model, env, fetchImpl);
  if (mode === "local") return first;
  const issues = issuesFor(state, first);
  const repairable =
    first.decision || /JSON|schéma|Identité/.test(first.error ?? "");
  if (!issues.length || !repairable) return first;
  const second = await requestCouncil(state, civ, mode, model, env, fetchImpl, {
    previousDecision: first.decision,
    issues: issues.slice(0, 128),
  });
  const secondIssues = issuesFor(state, second);
  // A failed correction must not erase an already usable proposal.
  const useSecond =
    !!second.decision &&
    (!first.decision || secondIssues.length <= issues.length);
  const chosen = useSecond ? second : first;
  return {
    ...chosen,
    review: {
      attempts: 2,
      issues: issues.slice(0, 128),
      corrected: useSecond && secondIssues.length === 0,
      secondError: second.error,
    },
  };
}
