import { describe, expect, it } from "vitest";
import { requestCouncil, councilObservation } from "../src/council.js";
import { newSpectator, localCouncil } from "../../world/src/spectator.js";
describe("council gateway", () => {
  it("keeps local decisions explicitly local and does not call the network", async () => {
    const answer = await requestCouncil(
      newSpectator(),
      "amber",
      "local",
      "",
      {},
      async () => {
        throw new Error("network forbidden");
      },
    );
    expect(answer.source).toBe("local");
    expect(answer.decision?.civ).toBe("amber");
  });
  it("does not expose rival objectives or orders to a ruler", () => {
    const state = newSpectator();
    state.objectives.azure = "private objective";
    expect(JSON.stringify(councilObservation(state, "amber"))).not.toContain(
      "private objective",
    );
    expect(
      councilObservation(state, "amber").units.every(
        (u) => u.owner === "amber",
      ),
    ).toBe(true);
  });
  it("fails closed when Nous pricing is missing", async () => {
    let calls = 0;
    const answer = await requestCouncil(
      newSpectator(),
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async () => {
        calls++;
        return new Response(JSON.stringify({ data: [{ id: "test" }] }), {
          status: 200,
        });
      },
    );
    expect(calls).toBe(1);
    expect(answer.source).toBe("unavailable");
    expect(answer.error).toContain("Gratuité");
    expect(JSON.stringify(answer)).not.toContain("test-secret");
  });
  it("validates a remote order response and records the actually served model", async () => {
    const state = newSpectator();
    const decision = localCouncil(state, "amber");
    let requested: Record<string, unknown> | undefined;
    const answer = await requestCouncil(
      state,
      "amber",
      "remote",
      "example/model:free",
      { OPENROUTER_API_KEY: "test-secret" },
      async (_url, init) => {
        requested = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            model: "example/model:free",
            choices: [{ message: { content: JSON.stringify(decision) } }],
          }),
          { status: 200 },
        );
      },
    );
    expect(answer.source).toBe("remote");
    expect(answer.decision).toEqual(decision);
    expect(answer.service?.servedModel).toBe("example/model:free");
    expect(requested?.model).toBe("example/model:free");
  });
  it("refuses a remote answer that commands another ruler", async () => {
    const state = newSpectator();
    const wrong = localCouncil(state, "azure");
    const answer = await requestCouncil(
      state,
      "amber",
      "remote",
      "example/model:free",
      { OPENROUTER_API_KEY: "test-secret" },
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(wrong) } }],
          }),
        ),
    );
    expect(answer.decision).toBeNull();
    expect(answer.source).toBe("unavailable");
  });
});

it("sends the explicit Nous order schema and disables optional reasoning for Longcat", async () => {
  const state = newSpectator();
  let sent: any;
  const answer = await requestCouncil(
    state,
    "amber",
    "remote",
    "nous:meituan/test:free",
    { NOUS_API_KEY: "test-secret" },
    async (url, init) => {
      if (String(url).endsWith("/models"))
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "meituan/test:free",
                supported_parameters: ["structured_outputs", "reasoning"],
                pricing: { prompt: "0", completion: "0" },
              },
            ],
          }),
        );
      sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          model: "meituan/test:free",
          choices: [
            {
              message: {
                content: JSON.stringify(localCouncil(state, "amber")),
              },
            },
          ],
        }),
      );
    },
  );
  expect(answer.source).toBe("remote");
  expect(
    sent.response_format.json_schema.schema.properties.orders,
  ).toBeDefined();
  expect(sent.reasoning).toEqual({ effort: "none" });
  expect(sent.messages[0].content).toContain("Only soldiers can defend");
});
it.each([null, "", " ", "0.1"])(
  "refuses an unverified Nous price %j",
  async (price) => {
    let calls = 0;
    const answer = await requestCouncil(
      newSpectator(),
      "amber",
      "remote",
      "nous:test",
      { NOUS_API_KEY: "test-secret" },
      async () => {
        calls++;
        return new Response(
          JSON.stringify({
            data: [{ id: "test", pricing: { prompt: price, completion: "0" } }],
          }),
        );
      },
    );
    expect(calls).toBe(1);
    expect(answer.source).toBe("unavailable");
    expect(answer.error).toContain("Gratuité");
  },
);
it("omits options not advertised by the Nous model catalogue", async () => {
  let sent: Record<string, unknown> = {};
  const state = newSpectator();
  const answer = await requestCouncil(
    state,
    "amber",
    "remote",
    "nous:model:free",
    { NOUS_API_KEY: "test-secret" },
    async (url, init) => {
      if (String(url).endsWith("/models"))
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "model:free",
                pricing: { prompt: "0", completion: "0" },
                supported_parameters: [],
              },
            ],
          }),
        );
      sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          model: "model:free",
          choices: [
            {
              message: {
                content: JSON.stringify(localCouncil(state, "amber")),
              },
            },
          ],
        }),
      );
    },
  );
  expect(answer.source).toBe("remote");
  expect(sent).not.toHaveProperty("response_format");
  expect(sent).not.toHaveProperty("reasoning");
});
