import {
  ARCHETYPES,
  CONTRACTS_VERSION,
  CompositionChoiceSchema,
  FACTION_IDS,
  type Archetype,
  type BattleConfig,
  type BattleEvent,
  type DecisionRecord,
  type FactionId,
  type MemoryEntry,
  type RememberedSquad,
  type Replay,
  type TurnRecord,
} from "@abs/contracts";
import {
  DEFAULT_V2_COMPOSITION,
  alliesOf,
  compositionCost,
  appendMemory,
  areAllied,
  checkOutcomeV2,
  createInitialStateV2,
  diplomacySnapshot,
  emptyDiplomacy,
  localViewForV2,
  resolveDiplomacy,
  resolveTurn,
  updateSightings,
  validateComposition,
  type DiplomacyInput,
  type DiplomacyState,
  type FactionOrders,
} from "@abs/engine";
import type { OrderProvider } from "./provider.js";

export interface RunBattleV2Options {
  config: BattleConfig;
  provider: OrderProvider;
  /** Asks a general to buy its army. Returns null to accept the default. */
  buyArmy?: (factionId: FactionId, general: BattleConfig["generals"][number]) => Promise<Archetype[] | null>;
  onProgress?: (message: string) => void;
  onTurn?: (partial: Replay) => void;
  battleId?: string;
  now?: () => Date;
}

/**
 * Drive a ruleset v2 battle: army buying, then fog-limited turns with bounded
 * diplomacy.
 *
 * Deliberately a separate function rather than a flag inside `runBattle`. v1
 * has to keep resolving byte-identically (invariant I20), and threading two
 * rulesets through one loop is how that promise gets broken by accident.
 */
export async function runBattleV2({
  config,
  provider,
  buyArmy,
  onProgress,
  onTurn,
  battleId,
  now,
}: RunBattleV2Options): Promise<Replay> {
  const log = onProgress ?? (() => {});
  const factions = FACTION_IDS;

  // ---- Army buying ---------------------------------------------------------
  const compositions = {} as Record<FactionId, Archetype[]>;
  const setupEvents: BattleEvent[] = [];

  for (const general of config.generals) {
    let chosen: Archetype[] | null = null;
    try {
      chosen = buyArmy ? await buyArmy(general.factionId, general) : null;
    } catch (err) {
      log(`  ${general.factionId}: army request failed — ${(err as Error).message}`);
    }

    const rejection = chosen ? validateComposition(chosen) : null;
    if (!chosen || rejection) {
      // Never repaired into something legal: the replay records the overspend.
      if (chosen && rejection) {
        setupEvents.push({ type: "COMPOSITION_REJECTED", factionId: general.factionId, reason: rejection });
        log(`  ${general.factionId}: composition rejected (${rejection}), using the default`);
      } else {
        // Never silent: a default army must be visible as a default, not read
        // as a deliberate choice.
        log(`  ${general.factionId}: no usable army returned, using the default`);
      }
      compositions[general.factionId] = [...DEFAULT_V2_COMPOSITION];
    } else {
      compositions[general.factionId] = chosen;
      log(`  ${general.factionId}: ${chosen.join(" + ")} (${compositionCost(chosen)}/${20} pts)`);
    }
  }

  const initialState = createInitialStateV2(compositions);
  const roster = initialState.squads.map((s) => s.id);
  const budgetSpent = Object.fromEntries(
    Object.entries(compositions).map(([f, c]) => [f, compositionCost(c)]),
  ) as Record<FactionId, number>;

  // ---- Per-faction beliefs, carried across turns ---------------------------
  const sightings = new Map<FactionId, Map<string, RememberedSquad>>();
  const memories = new Map<FactionId, MemoryEntry[]>();
  for (const f of factions) {
    sightings.set(f, new Map());
    memories.set(f, []);
  }

  let diplomacy: DiplomacyState = emptyDiplomacy();
  let state = initialState;
  const turns: TurnRecord[] = [];

  // Seed sightings from the deployment: everyone starts by looking around.
  for (const f of factions) sightings.set(f, updateSightings(sightings.get(f)!, state, f, []));

  let outcome = checkOutcomeV2(state, config.maxTurns, diplomacy);

  const id = battleId ?? `battle-v2-${(now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-")}`;
  const manifest = {
    replayVersion: "1",
    rulesetVersion: "v2",
    contractsVersion: CONTRACTS_VERSION,
    battleId: id,
    createdAt: (now?.() ?? new Date()).toISOString(),
    config,
  } as const;

  while (!outcome) {
    const decisions: DecisionRecord[] = [];
    const factionOrders: FactionOrders[] = [];
    const diplomacyInputs: DiplomacyInput[] = [];
    const extraEvents: BattleEvent[] = [...(turns.length === 0 ? setupEvents : [])];

    const living = new Set(state.squads.map((s) => s.factionId));

    // Serial, and every general sees the same snapshot — call order does not
    // leak into the battle.
    for (const general of config.generals) {
      const f = general.factionId;
      if (!living.has(f) || diplomacy.surrendered.has(f)) continue;

      const view = localViewForV2({
        state,
        you: f,
        maxTurns: config.maxTurns,
        gridSize: config.gridSize,
        diplomacy,
        factions,
        sightings: sightings.get(f)!,
        memory: memories.get(f)!,
        budgetSpent: budgetSpent[f],
      });

      log(`  ${f}: asking ${general.model}...`);
      const { decision, telemetry } = await provider.decide(view, general);

      if (!decision) {
        extraEvents.push({ type: "GENERAL_UNREACHABLE", factionId: f, error: telemetry.error ?? "unknown" });
        factionOrders.push({ factionId: f, orders: [] });
        decisions.push({ factionId: f, reasoning: "", orders: [], diplomacy: null, telemetry });
        continue;
      }

      factionOrders.push({ factionId: f, orders: decision.orders });
      diplomacyInputs.push({ factionId: f, diplomacy: decision.diplomacy ?? null });
      decisions.push({
        factionId: f,
        reasoning: decision.reasoning,
        orders: decision.orders,
        diplomacy: decision.diplomacy ?? null,
        telemetry,
      });
    }

    // Diplomacy resolves BEFORE combat, so an alliance formed this turn already
    // protects both sides from each other's orders in the same turn.
    const dip = resolveDiplomacy(diplomacy, diplomacyInputs, state.turn + 1, [...living]);
    diplomacy = dip.state;

    // A surrendered faction withdraws: its squads leave the field.
    const beforeSurrender = state.squads;
    if (diplomacy.surrendered.size) {
      state = { ...state, squads: state.squads.filter((s) => !diplomacy.surrendered.has(s.factionId)) };
    }
    const withdrawn = beforeSurrender.filter((s) => !state.squads.includes(s));

    const result = resolveTurn(state, factionOrders, roster, config.gridSize, (a, b) => areAllied(diplomacy, a, b));
    state = result.state;

    const events = [...extraEvents, ...dip.events, ...result.events];

    // Memory is built from events the engine emitted, never from a model.
    for (const f of factions) {
      const lost = events
        .filter((e) => e.type === "SQUAD_DESTROYED" && e.factionId === f)
        .map((e) => (e as { squadId: string }).squadId);
      const destroyed = events
        .filter((e) => e.type === "SQUAD_DESTROYED" && e.factionId !== f)
        .map((e) => (e as { squadId: string }).squadId);
      const dipLines = dip.events
        .filter((e) => JSON.stringify(e).includes(f))
        .map((e) => e.type + (("message" in e && e.message) ? `: ${e.message}` : ""));
      memories.set(f, appendMemory(memories.get(f)!, state.turn, f, lost, destroyed, dipLines));
      sightings.set(f, updateSightings(sightings.get(f)!, state, f, alliesOf(diplomacy, f, factions)));
    }

    turns.push({ turn: state.turn, decisions, events, stateAfter: state, alliances: diplomacySnapshot(diplomacy) });

    const allied = [...diplomacy.pairs].join(", ");
    log(
      `turn ${state.turn}/${config.maxTurns} — ${state.squads.length} squad(s) left` +
        (allied ? ` · alliances: ${allied}` : "") +
        (withdrawn.length ? ` · ${withdrawn.length} withdrawn` : ""),
    );

    outcome = checkOutcomeV2(state, config.maxTurns, diplomacy);
    onTurn?.({
      manifest,
      initialState,
      turns,
      outcome: outcome ?? {
        kind: "DRAW",
        winner: null,
        winners: [],
        reason: `Bataille en cours, interrompue apres le tour ${state.turn}.`,
        finalTurn: state.turn,
      },
    });
  }

  return { manifest, initialState, turns, outcome };
}

/** Ask one general to buy an army, validating the answer locally. */
export function makeArmyBuyer(
  ask: (systemPrompt: string, userPrompt: string, factionId: FactionId) => Promise<string | null>,
  prompts: { system: () => string; user: (faction: string) => string },
) {
  return async (factionId: FactionId): Promise<Archetype[] | null> => {
    const raw = await ask(prompts.system(), prompts.user(factionId), factionId);
    if (!raw) return null;
    try {
      const parsed = CompositionChoiceSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      return parsed.data.squads.filter((a) => a in ARCHETYPES);
    } catch {
      return null;
    }
  };
}
