import { writeFileSync } from "node:fs";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
} from "../packages/world/src/spectator.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

// Opt-in real provider validation at the first eligible modernization turn.
if (!process.argv.includes("--remote"))
  throw new Error("Use --remote to authorize this probe's provider call");
loadWindowsNousEnvironment();
let state = newSpectator(42, "spectator-6");
for (let i = 0; i < 1000; i++) {
  const civ = activeCiv(state)!;
  const local = localCouncil(state, civ);
  if (local.modernization) {
    const model = defaultCouncilModels()[civ]!;
    const answer = await requestValidatedCouncil(state, civ, "remote", model);
    const result = answer.decision
      ? resolveCouncil(state, [answer.decision])
      : null;
    const evidence = {
      rules: state.rules,
      civ,
      turn: state.world.tick,
      age: state.ages![civ]!.current,
      model,
      source: answer.source,
      service: answer.service,
      chosenProgram: answer.decision?.modernization ?? null,
      objective: answer.decision?.objective ?? null,
      review: answer.review ?? null,
      error: answer.error,
      rejected: result?.rejected ?? null,
      valid: !!result && !result.rejected.length && answer.source === "remote",
    };
    writeFileSync(
      "docs/future-council-verification.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.valid) process.exitCode = 1;
    break;
  }
  state = resolveCouncil(state, [local]).state;
  if (i === 999) throw new Error("No eligible modernization state reached");
}
