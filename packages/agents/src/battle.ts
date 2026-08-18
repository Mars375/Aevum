import {
  CONTRACTS_VERSION,
  FACTION_IDS,
  RULESET_VERSION,
  type BattleConfig,
  type BattleEvent,
  type DecisionRecord,
  type Replay,
  type TurnRecord,
} from "@abs/contracts";
import { checkOutcome, createInitialState, localViewFor, resolveTurn, type FactionOrders } from "@abs/engine";
import type { OrderProvider } from "./provider.js";

export interface RunBattleOptions {
  config: BattleConfig;
  provider: OrderProvider;
  onProgress?: (message: string) => void;
  battleId?: string;
  now?: () => Date;
  /**
   * Called after every turn with the replay as it stands. A battle takes 30-40
   * minutes against a rate-limited free tier, so writing only at the end means
   * an interruption at turn 11 loses everything (QA defect D4).
   */
  onTurn?: (partial: Replay) => void;
  /**
   * A previously interrupted replay to continue. Its turns are trusted and
   * replayed through the engine to rebuild state — never re-requested from a
   * model, which keeps a resumed battle as auditable as an uninterrupted one.
   */
  resumeFrom?: Replay;
}

/**
 * Drive a whole battle and return the replay. The only stochastic part of the
 * system lives behind `provider`; everything the engine does is reproducible
 * from the recorded orders, which is what makes the replay auditable without
 * calling a single model again.
 */
export async function runBattle({
  config,
  provider,
  onProgress,
  battleId,
  now,
  onTurn,
  resumeFrom,
}: RunBattleOptions): Promise<Replay> {
  const log = onProgress ?? (() => {});
  const initialState = resumeFrom?.initialState ?? createInitialState(FACTION_IDS);
  const roster = initialState.squads.map((s) => s.id);

  const turns: TurnRecord[] = resumeFrom ? [...resumeFrom.turns] : [];
  let state = turns.length ? turns[turns.length - 1]!.stateAfter : initialState;
  if (resumeFrom && turns.length) log(`resuming after turn ${state.turn}, ${state.squads.length} squad(s) alive`);

  const id = resumeFrom?.manifest.battleId ?? battleId ?? `battle-${(now?.() ?? new Date()).toISOString().replace(/[:.]/g, "-")}`;
  const createdAt = resumeFrom?.manifest.createdAt ?? (now?.() ?? new Date()).toISOString();
  const manifest = {
    replayVersion: "1",
    rulesetVersion: RULESET_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    battleId: id,
    createdAt,
    config,
  } as const;

  let outcome = checkOutcome(state, config.maxTurns);

  while (!outcome) {
    const decisions: DecisionRecord[] = [];
    const factionOrders: FactionOrders[] = [];
    const extraEvents: BattleEvent[] = [];

    const livingFactions = new Set(state.squads.map((s) => s.factionId));

    // Serial on purpose. Four concurrent requests to the same free tier trip
    // rate limiting far more often, and nothing here is latency-critical: the
    // battle is watched afterwards, never live.
    for (const general of config.generals) {
      if (!livingFactions.has(general.factionId)) continue;

      // Every general sees the same snapshot, so ordering these calls does not
      // leak turn order into the battle.
      const view = localViewFor(state, general.factionId, config.maxTurns, config.gridSize);
      // Announce before the call, not only after: a single request can take
      // three minutes on the free tier, and silence reads as a hung process.
      log(`  ${general.factionId}: asking ${general.model}...`);
      const { decision, telemetry } = await provider.decide(view, general);

      if (!decision) {
        // The whole chain failed. Squads hold and the replay says so; the
        // client never fabricates an order to paper over the gap.
        extraEvents.push({
          type: "GENERAL_UNREACHABLE",
          factionId: general.factionId,
          error: telemetry.error ?? "unknown",
        });
        factionOrders.push({ factionId: general.factionId, orders: [] });
        decisions.push({ factionId: general.factionId, reasoning: "", orders: [], diplomacy: null, telemetry });
        log(`  ${general.factionId}: unreachable after ${telemetry.attempts} attempt(s) — ${telemetry.error}`);
        continue;
      }

      factionOrders.push({ factionId: general.factionId, orders: decision.orders });
      decisions.push({ factionId: general.factionId, reasoning: decision.reasoning, orders: decision.orders, diplomacy: decision.diplomacy ?? null, telemetry });
      const fellBack = telemetry.fellBack ? ` (fell back to ${telemetry.servedModel})` : "";
      log(`  ${general.factionId}: ${decision.orders.length} order(s) in ${telemetry.latencyMs}ms${fellBack}`);
    }

    const result = resolveTurn(state, factionOrders, roster, config.gridSize);
    state = result.state;
    turns.push({ turn: state.turn, decisions, events: [...extraEvents, ...result.events], stateAfter: state, alliances: null });

    log(`turn ${state.turn}/${config.maxTurns} — ${state.squads.length} squad(s) left`);
    outcome = checkOutcome(state, config.maxTurns);

    // Checkpoint every turn. The provisional outcome lets a partial replay
    // still satisfy its own schema, so an interrupted file stays loadable.
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
