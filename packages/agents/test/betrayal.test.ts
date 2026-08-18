import { describe, expect, it } from "vitest";
import { FACTION_IDS, GRID_SIZE, type Decision, type FactionId, type GeneralConfig, type LocalView } from "@abs/contracts";
import { DEFAULT_GENERALS, ScriptedProvider, chargeNearest, runBattleV2 } from "@abs/agents";

/**
 * Betrayal, exercised end to end.
 *
 * The delayed break is the heart of the alliance design — an alliance means
 * something only because breaking it costs a turn during which the ally knows.
 * Yet across every real battle so far, not one BREAK_ALLIANCE has ever fired:
 * models proposed and accepted, never betrayed. So the rule that matters most
 * had never been exercised outside unit tests of the state machine.
 *
 * A scripted provider drives it deterministically, at no quota cost, through
 * the whole loop rather than through the state machine alone.
 */

const CONFIG = {
  rulesetVersion: "v2" as const,
  seed: 5,
  maxTurns: 12,
  gridSize: GRID_SIZE,
  generals: DEFAULT_GENERALS,
};

/** Scripts one faction's diplomacy by turn, and lets everyone else fight on. */
function scripted(script: Partial<Record<FactionId, Record<number, Decision["diplomacy"]>>>) {
  return new ScriptedProvider((view: LocalView, general: GeneralConfig) => {
    const base = chargeNearest(view, general);
    const turn = view.turn + 1;
    return { ...base, diplomacy: script[general.factionId]?.[turn] ?? null };
  });
}

const play = (script: Parameters<typeof scripted>[0]) =>
  runBattleV2({
    config: CONFIG,
    provider: scripted(script),
    battleId: "betrayal",
    now: () => new Date("2026-08-19T00:00:00.000Z"),
    buyArmy: async () => ["MELEE", "RANGED", "SCOUT"],
  });

const eventsOf = (replay: Awaited<ReturnType<typeof play>>, type: string) =>
  replay.turns.flatMap((t) => t.events.filter((e) => e.type === type));

const alliedAt = (replay: Awaited<ReturnType<typeof play>>, turn: number) =>
  replay.turns.find((t) => t.turn === turn)?.alliances?.pairs ?? [];

describe("betrayal costs a turn", () => {
  const ALLY_THEN_BETRAY = {
    crimson: { 1: { action: "PROPOSE_ALLIANCE" as const, target: "azure" as const, message: "Ensemble." } },
    azure: {
      2: { action: "ACCEPT_ALLIANCE" as const, target: "crimson" as const, message: "D'accord." },
      // Betray on turn 4, having enjoyed the alliance for two turns.
      4: { action: "BREAK_ALLIANCE" as const, target: "crimson" as const, message: "Nos routes divergent." },
    },
  };

  it("forms the alliance, then announces the break without applying it", async () => {
    const replay = await play(ALLY_THEN_BETRAY);

    expect(eventsOf(replay, "ALLIANCE_FORMED")).toHaveLength(1);
    expect(alliedAt(replay, 3)).toContain("azure|crimson");

    const declared = eventsOf(replay, "ALLIANCE_BREAK_DECLARED");
    expect(declared).toHaveLength(1);
    expect(declared[0]).toMatchObject({ from: "azure", to: "crimson", effectiveTurn: 5 });

    // The betrayed ally is still allied on the turn the betrayal is announced.
    expect(alliedAt(replay, 4)).toContain("azure|crimson");
  });

  it("applies the break on the following turn, and only then", async () => {
    const replay = await play(ALLY_THEN_BETRAY);

    const broken = eventsOf(replay, "ALLIANCE_BROKEN");
    expect(broken).toHaveLength(1);
    expect(replay.turns.find((t) => t.events.some((e) => e.type === "ALLIANCE_BROKEN"))!.turn).toBe(5);
    expect(alliedAt(replay, 5)).not.toContain("azure|crimson");
  });

  it("protects the pair from each other's attacks right up to the break", async () => {
    const replay = await play(ALLY_THEN_BETRAY);

    // While allied — turns 3 and 4 — neither can damage the other, however
    // hard the baseline AI charges.
    for (const turn of [3, 4]) {
      const record = replay.turns.find((t) => t.turn === turn)!;
      const hits = record.events.filter((e) => e.type === "ATTACK_HIT") as Array<{ squadId: string; targetSquadId: string }>;
      for (const hit of hits) {
        const across =
          (hit.squadId.startsWith("crimson-") && hit.targetSquadId.startsWith("azure-")) ||
          (hit.squadId.startsWith("azure-") && hit.targetSquadId.startsWith("crimson-"));
        expect(across, `turn ${turn}: ${hit.squadId} hit its ally ${hit.targetSquadId}`).toBe(false);
      }
    }
  });

  it("records the whole sequence in order, so a reader can follow the treachery", async () => {
    const replay = await play(ALLY_THEN_BETRAY);
    const story = replay.turns.flatMap((t) =>
      t.events.filter((e) => e.type.startsWith("ALLIANCE")).map((e) => `${t.turn}:${e.type}`),
    );
    expect(story).toEqual(["1:ALLIANCE_PROPOSED", "2:ALLIANCE_FORMED", "4:ALLIANCE_BREAK_DECLARED", "5:ALLIANCE_BROKEN"]);
  });
});

describe("betrayal cannot be made instant", () => {
  it("refuses to break an alliance twice to speed it up", async () => {
    const replay = await play({
      crimson: { 1: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
      azure: {
        2: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" },
        3: { action: "BREAK_ALLIANCE", target: "crimson", message: "" },
        // Declaring again does not bring the effective turn forward.
        4: { action: "BREAK_ALLIANCE", target: "crimson", message: "" },
      },
    });

    expect(eventsOf(replay, "ALLIANCE_BREAK_DECLARED")).toHaveLength(1);
    expect(eventsOf(replay, "ALLIANCE_BROKEN")).toHaveLength(1);
    expect(replay.turns.find((t) => t.events.some((e) => e.type === "ALLIANCE_BROKEN"))!.turn).toBe(4);
  });

  /**
   * A dissolving alliance can be renewed. Without that, the turn a betrayal
   * lands is exactly the turn reconciliation is impossible: the proposal is
   * refused as ALREADY_ALLIED because the break has not fired yet, and by the
   * next turn there is no offer left to accept. A dead turn nobody asked for.
   */
  it("lets the betrayed partner offer renewal while the break is still pending", async () => {
    const replay = await play({
      crimson: {
        1: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" },
        // Offered on the very turn the break lands.
        4: { action: "PROPOSE_ALLIANCE", target: "azure", message: "Restons-en là ?" },
      },
      azure: {
        2: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" },
        3: { action: "BREAK_ALLIANCE", target: "crimson", message: "" },
        5: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "Soit." },
      },
    });

    // The betrayal still cost its turn — it is not undone retroactively.
    expect(eventsOf(replay, "ALLIANCE_BROKEN")).toHaveLength(1);
    expect(alliedAt(replay, 4)).not.toContain("azure|crimson");

    // And they are allied again the turn after.
    expect(eventsOf(replay, "ALLIANCE_FORMED")).toHaveLength(2);
    expect(alliedAt(replay, 5)).toContain("azure|crimson");
  });

  it("still refuses a redundant proposal when nothing is dissolving", async () => {
    const replay = await play({
      crimson: {
        1: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" },
        3: { action: "PROPOSE_ALLIANCE", target: "azure", message: "Encore ?" },
      },
      azure: { 2: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } },
    });
    const rejected = eventsOf(replay, "DIPLOMACY_REJECTED") as Array<{ reason: string }>;
    expect(rejected.some((e) => e.reason === "ALREADY_ALLIED")).toBe(true);
  });
});

describe("surrender", () => {
  it("removes a faction's squads and records why", async () => {
    const replay = await play({
      verdant: { 3: { action: "SURRENDER", target: null, message: "Nous ne tiendrons pas." } },
    });

    const surrendered = eventsOf(replay, "FACTION_SURRENDERED");
    expect(surrendered).toHaveLength(1);
    expect(surrendered[0]).toMatchObject({ factionId: "verdant", message: "Nous ne tiendrons pas." });

    // Gone from the board from that turn on, not merely flagged.
    const after = replay.turns.find((t) => t.turn === 4)!.stateAfter.squads;
    expect(after.some((s) => s.factionId === "verdant")).toBe(false);
  });

  it("stops asking a surrendered general for orders", async () => {
    const asked: string[] = [];
    const provider = new ScriptedProvider((view, general) => {
      asked.push(`${view.turn + 1}:${general.factionId}`);
      const base = chargeNearest(view, general);
      if (general.factionId === "verdant" && view.turn + 1 === 2) {
        return { ...base, diplomacy: { action: "SURRENDER", target: null, message: "" } };
      }
      return base;
    });

    await runBattleV2({
      config: CONFIG,
      provider,
      battleId: "surrender",
      now: () => new Date("2026-08-19T00:00:00.000Z"),
      buyArmy: async () => ["MELEE", "RANGED", "SCOUT"],
    });

    expect(asked).toContain("2:verdant");
    expect(asked.filter((a) => a.endsWith(":verdant") && Number(a.split(":")[0]) > 2)).toEqual([]);
  });
});
