import { describe, expect, it } from "vitest";
import {
  newSpectator,
  localCouncil,
  resolveCouncil,
  incidentFor,
  SpectatorStateSchema,
  type CouncilDecision,
} from "../src/spectator.js";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../src/campaign.js";

const order = (
  s: ReturnType<typeof newSpectator>,
  id: "amber" | "azure" | "crimson" | "verdant",
): CouncilDecision => ({
  civ: id,
  turn: s.world.tick,
  objective: "Test",
  focus: "balanced",
  research: null,
  construction: [],
  diplomacy: [],
  recruitSettler: false,
  orders: [],
});
describe("spectator rules", () => {
  it("runs 120 councils with replay, conservation and immutable input", () => {
    let state = newSpectator(42);
    const origin = structuredClone(state);
    const journal: Campaign = {
      version: "spectator-1",
      id: "test",
      seed: 42,
      mode: "local",
      models: {},
      turns: [],
      pending: null,
    };
    for (let i = 0; i < 120; i++) {
      const decisions = state.world.civs
        .filter((c) => c.fellOnTick === null)
        .map((c) => localCouncil(state, c.id));
      const before = structuredClone(state);
      const result = resolveCouncil(state, decisions);
      expect(state).toEqual(before);
      expect(
        stateSignature(resolveCouncil(state, [...decisions].reverse()).state),
      ).toBe(stateSignature(result.state));
      state = result.state;
      expect(SpectatorStateSchema.safeParse(state).success).toBe(true);
      for (const u of state.world.simulation!.units) {
        const size = state.world.size;
        expect(
          Math.abs((u.position % size) - (u.previous % size)) +
            Math.abs(
              Math.floor(u.position / size) - Math.floor(u.previous / size),
            ),
        ).toBeLessThanOrEqual(1);
      }
      journal.turns.push({
        turn: i,
        answers: decisions.map((d) => ({
          civ: d.civ,
          decision: d,
          source: "local",
          model: "test",
          service: null,
          error: null,
        })),
        signature: stateSignature(state),
      });
    }
    expect(newSpectator(42)).toEqual(origin);
    expect(state.world.simulation!.cities.length).toBeGreaterThan(4);
    expect(
      state.world.simulation!.cities.some((c) => c.buildings.length > 0),
    ).toBe(true);
    expect(
      stateSignature(
        replayCampaign(
          CampaignSchema.parse(JSON.parse(JSON.stringify(journal))),
        ).state,
      ),
    ).toBe(stateSignature(state));
    journal.turns[0]!.signature = "corrupted";
    expect(() => replayCampaign(journal)).toThrow(/Rejeu/);
  }, 30000);
  it("announces bounded shared incidents deterministically with a quiet opening", () => {
    for (let turn = 0; turn < 12; turn++)
      expect(incidentFor(42, turn)).toBeNull();
    const incident = Array.from({ length: 24 }, (_, t) =>
      incidentFor(42, t),
    ).find(Boolean)!;
    expect(incident).toBeTruthy();
    expect(incidentFor(42, incident.start)).toEqual(incident);
    expect(incidentFor(42, incident.end + 1)).toBeNull();
    expect(incident.end - incident.start).toBe(2);
  });
  it("requires mutual diplomacy and pays building costs", () => {
    const state = newSpectator(7),
      a = order(state, "amber"),
      b = order(state, "azure");
    a.diplomacy = [{ target: "azure", proposal: "trade" }];
    expect(
      resolveCouncil(state, [a]).state.world.simulation!.relations.find(
        (r) => r.a === "amber" && r.b === "azure",
      )!.status,
    ).toBe("peace");
    b.diplomacy = [{ target: "amber", proposal: "trade" }];
    expect(
      resolveCouncil(state, [a, b]).state.world.simulation!.relations.find(
        (r) => r.a === "amber" && r.b === "azure",
      )!.status,
    ).toBe("trade");
    const civ = state.world.civs.find((c) => c.id === "amber")!;
    civ.stock.timber = 0;
    civ.stock.wealth = 0;
    a.construction = [
      {
        city: state.world.simulation!.cities.find((c) => c.owner === "amber")!
          .id,
        building: "academy",
      },
    ];
    expect(
      resolveCouncil(state, [a]).rejected.some((r) =>
        r.detail.includes("Construction"),
      ),
    ).toBe(true);
  });
  it("sums combat damage before applying casualties and never moves twice", () => {
    const state = newSpectator(4),
      w = state.world;
    const a = w.simulation!.units.find(
        (u) => u.owner === "amber" && u.role === "soldier",
      )!,
      b = w.simulation!.units.find(
        (u) => u.owner === "azure" && u.role === "soldier",
      )!;
    a.position = a.previous = 14;
    b.position = b.previous = 15;
    w.board[14]!.owner = "amber";
    w.board[15]!.owner = "azure";
    const relation = w.simulation!.relations.find(
      (r) => r.a === "amber" && r.b === "azure",
    )!;
    relation.status = "war";
    const da = order(state, "amber"),
      db = order(state, "azure");
    da.orders = [{ unit: a.id, action: "attack", target: 15, reason: "Test" }];
    db.orders = [{ unit: b.id, action: "attack", target: 14, reason: "Test" }];
    const result = resolveCouncil(state, [da, db]);
    expect(result.events.filter((e) => e.kind === "ROUTED")).toHaveLength(2);
    expect(stateSignature(result.state)).toBe(
      stateSignature(resolveCouncil(state, [db, da]).state),
    );
  });
  it("accepts no new decisions after a provider outage and preserves existing missions", () => {
    const initial = newSpectator(42);
    const decision = localCouncil(initial, "amber");
    const first = resolveCouncil(initial, [decision]);
    const second = resolveCouncil(first.state, []);
    expect(second.state.world.tick).toBe(2);
    expect(second.state.objectives.amber).toBe(first.state.objectives.amber);
    expect(
      second.state.missions.some((m) =>
        first.state.missions.some((old) => old.unit === m.unit),
      ),
    ).toBe(true);
  });
});
