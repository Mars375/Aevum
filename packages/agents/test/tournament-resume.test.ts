import { describe, expect, it } from "vitest";
import { ReplaySchema, type GeneralConfig, type Replay } from "@abs/contracts";

/**
 * The tournament's resume rule, tested on its own terms.
 *
 * Battles have checkpointed and resumed for a while; the tournament did not. A
 * 12-rotation run interrupted at the ninth threw away nine completed rotations
 * and started over — several hundred calls against a free tier that collapses
 * around 350. The rule is small and the failure mode is expensive, so it is
 * worth pinning down exactly what counts as reusable.
 *
 * Reusable means the replay names THIS tournament: seed, ruleset, and the
 * roster that played. A season can change its roster while seeds and ruleset
 * stay put — gemma-4 and minimax were replaced by nemotron mid-season — and a
 * resume blind to that relabels old results under models that never played
 * them.
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

/** A replay identical to `base()` except for the roster changes made here. */
const withRoster = (change: (generals: GeneralConfig[]) => GeneralConfig[]): Replay =>
  base({
    manifest: {
      ...base().manifest,
      config: { ...base().manifest.config, generals: change(base().manifest.config.generals) },
    },
  } as Partial<Replay>);

/** Mirrors the roster rule in scripts/tournament.ts: order, primary, fallbacks. */
function sameRoster(actual: readonly GeneralConfig[], expected: readonly GeneralConfig[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((general, i) => {
      const wanted = expected[i]!;
      return (
        general.factionId === wanted.factionId &&
        general.model === wanted.model &&
        general.fallbacks.length === wanted.fallbacks.length &&
        general.fallbacks.every((fallback, j) => fallback === wanted.fallbacks[j])
      );
    })
  );
}

/** Mirrors the reload rule in scripts/tournament.ts. */
function reusable(
  raw: unknown,
  expectedSeed: number,
  expectedRuleset = "v2",
  expectedGenerals: readonly GeneralConfig[] = base().manifest.config.generals,
): boolean {
  const parsed = ReplaySchema.safeParse(raw);
  if (!parsed.success) return false;
  if (parsed.data.manifest.config.seed !== expectedSeed) return false;
  if (parsed.data.manifest.rulesetVersion !== expectedRuleset) return false;
  if (!sameRoster(parsed.data.manifest.config.generals, expectedGenerals)) return false;
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

  it("refuses a rotation from a different RULESET, even on a matching seed", () => {
    // The real case this guards: the earlier v1 tournament ran seeds 42-53 and
    // wrote rotation-0.json; the v2 tournament also starts at 42. Matching on
    // seed alone would have reloaded a v1 battle as a v2 result.
    const v1 = base({
      manifest: {
        ...base().manifest,
        rulesetVersion: "v1",
        config: { ...base().manifest.config, rulesetVersion: "v1" },
      },
    } as Partial<Replay>);
    expect(reusable(v1, 42, "v2")).toBe(false);
    expect(reusable(v1, 42, "v1")).toBe(true);
  });

  it("refuses a rotation played by a previous ROSTER, even on a matching seed and ruleset", () => {
    // The real case this guards: verdant's primary moved from gemma-4 to
    // nemotron mid-season while seeds 42+ and v2 stayed put. Matching on seed
    // and ruleset alone reloaded four old replays and relabelled their rows
    // under a primary that never played those turns.
    const previousRoster = withRoster((generals) =>
      generals.map((g) => (g.factionId === "verdant" ? { ...g, model: "google/gemma-4-26b-a4b-it:free" } : g)),
    );
    expect(reusable(previousRoster, 42)).toBe(false);
  });

  it("refuses a rotation whose fallback chain changed", () => {
    // Same primaries, different chains: who gets tried when a quota dies is
    // part of what the rotation measured too.
    const otherChain = withRoster((generals) =>
      generals.map((g) => (g.factionId === "crimson" ? { ...g, fallbacks: ["groq:groq/compound-mini"] } : g)),
    );
    expect(reusable(otherChain, 42)).toBe(false);
  });

  it("accepts a previous-roster replay once the EXPECTED roster matches it", () => {
    // Direction check: the roster comparison runs both ways through the same
    // rule, so rejecting is about identity, not about which side is "old".
    const previousRoster = withRoster((generals) =>
      generals.map((g) => (g.factionId === "verdant" ? { ...g, model: "google/gemma-4-26b-a4b-it:free" } : g)),
    );
    expect(reusable(previousRoster, 42, "v2", previousRoster.manifest.config.generals)).toBe(true);
  });

  it("refuses a file that fails its own schema", () => {
    expect(reusable({ manifest: { battleId: "broken" } }, 42)).toBe(false);
  });

  it("refuses a truncated file rather than guessing at it", () => {
    expect(reusable("{ not json", 42)).toBe(false);
  });
});
