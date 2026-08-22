import { describe, expect, it } from "vitest";
import { createRequestGuard } from "../src/request-guard";

describe("world request guard", () => {
  it("allows only the latest request to replace world state", () => {
    const guard = createRequestGuard();
    const requestA = guard.begin();
    const requestB = guard.begin();
    const state = { journal: "", worldError: "", learningCurves: "" };
    const replace = (request: number, value: string) => {
      if (!guard.isCurrent(request)) return;
      state.journal = value;
      state.worldError = value;
      state.learningCurves = value;
    };

    replace(requestB, "B");
    replace(requestA, "A");

    expect(state).toEqual({ journal: "B", worldError: "B", learningCurves: "B" });
  });
});
