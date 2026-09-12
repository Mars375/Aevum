import { describe, it, expect } from "vitest";
import { requestValidatedCouncil } from "../src/council-review.js";
import { newSpectator, localCouncil } from "../../world/src/spectator.js";

describe("bounded council correction", () => {
  it("lets the same model repair illegal worker defense without changing the input world", async () => {
    const state = newSpectator(),
      original = structuredClone(state),
      good = localCouncil(state, "amber");
    const worker = state.world.simulation!.units.find(
      (u) => u.owner === "amber" && u.role === "farmer",
    )!;
    const bad = {
      ...good,
      orders: [
        {
          unit: worker.id,
          action: "defend",
          target: worker.position,
          reason: "invalid",
        },
      ],
    };
    let calls = 0;
    const prompts: any[] = [];
    const result = await requestValidatedCouncil(
      state,
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async (url, init) => {
        if (String(url).endsWith("/models"))
          return new Response(
            JSON.stringify({
              data: [{ id: "test", pricing: { prompt: "0", completion: "0" } }],
            }),
          );
        prompts.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            model: "test",
            choices: [
              {
                message: {
                  content: JSON.stringify(calls++ === 0 ? bad : good),
                },
              },
            ],
          }),
        );
      },
    );
    expect(calls).toBe(2);
    expect(result.decision).toEqual(good);
    expect(result.review?.corrected).toBe(true);
    expect(
      JSON.parse(prompts[1].messages[1].content).correction.issues.join(),
    ).toContain("Only military");
    expect(state).toEqual(original);
  });
  it("does not retry quota failures", async () => {
    let calls = 0;
    const answer = await requestValidatedCouncil(
      newSpectator(),
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async (url) => {
        calls++;
        return String(url).endsWith("/models")
          ? new Response(
              JSON.stringify({
                data: [
                  { id: "test", pricing: { prompt: "0", completion: "0" } },
                ],
              }),
            )
          : new Response("{}", { status: 429 });
      },
    );
    expect(calls).toBe(2);
    expect(answer.review).toBeUndefined();
    expect(answer.source).toBe("unavailable");
  });
});
