import { describe, expect, it } from "vitest";
import { councilObservation, requestCouncil } from "../src/council.js";
import { councilOptions } from "../src/council-options.js";
import {
  MODERN_COUNCIL_JSON_SCHEMA,
  STRATEGIC_COUNCIL_JSON_SCHEMA,
} from "../src/council-schema.js";
import { newSpectator, localCouncil } from "../../world/src/spectator.js";

describe("modernization council contract", () => {
  it("provides the full response contract when Nous does not enforce structured output", async () => {
    const state = newSpectator(42, "spectator-6");
    let sent: { messages: { role: string; content: string }[]; response_format?: unknown } | undefined;
    const answer = await requestCouncil(state, "amber", "remote", "nous:test", { NOUS_API_KEY: "test-secret" }, async (url, init) => {
      if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "test", pricing: { prompt: "0", completion: "0" }, supported_parameters: [] }] });
      sent = JSON.parse(String(init?.body));
      return Response.json({ model: "test", choices: [{ message: { content: JSON.stringify(localCouncil(state, "amber")) } }] });
    });
    expect(answer.source).toBe("remote");
    expect(sent?.response_format).toBeUndefined();
    expect(JSON.parse(sent!.messages.find(m => m.role === "user")!.content).responseContract).toEqual(MODERN_COUNCIL_JSON_SCHEMA);
    expect(sent!.messages.find(m => m.role === "system")!.content).toContain("Modernization is a TOP-LEVEL field");
  });
  it("exposes costs and lock reasons without disclosing rival programs", () => {
    const state = newSpectator(42, "spectator-6");
    state.modernization!.azure!.active = {
      project: "orbital_network",
      remaining: 7,
      startedAt: 0,
    };
    const observation = councilObservation(state, "amber");
    expect(observation.options.modernization).toHaveLength(6);
    expect(
      observation.options.modernization!.every(
        (p) => !p.available && !!p.unavailableReason,
      ),
    ).toBe(true);
    expect(observation.options.modernizationState).toEqual({
      completed: [],
      active: null,
    });
    expect(observation.ageProgress?.next).toBe("classical");
    expect(JSON.stringify(observation)).not.toContain('"remaining":7');
  });

  it("makes a funded eligible program available and chosen by the local ruler", () => {
    const state = newSpectator(42, "spectator-6");
    state.ages!.amber!.current = "medieval";
    const civ = state.world.civs[0]!;
    civ.advances.push("scholarship");
    civ.science = 1000;
    civ.stock = { food: 10000, ore: 10000, timber: 10000, wealth: 10000 };
    state.world
      .simulation!.cities.find((c) => c.owner === "amber")!
      .buildings.push("academy");
    expect(
      councilOptions(state, "amber").modernization!.find(
        (p) => p.project === "mechanization",
      )!.available,
    ).toBe(true);
    expect(localCouncil(state, "amber").modernization).toBe("mechanization");
  });

  it("keeps archived provider schemas and age horizon unchanged", () => {
    expect(STRATEGIC_COUNCIL_JSON_SCHEMA.properties).not.toHaveProperty(
      "modernization",
    );
    expect(MODERN_COUNCIL_JSON_SCHEMA.required).toContain("modernization");
    const old = newSpectator(42, "spectator-5");
    old.ages!.amber!.current = "medieval";
    expect(councilObservation(old, "amber").ageProgress?.next).toBeNull();
    expect(councilOptions(old, "amber")).not.toHaveProperty("modernization");
  });
});
