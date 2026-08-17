/**
 * Liveness check for the container and for a fresh clone. Exits non-zero on the
 * first failure so `docker healthcheck` and CI can both use it verbatim.
 *
 * Reaching OpenRouter is checked but never required: the player and the engine
 * are useful with the network down, and a hard failure here would make the
 * container flap whenever the free tier rate-limits us.
 */
import { FACTION_IDS, GRID_SIZE, ReplaySchema } from "@abs/contracts";
import { checkOutcome, createInitialState, resolveTurn } from "@abs/engine";

const checks: Array<[string, () => Promise<string> | string]> = [
  [
    "contracts load",
    () => {
      ReplaySchema.parse.length; // touch the schema so a broken build fails here
      return `${FACTION_IDS.length} factions, grid ${GRID_SIZE}`;
    },
  ],
  [
    "engine resolves a turn",
    () => {
      const state = createInitialState(FACTION_IDS);
      const roster = state.squads.map((s) => s.id);
      const next = resolveTurn(
        state,
        FACTION_IDS.map((factionId) => ({ factionId, orders: [] })),
        roster,
        GRID_SIZE,
      );
      if (next.state.turn !== 1) throw new Error(`expected turn 1, got ${next.state.turn}`);
      if (next.state.squads.length !== 8) throw new Error(`expected 8 squads, got ${next.state.squads.length}`);
      if (checkOutcome(next.state, 12) !== null) throw new Error("battle ended on turn 1");
      return `turn ${next.state.turn}, ${next.state.squads.length} squads`;
    },
  ],
  [
    "openrouter reachable (advisory)",
    async () => {
      if (!process.env.OPENROUTER_API_KEY) return "skipped, no OPENROUTER_API_KEY";
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          signal: AbortSignal.timeout(10_000),
        });
        return res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} (advisory, not fatal)`;
      } catch (err) {
        return `unreachable: ${(err as Error).message} (advisory, not fatal)`;
      }
    },
  ],
];

let failed = false;
for (const [name, check] of checks) {
  try {
    console.log(`ok    ${name} — ${await check()}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL  ${name} — ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
