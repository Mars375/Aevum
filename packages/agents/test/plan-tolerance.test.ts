import { describe, it, expect } from "vitest";
import { requestCouncil } from "../src/council.js";
import { newSpectator, localCouncil } from "../../world/src/spectator.js";

/**
 * Measured on a five-seed remote series: one council in five was discarded
 * whole because `plan.targetTech` carried a value outside its enum, while the
 * orders in the same answer were legal. These tests fix the line between what
 * is forgiven and what is not.
 */
const respond =
  (payload: unknown) =>
  async (url: string | URL | Request): Promise<Response> => {
    if (String(url).endsWith("/models"))
      return new Response(
        JSON.stringify({
          data: [{ id: "test", pricing: { prompt: "0", completion: "0" } }],
        }),
      );
    return new Response(
      JSON.stringify({
        model: "test",
        choices: [{ message: { content: JSON.stringify(payload) } }],
      }),
    );
  };

const ask = (state: ReturnType<typeof newSpectator>, payload: unknown) =>
  requestCouncil(
    state,
    "amber",
    "remote",
    "nous:test",
    { NOUS_API_KEY: "test-secret" },
    respond(payload),
  );

describe("un plan malforme ne coute pas le conseil entier", () => {
  it("laisse tomber le plan, garde les ordres, et le dit", async () => {
    const state = newSpectator();
    const good = localCouncil(state, "amber");
    const answer = await ask(state, {
      ...good,
      plan: {
        kind: "research",
        targetTile: null,
        targetCity: null,
        targetTech: "une-technologie-qui-n-existe-pas",
        targetBuilding: null,
        rationale: "cible hors enumeration",
      },
    });

    expect(answer.source).toBe("remote");
    expect(answer.decision?.orders).toEqual(good.orders);
    /**
     * Absent, not null. `plan: null` CANCELS the standing plan — a decision the
     * ruler never took. Dropping the key leaves it exactly where it was.
     */
    expect(answer.decision && "plan" in answer.decision).toBe(false);
    // Recorded, not silent, and naming the schema location only.
    expect(answer.error).toContain("plan.targetTech");
  });

  it("refuse toujours un conseil dont un ordre est malforme", async () => {
    const state = newSpectator();
    const good = localCouncil(state, "amber");
    const answer = await ask(state, {
      ...good,
      orders: [{ unit: 42, action: "danser", target: -1 }],
    });

    // An order is what the engine must be able to trust: no tolerance there.
    expect(answer.source).toBe("unavailable");
    expect(answer.decision).toBeNull();
    expect(answer.error).toContain("orders");
  });

  it("n'invente rien quand la reponse est bonne", async () => {
    const state = newSpectator();
    const good = localCouncil(state, "amber");
    const answer = await ask(state, good);

    expect(answer.decision).toEqual(good);
    expect(answer.error).toBeNull();
  });
});
