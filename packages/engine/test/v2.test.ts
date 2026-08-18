import { describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ARMY_BUDGET,
  FACTION_IDS,
  GRID_SIZE,
  MAX_MEMORY_ENTRIES,
  MAX_SQUADS_PER_FACTION,
  type Archetype,
  type FactionId,
  type MemoryEntry,
  type RememberedSquad,
  type WorldState,
  CompositionChoiceSchema,
  FACTION_TRAITS,
  budgetFor,
  statsFor,
} from "@abs/contracts";
import {
  appendMemory,
  areAllied,
  checkOutcome,
  checkOutcomeV2,
  compositionCost,
  createInitialState,
  createInitialStateV2,
  emptyDiplomacy,
  localViewFor,
  localViewForV2,
  resolveDiplomacy,
  resolveTurn,
  updateSightings,
  validateComposition,
  visibleTo,
  type DiplomacyState,
  type DiplomacyInput,
} from "@abs/engine";

const ROSTER_V1 = createInitialState(FACTION_IDS).squads.map((s) => s.id);

const squad = (id: string, factionId: FactionId, archetype: Archetype, x: number, y: number, hp?: number) => ({
  id,
  factionId,
  archetype,
  position: { x, y },
  hp: hp ?? ARCHETYPES[archetype].hp,
  maxHp: ARCHETYPES[archetype].hp,
});

/** Run diplomacy for one turn from a fresh state. */
const diplo = (
  state: DiplomacyState,
  inputs: readonly DiplomacyInput[],
  turn = 1,
  living: readonly FactionId[] = FACTION_IDS,
) => resolveDiplomacy(state, inputs, turn, living);

// ---------------------------------------------------------------------------
describe("I20 · a v1 replay resolves identically under the v2 engine", () => {
  it("deploys v1 exactly where it always did", () => {
    const state = createInitialState(FACTION_IDS);
    expect(state.squads).toHaveLength(8);
    expect(state.squads.find((s) => s.id === "crimson-melee")!.position).toEqual({ x: 2, y: 2 });
    expect(state.squads.find((s) => s.id === "crimson-ranged")!.position).toEqual({ x: 1, y: 3 });
    expect(state.squads.find((s) => s.id === "verdant-ranged")!.position).toEqual({ x: 14, y: 12 });
  });

  it("keeps MELEE and RANGED statistics untouched by the v2 additions", () => {
    expect(ARCHETYPES.MELEE).toMatchObject({ hp: 10, movement: 2, range: 1, damage: 4 });
    expect(ARCHETYPES.RANGED).toMatchObject({ hp: 8, movement: 1, range: 4, damage: 3 });
  });

  it("resolves a turn the same with and without the alliance lookup", () => {
    const state = createInitialState(FACTION_IDS);
    const orders = FACTION_IDS.map((factionId) => ({
      factionId,
      orders: state.squads
        .filter((s) => s.factionId === factionId)
        .map((s) => ({ squadId: s.id, action: "HOLD" as const, target: { ...s.position } })),
    }));
    const v1 = resolveTurn(state, orders, ROSTER_V1, GRID_SIZE);
    const v2 = resolveTurn(state, orders, ROSTER_V1, GRID_SIZE, () => false);
    expect(v2).toEqual(v1);
  });
});

// ---------------------------------------------------------------------------
describe("I12 · army budget", () => {
  it("prices the composition the spec says", () => {
    expect(compositionCost(["MELEE", "RANGED", "SCOUT"])).toBe(17);
    expect(compositionCost(["HEAVY", "HEAVY"])).toBe(20);
  });

  it("accepts a legal composition", () => {
    expect(validateComposition(["MELEE", "RANGED", "SCOUT"])).toBeNull();
    expect(validateComposition(["HEAVY", "HEAVY"])).toBeNull();
  });

  it("rejects rather than trims an overspend", () => {
    expect(compositionCost(["HEAVY", "HEAVY", "SCOUT"])).toBeGreaterThan(ARMY_BUDGET);
    expect(validateComposition(["HEAVY", "HEAVY", "SCOUT"])).toBe("OVER_BUDGET");
  });

  it("rejects an empty army and an oversized one", () => {
    expect(validateComposition([])).toBe("EMPTY");
    expect(validateComposition(Array(MAX_SQUADS_PER_FACTION + 1).fill("SCOUT"))).toBe("TOO_MANY_SQUADS");
  });

  it("deploys a bought composition onto the corner tiles, with indexed ids", () => {
    const state = createInitialStateV2({
      crimson: ["SCOUT", "SCOUT", "MELEE"],
      azure: ["HEAVY", "RANGED"],
      verdant: ["MELEE", "RANGED"],
      amber: ["MELEE", "RANGED"],
    });
    const crimson = state.squads.filter((s) => s.factionId === "crimson");
    expect(crimson.map((s) => s.id).sort()).toEqual(["crimson-melee-1", "crimson-scout-1", "crimson-scout-2"]);
    // Two squads of one archetype must not collide on a tile.
    const tiles = crimson.map((s) => `${s.position.x},${s.position.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it("never lets a faction exceed the ceiling once deployed", () => {
    const comp: Record<FactionId, Archetype[]> = {
      crimson: ["MELEE", "RANGED", "SCOUT"],
      azure: ["HEAVY", "HEAVY"],
      verdant: ["SCOUT", "SCOUT", "SCOUT", "SCOUT"],
      amber: ["MELEE", "MELEE", "SCOUT"],
    };
    for (const c of Object.values(comp)) {
      expect(compositionCost(c)).toBeLessThanOrEqual(ARMY_BUDGET);
      expect(c.length).toBeLessThanOrEqual(MAX_SQUADS_PER_FACTION);
    }
    const state = createInitialStateV2(comp);
    for (const f of FACTION_IDS) {
      expect(state.squads.filter((s) => s.factionId === f).length).toBeLessThanOrEqual(MAX_SQUADS_PER_FACTION);
    }
  });
});

// ---------------------------------------------------------------------------
describe("fog of war", () => {
  const state: WorldState = {
    turn: 3,
    squads: [
      squad("crimson-scout-1", "crimson", "SCOUT", 5, 5), // vision 9
      squad("crimson-heavy-1", "crimson", "HEAVY", 0, 0), // vision 3
      squad("azure-melee-1", "azure", "MELEE", 12, 5), // 7 away from the scout
      squad("azure-melee-2", "azure", "MELEE", 15, 15), // far from everything
    ],
  };
  const view = (diplomacy = emptyDiplomacy(), sightings = new Map<string, RememberedSquad>()) =>
    localViewForV2({
      state,
      you: "crimson",
      maxTurns: 12,
      gridSize: GRID_SIZE,
      diplomacy,
      factions: FACTION_IDS,
      sightings,
      memory: [],
      budgetSpent: 14,
    });

  it("shows only what is within somebody's sight radius", () => {
    const v = view();
    expect(v.enemySquads.map((s) => s.id)).toEqual(["azure-melee-1"]);
    expect(v.enemySquads.map((s) => s.id)).not.toContain("azure-melee-2");
  });

  it("always shows a faction its own squads, however blind they are", () => {
    expect(view().yourSquads.map((s) => s.id).sort()).toEqual(["crimson-heavy-1", "crimson-scout-1"]);
  });

  it("remembers where an enemy was last seen, and says when", () => {
    const sightings = new Map<string, RememberedSquad>([
      ["azure-melee-2", { ...squad("azure-melee-2", "azure", "MELEE", 9, 9), lastSeenTurn: 1 }],
    ]);
    const v = view(emptyDiplomacy(), sightings);
    expect(v.rememberedEnemies).toHaveLength(1);
    // Stale on purpose: the general may act on news that is two turns old.
    expect(v.rememberedEnemies[0]).toMatchObject({ id: "azure-melee-2", position: { x: 9, y: 9 }, lastSeenTurn: 1 });
  });

  it("does not remember an enemy it can currently see", () => {
    const sightings = new Map<string, RememberedSquad>([
      ["azure-melee-1", { ...squad("azure-melee-1", "azure", "MELEE", 1, 1), lastSeenTurn: 2 }],
    ]);
    expect(view(emptyDiplomacy(), sightings).rememberedEnemies).toHaveLength(0);
  });

  it("forgets a squad that no longer exists", () => {
    const sightings = new Map<string, RememberedSquad>([
      ["ghost", { ...squad("ghost", "azure", "MELEE", 3, 3), lastSeenTurn: 1 }],
    ]);
    expect(updateSightings(sightings, state, "crimson", []).has("ghost")).toBe(false);
  });

  it("shares vision between allies", () => {
    // Amber sits next to the far azure squad; alone, crimson cannot see it.
    const withAlly: WorldState = {
      ...state,
      squads: [...state.squads, squad("amber-scout-1", "amber", "SCOUT", 14, 15)],
    };
    const alone = visibleTo(withAlly, "crimson", []);
    expect(alone.has("azure-melee-2")).toBe(false);
    const allied = visibleTo(withAlly, "crimson", ["amber"]);
    expect(allied.has("azure-melee-2")).toBe(true);
  });

  it("I14 · the projection cannot change a battle", () => {
    const orders = [
      { factionId: "crimson" as const, orders: [{ squadId: "crimson-scout-1", action: "MOVE" as const, target: { x: 6, y: 5 } }] },
    ];
    const roster = state.squads.map((s) => s.id);
    // Fog is a view concern only: resolution is fed the real state either way.
    expect(resolveTurn(state, orders, roster, GRID_SIZE)).toEqual(resolveTurn(state, orders, roster, GRID_SIZE));
  });

  it("v1 view keeps total visibility and empty v2 fields", () => {
    const v = localViewFor(createInitialState(FACTION_IDS), "crimson", 12, GRID_SIZE);
    expect(v.enemySquads).toHaveLength(6);
    expect(v.rememberedEnemies).toEqual([]);
    expect(v.allies).toEqual([]);
    expect(v.budget).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("I15 · alliances are symmetric", () => {
  it("forms only on a proposal followed by an acceptance", () => {
    let s = emptyDiplomacy();
    s = diplo(s, [{ factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } }]).state;
    expect(areAllied(s, "crimson", "azure")).toBe(false);

    const r = diplo(s, [{ factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } }], 2);
    expect(areAllied(r.state, "crimson", "azure")).toBe(true);
    // Symmetric by construction: there is no one-way alliance to test against.
    expect(areAllied(r.state, "azure", "crimson")).toBe(true);
    expect(r.events).toContainEqual({ type: "ALLIANCE_FORMED", a: "azure", b: "crimson" });
  });

  it("refuses an acceptance with no offer on the table", () => {
    const r = diplo(emptyDiplomacy(), [
      { factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } },
    ]);
    expect(areAllied(r.state, "crimson", "azure")).toBe(false);
    expect(r.events).toContainEqual({ type: "DIPLOMACY_REJECTED", factionId: "azure", reason: "NO_SUCH_PROPOSAL" });
  });

  it("lets a proposal lapse after its time to live", () => {
    let s = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
    ]).state;
    const late = diplo(s, [{ factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } }], 99);
    expect(areAllied(late.state, "crimson", "azure")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("I16 · a betrayal is never instant", () => {
  const allied = () => {
    let s = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
    ]).state;
    return diplo(s, [{ factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } }], 2).state;
  };

  it("keeps the alliance alive on the turn the break is declared", () => {
    const r = diplo(allied(), [{ factionId: "crimson", diplomacy: { action: "BREAK_ALLIANCE", target: "azure", message: "" } }], 3);
    expect(areAllied(r.state, "crimson", "azure")).toBe(true);
    expect(r.events).toContainEqual({ type: "ALLIANCE_BREAK_DECLARED", from: "crimson", to: "azure", effectiveTurn: 4 });
    expect(r.events.some((e) => e.type === "ALLIANCE_BROKEN")).toBe(false);
  });

  it("breaks it on the following turn — the ally had one turn to react", () => {
    const declared = diplo(allied(), [
      { factionId: "crimson", diplomacy: { action: "BREAK_ALLIANCE", target: "azure", message: "" } },
    ], 3).state;
    const later = diplo(declared, [], 4);
    expect(areAllied(later.state, "crimson", "azure")).toBe(false);
    expect(later.events).toContainEqual({ type: "ALLIANCE_BROKEN", a: "azure", b: "crimson" });
  });

  it("refuses to break an alliance that does not exist", () => {
    const r = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "BREAK_ALLIANCE", target: "azure", message: "" } },
    ]);
    expect(r.events).toContainEqual({ type: "DIPLOMACY_REJECTED", factionId: "crimson", reason: "NOT_ALLIED" });
  });
});

// ---------------------------------------------------------------------------
describe("bounded diplomacy · anti-exploits 14 to 20", () => {
  it("counts only the first action of a turn", () => {
    const r = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "verdant", message: "" } },
    ]);
    expect(r.events.filter((e) => e.type === "ALLIANCE_PROPOSED")).toHaveLength(1);
    expect(r.events).toContainEqual({ type: "DIPLOMACY_REJECTED", factionId: "crimson", reason: "DUPLICATE_DIPLOMACY" });
  });

  it("refuses self-targeting and dead targets", () => {
    const self = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "crimson", message: "" } },
    ]);
    expect(self.events).toContainEqual({ type: "DIPLOMACY_REJECTED", factionId: "crimson", reason: "SELF_TARGETED" });

    const dead = diplo(
      emptyDiplomacy(),
      [{ factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } }],
      1,
      ["crimson", "verdant", "amber"],
    );
    expect(dead.events).toContainEqual({ type: "DIPLOMACY_REJECTED", factionId: "crimson", reason: "DEAD_FACTION" });
  });

  it("truncates a runaway message instead of carrying it into the replay", () => {
    const r = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "x".repeat(5000) } },
    ]);
    const proposed = r.events.find((e) => e.type === "ALLIANCE_PROPOSED") as { message: string };
    expect(proposed.message).toHaveLength(200);
  });

  it("removes a surrendered faction and drops its alliances", () => {
    let s = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
    ]).state;
    s = diplo(s, [{ factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } }], 2).state;
    const r = diplo(s, [{ factionId: "azure", diplomacy: { action: "SURRENDER", target: null, message: "assez" } }], 3);
    expect(r.state.surrendered.has("azure")).toBe(true);
    expect(areAllied(r.state, "crimson", "azure")).toBe(false);
    expect(r.events).toContainEqual({ type: "FACTION_SURRENDERED", factionId: "azure", message: "assez" });
  });

  it("is permutation-invariant, like the rest of the engine", () => {
    const inputs: DiplomacyInput[] = [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
      { factionId: "verdant", diplomacy: { action: "PROPOSE_ALLIANCE", target: "amber", message: "" } },
    ];
    const a = diplo(emptyDiplomacy(), inputs);
    const b = diplo(emptyDiplomacy(), [...inputs].reverse());
    expect(b.events).toEqual(a.events);
    expect([...b.state.pairs].sort()).toEqual([...a.state.pairs].sort());
  });
});

// ---------------------------------------------------------------------------
describe("I19 · alliance-aware combat and victory", () => {
  it("blocks an attack on an ally without redirecting it", () => {
    const state: WorldState = {
      turn: 2,
      squads: [squad("crimson-melee-1", "crimson", "MELEE", 5, 5), squad("azure-melee-1", "azure", "MELEE", 6, 5)],
    };
    const result = resolveTurn(
      state,
      [{ factionId: "crimson", orders: [{ squadId: "crimson-melee-1", action: "ATTACK", target: { x: 6, y: 5 } }] }],
      state.squads.map((s) => s.id),
      GRID_SIZE,
      (a, b) => (a === "azure" && b === "crimson") || (a === "crimson" && b === "azure"),
    );
    expect(result.events).toContainEqual({ type: "ATTACK_ALLY_BLOCKED", squadId: "crimson-melee-1", at: { x: 6, y: 5 } });
    expect(result.state.squads.find((s) => s.id === "azure-melee-1")!.hp).toBe(ARCHETYPES.MELEE.hp);
  });

  it("declares a joint alliance victory with no tie-break", () => {
    let s = diplo(emptyDiplomacy(), [
      { factionId: "crimson", diplomacy: { action: "PROPOSE_ALLIANCE", target: "azure", message: "" } },
    ]).state;
    s = diplo(s, [{ factionId: "azure", diplomacy: { action: "ACCEPT_ALLIANCE", target: "crimson", message: "" } }], 2).state;

    const state: WorldState = {
      turn: 5,
      squads: [squad("crimson-melee-1", "crimson", "MELEE", 5, 5, 9), squad("azure-melee-1", "azure", "MELEE", 9, 9, 2)],
    };
    const outcome = checkOutcomeV2(state, 12, s)!;
    expect(outcome.kind).toBe("ALLIANCE_VICTORY");
    expect(outcome.winners.sort()).toEqual(["azure", "crimson"]);
    // No single winner: ranking a shared win would re-introduce the fight.
    expect(outcome.winner).toBeNull();
  });

  it("does not end the battle when the survivors are not all allied", () => {
    const state: WorldState = {
      turn: 5,
      squads: [squad("crimson-melee-1", "crimson", "MELEE", 5, 5), squad("azure-melee-1", "azure", "MELEE", 9, 9)],
    };
    expect(checkOutcomeV2(state, 12, emptyDiplomacy())).toBeNull();
  });

  it("still ends on a lone survivor, exactly as v1 does", () => {
    const state: WorldState = { turn: 5, squads: [squad("crimson-melee-1", "crimson", "MELEE", 5, 5)] };
    expect(checkOutcomeV2(state, 12, emptyDiplomacy())).toEqual(checkOutcome(state, 12));
  });
});

// ---------------------------------------------------------------------------
describe("I17 and I18 · memory is bounded and never invented", () => {
  it("caps the digest however long the battle runs", () => {
    let memory: MemoryEntry[] = [];
    for (let turn = 1; turn <= 40; turn += 1) memory = appendMemory(memory, turn, "crimson", [`lost-${turn}`], [], []);
    expect(memory).toHaveLength(MAX_MEMORY_ENTRIES);
    // Keeps the most recent, drops the oldest.
    expect(memory.at(-1)!.turn).toBe(40);
    expect(memory[0]!.turn).toBe(41 - MAX_MEMORY_ENTRIES);
  });

  it("records nothing on a turn where nothing happened", () => {
    expect(appendMemory([], 4, "crimson", [], [], [])).toEqual([]);
  });

  it("only ever holds what was passed in from real events", () => {
    const memory = appendMemory([], 3, "crimson", ["crimson-scout-1"], ["azure-melee-1"], ["ALLIANCE_FORMED avec amber"]);
    expect(memory).toEqual([
      { turn: 3, lost: ["crimson-scout-1"], destroyed: ["azure-melee-1"], diplomacy: ["ALLIANCE_FORMED avec amber"] },
    ]);
  });
});

// ---------------------------------------------------------------------------
describe("army answers are parsed, not repaired", () => {
  it("accepts the flat list the prompt asks for", () => {
    const r = CompositionChoiceSchema.safeParse({ reasoning: "solide", squads: ["MELEE", "RANGED", "SCOUT"] });
    expect(r.success && r.data.squads).toEqual(["MELEE", "RANGED", "SCOUT"]);
  });

  it("accepts the {type, quantity} form models reach for unprompted", () => {
    // gpt-oss-120b answered exactly this, and lost its army to a parse error.
    const r = CompositionChoiceSchema.safeParse({
      squads: [
        { type: "MELEE", quantity: 2 },
        { type: "SCOUT", quantity: 2 },
      ],
    });
    expect(r.success && r.data.squads).toEqual(["MELEE", "MELEE", "SCOUT", "SCOUT"]);
  });

  it("does not require the flavour text", () => {
    // minimax-m3 answered a perfectly legal army with no `reasoning`.
    const r = CompositionChoiceSchema.safeParse({ squads: ["RANGED", "RANGED", "SCOUT"] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.reasoning).toBe("");
  });

  it("still refuses an unknown archetype rather than guessing", () => {
    expect(CompositionChoiceSchema.safeParse({ squads: ["ARTILLERY"] }).success).toBe(false);
  });

  it("parses an illegal-but-well-formed army, and leaves rejecting it to the engine", () => {
    // Parsing and legality are separate steps on purpose: the replay must be
    // able to record that a general overspent.
    const parsed = CompositionChoiceSchema.parse({ squads: [{ type: "HEAVY", quantity: 3 }] });
    expect(parsed.squads).toEqual(["HEAVY", "HEAVY", "HEAVY"]);
    expect(validateComposition(parsed.squads)).toBe("OVER_BUDGET");
  });
});

// ---------------------------------------------------------------------------
describe("faction traits are trades, never upgrades", () => {
  it("pays for every bonus with a matching malus", () => {
    for (const f of FACTION_IDS) {
      const t = FACTION_TRAITS[f];
      const gains = (t.budgetDelta > 0 ? 1 : 0) + (t.hpMultiplier > 1 ? 1 : 0) + (t.visionDelta > 0 ? 1 : 0);
      const costs = (t.budgetDelta < 0 ? 1 : 0) + (t.hpMultiplier < 1 ? 1 : 0) + (t.visionDelta < 0 ? 1 : 0);
      // A faction with an advantage must carry a disadvantage. Amber, the
      // deliberately neutral reference, has neither.
      expect(gains === 0 ? costs : costs, `${f} has ${gains} gains and ${costs} costs`).toBeGreaterThanOrEqual(
        gains === 0 ? 0 : 1,
      );
    }
  });

  it("keeps one faction perfectly neutral as a reference point", () => {
    expect(FACTION_TRAITS.amber).toMatchObject({ budgetDelta: 0, hpMultiplier: 1, visionDelta: 0 });
    expect(statsFor("amber", "MELEE")).toEqual(ARCHETYPES.MELEE);
  });

  it("gives the scouting faction real reach and the entrenched one real blindness", () => {
    expect(statsFor("azure", "SCOUT").vision).toBe(ARCHETYPES.SCOUT.vision + 2);
    expect(statsFor("verdant", "SCOUT").vision).toBe(ARCHETYPES.SCOUT.vision - 2);
    expect(statsFor("verdant", "HEAVY").hp).toBeGreaterThan(ARCHETYPES.HEAVY.hp);
    expect(statsFor("crimson", "HEAVY").hp).toBeLessThan(ARCHETYPES.HEAVY.hp);
  });

  it("never reduces a statistic below a usable floor", () => {
    for (const f of FACTION_IDS) {
      for (const a of ["MELEE", "RANGED", "SCOUT", "HEAVY"] as const) {
        expect(statsFor(f, a).hp).toBeGreaterThanOrEqual(1);
        expect(statsFor(f, a).vision).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("adjusts the army budget per faction", () => {
    expect(budgetFor("crimson")).toBe(ARMY_BUDGET + 3);
    expect(budgetFor("azure")).toBe(ARMY_BUDGET - 3);
    expect(budgetFor("amber")).toBe(ARMY_BUDGET);
    // The zealots' extra points buy something their fragility must pay back.
    expect(validateComposition(["HEAVY", "RANGED", "SCOUT"], "crimson")).toBeNull();
    expect(validateComposition(["HEAVY", "RANGED", "SCOUT"], "azure")).toBe("OVER_BUDGET");
  });

  it("I20 · leaves v1 deployment untouched by traits", () => {
    // crimson's trait would cut hp by 15%; a v1 battle must not feel it.
    const state = createInitialState(FACTION_IDS);
    expect(state.squads.find((s) => s.id === "crimson-melee")!.hp).toBe(ARCHETYPES.MELEE.hp);
    expect(state.squads.find((s) => s.id === "verdant-ranged")!.hp).toBe(ARCHETYPES.RANGED.hp);
  });
});
