import { describe, expect, it } from "vitest";
import { ReplaySchema, type Replay } from "@abs/contracts";

/**
 * The tournament's resume rule, tested on its own terms.
 *
 * Battles have checkpointed and resumed for a while; the tournament did not. A
 * 12-rotation run interrupted at the ninth threw away nine completed rotations
 * and started over — several hundred calls against a free tier that collapses
 * around 350. The rule is small and the failure mode is expensive, so it is
 * worth pinning down exactly what counts as reusable.
 */

const base = (overrides: Partial<Replay> = {}): Replay =>
  ({
    manifest: {
      replayVersion: "1",
      rulesetVersion: "v2",
      contractsVersion: "2.0.0",
      battleId: "tournament-r0",
      createdAt: "2026-08-19T00:00:00.000Z",
      // Exactly four, because BattleConfigSchema requires it — a constraint
      // this test tripped over, which is the schema doing its job.
      config: {
        rulesetVersion: "v2",
        seed: 42,
        maxTurns: 12,
        gridSize: 16,
        generals: (["crimson", "azure", "verdant", "amber"] as const).map((factionId) => ({
          factionId,
          displayName: factionId,
          model: "m:free",
          fallbacks: [],
        })),
      },
    },
    initialState: { turn: 0, squads: [] },
    turns: [],
    outcome: { kind: "VICTORY", winner: "crimson", winners: ["crimson"], reason: "crimson l'emporte.", finalTurn: 12 },
    reports: [],
    audits: [],
    ...overrides,
  }) as unknown as Replay;

/** Mirrors the reload rule in scripts/tournament.ts. */
function reusable(raw: unknown, expectedSeed: number): boolean {
  const parsed = ReplaySchema.safeParse(raw);
  if (!parsed.success) return false;
  if (parsed.data.manifest.config.seed !== expectedSeed) return false;
  if (parsed.data.outcome.reason.includes("interrompue")) return false;
  return true;
}

describe("what a resumed tournament may reuse", () => {
  it("reuses a rotation that finished", () => {
    expect(reusable(base(), 42)).toBe(true);
  });

  it("refuses a partial checkpoint — half a battle is not a result", () => {
    const partial = base({
      outcome: {
        kind: "DRAW",
        winner: null,
        winners: [],
        reason: "Bataille en cours, interrompue apres le tour 7.",
        finalTurn: 7,
      },
    } as Partial<Replay>);
    expect(reusable(partial, 42)).toBe(false);
  });

  it("refuses a rotation from a different tournament", () => {
    // Same filename, different seed: reusing it would silently mix two runs.
    expect(reusable(base(), 99)).toBe(false);
  });

  it("refuses a file that fails its own schema", () => {
    expect(reusable({ manifest: { battleId: "broken" } }, 42)).toBe(false);
  });

  it("refuses a truncated file rather than guessing at it", () => {
    expect(reusable("{ not json", 42)).toBe(false);
  });
});
