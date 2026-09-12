import { describe, expect, it } from "vitest";
import { councilObservation, requestCouncil } from "../src/council.js";
import { COUNCIL_JSON_SCHEMA, STRATEGIC_COUNCIL_JSON_SCHEMA } from "../src/council-schema.js";
import { newSpectator, localCouncil } from "../../world/src/spectator.js";

describe("strategic council contract", () => {
  it("exposes only the ruler's persistent plan", () => {
    const state = newSpectator(42, "spectator-3");
    const plan = { kind: "research" as const, targetTile: null, targetCity: null,
      targetTech: "irrigation" as const, targetBuilding: null, rationale: "private azure strategy",
      status: "active" as const, progress: 0, stagnation: 0, startedAt: 0, updatedAt: 0, detail: "secret" };
    state.plans = { azure: plan };
    expect(councilObservation(state, "azure").plan).toEqual(plan);
    expect(JSON.stringify(councilObservation(state, "amber"))).not.toContain("private azure strategy");
  });

  it("uses the versioned strict schema and sends measured plan context", async () => {
    const state = newSpectator(42, "spectator-3");
    let sent: any;
    const answer = await requestCouncil(state, "amber", "remote", "nous:test", { NOUS_API_KEY: "fake" },
      async (url, init) => {
        if (String(url).endsWith("/models")) return new Response(JSON.stringify({ data: [{
          id: "test", pricing: { prompt: "0", completion: "0" }, supported_parameters: ["structured_outputs"],
        }] }));
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(localCouncil(state, "amber")) } }] }));
      });
    expect(answer.source).toBe("remote");
    expect(sent.response_format.json_schema.schema).toEqual(STRATEGIC_COUNCIL_JSON_SCHEMA);
    expect(sent.messages[0].content).toContain("does not execute orders");
    expect(JSON.parse(sent.messages[1].content).rules).toBe("spectator-3");
    expect(COUNCIL_JSON_SCHEMA.required).not.toContain("plan");
    expect(STRATEGIC_COUNCIL_JSON_SCHEMA.required).toContain("plan");
  });
});
