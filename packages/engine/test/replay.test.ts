import { describe, expect, it } from "vitest";
import { FACTION_IDS, GRID_SIZE, ReplaySchema } from "@abs/contracts";
import { createInitialState, resolveTurn } from "@abs/engine";
import { DEFAULT_GENERALS, ScriptedProvider, chargeNearest, runBattle } from "@abs/agents";

const CONFIG = { rulesetVersion: "v1" as const, seed: 7, maxTurns: 12, gridSize: GRID_SIZE, generals: DEFAULT_GENERALS };

const play = () =>
  runBattle({
    config: CONFIG,
    provider: new ScriptedProvider(chargeNearest),
    battleId: "roundtrip",
    now: () => new Date("2026-08-17T00:00:00.000Z"),
  });

describe("replay round-trip", () => {
  it("survives JSON serialisation unchanged", async () => {
    const replay = await play();
    const revived = JSON.parse(JSON.stringify(replay));
    expect(ReplaySchema.parse(revived)).toEqual(replay);
  });

  it("validates against its own schema", async () => {
    expect(ReplaySchema.safeParse(await play()).success).toBe(true);
  });

  /**
   * The audit guarantee: feeding the recorded orders back through the engine
   * must reproduce the recorded states exactly. If this holds, a replay can be
   * verified without calling a single model again.
   */
  it("reproduces every recorded state from the recorded orders alone", async () => {
    const replay = await play();
    const roster = replay.initialState.squads.map((s) => s.id);

    let state = replay.initialState;
    for (const turn of replay.turns) {
      const factionOrders = turn.decisions.map((d) => ({ factionId: d.factionId, orders: d.orders }));
      const result = resolveTurn(state, factionOrders, roster, replay.manifest.config.gridSize);
      expect(result.state, `turn ${turn.turn}`).toEqual(turn.stateAfter);
      state = result.state;
    }
    expect(state.turn).toBe(replay.outcome.finalTurn);
  });

  it("carries the three version fields a reader needs", async () => {
    const { manifest } = await play();
    expect(manifest).toMatchObject({ replayVersion: "1", rulesetVersion: "v1" });
    expect(manifest.contractsVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("leaks no secret into the serialised replay", async () => {
    const serialised = JSON.stringify(await play());
    expect(serialised).not.toMatch(/sk-or-|OPENROUTER_API_KEY|Bearer |\/home\//);
  });

  it("rejects a replay whose ruleset version is unknown", () => {
    const bad = { manifest: { replayVersion: "1", rulesetVersion: "v99" } };
    expect(ReplaySchema.safeParse(bad).success).toBe(false);
  });

  it("keeps the engine reproducible from a fresh state too", () => {
    const state = createInitialState(FACTION_IDS);
    const roster = state.squads.map((s) => s.id);
    const orders = FACTION_IDS.map((factionId) => ({ factionId, orders: [] }));
    expect(resolveTurn(state, orders, roster, GRID_SIZE)).toEqual(resolveTurn(state, orders, roster, GRID_SIZE));
  });
});
