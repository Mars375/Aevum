import { describe, expect, it } from "vitest";
import type { BattleReport, Replay } from "@abs/contracts";
import { auditReport, factionMetrics, verifyClaim } from "@abs/engine";

/** A two-turn replay with known, deliberately asymmetric contents. */
const REPLAY = {
  manifest: {
    replayVersion: "1",
    rulesetVersion: "v1",
    contractsVersion: "2.0.0",
    battleId: "audit-fixture",
    createdAt: "2026-08-19T00:00:00.000Z",
    config: { rulesetVersion: "v1", seed: 1, maxTurns: 12, gridSize: 16, generals: [] },
  },
  initialState: { turn: 0, squads: [] },
  turns: [
    {
      turn: 1,
      // Crimson only moved. Azure only attacked.
      decisions: [
        {
          factionId: "crimson",
          reasoning: "",
          orders: [{ squadId: "crimson-melee", action: "MOVE", target: { x: 4, y: 2 } }],
          diplomacy: null,
          telemetry: {} as never,
        },
        {
          factionId: "azure",
          reasoning: "",
          orders: [{ squadId: "azure-melee", action: "ATTACK", target: { x: 4, y: 2 } }],
          diplomacy: null,
          telemetry: {} as never,
        },
      ],
      events: [{ type: "MOVE_OK", squadId: "crimson-melee", from: { x: 2, y: 2 }, to: { x: 4, y: 2 } }],
      stateAfter: { turn: 1, squads: [] },
      alliances: null,
    },
    {
      turn: 2,
      decisions: [
        {
          factionId: "crimson",
          reasoning: "",
          orders: [{ squadId: "crimson-melee", action: "ATTACK", target: { x: 6, y: 2 } }],
          diplomacy: null,
          telemetry: {} as never,
        },
      ],
      // Crimson loses a squad here; azure loses nothing.
      events: [
        { type: "ATTACK_HIT", squadId: "crimson-melee", targetSquadId: "azure-melee", at: { x: 6, y: 2 }, damage: 4 },
        { type: "SQUAD_DESTROYED", squadId: "crimson-ranged", factionId: "crimson" },
      ],
      stateAfter: { turn: 2, squads: [{ id: "crimson-melee", factionId: "crimson", archetype: "MELEE", position: { x: 4, y: 2 }, hp: 6, maxHp: 10 }] },
      alliances: null,
    },
  ],
  outcome: { kind: "VICTORY", winner: "crimson", winners: ["crimson"], reason: "", finalTurn: 2 },
  reports: [],
  audits: [],
} as unknown as Replay;

const claim = (turn: number, decision: string, result = "") => ({ turn, decision, reasoning: "", result });

describe("a truthful claim is verified", () => {
  it("confirms an advance the replay actually contains", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(1, "I advanced my melee squad toward their line"));
    expect(v.verdict).toBe("VERIFIED");
    expect(v.evidence).toContain("tour 1");
  });

  it("confirms an attack the replay actually contains", () => {
    expect(verifyClaim(REPLAY, "azure", claim(1, "I attacked their forward squad")).verdict).toBe("VERIFIED");
  });

  it("confirms a loss the replay actually contains", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(2, "I struck their line", "but I lost a squad doing it"));
    expect(v.verdict).toBe("VERIFIED");
  });
});

describe("an invented claim is caught", () => {
  it("catches an attack that never happened", () => {
    // Crimson only moved on turn 1.
    const v = verifyClaim(REPLAY, "crimson", claim(1, "I charged and destroyed their scout"));
    expect(v.verdict).toBe("CONTRADICTED");
    expect(v.evidence).toContain("une attaque");
  });

  it("catches a manoeuvre attributed to the wrong faction", () => {
    // The move on turn 1 was crimson's, not azure's.
    expect(verifyClaim(REPLAY, "azure", claim(1, "I repositioned to the flank")).verdict).toBe("CONTRADICTED");
  });

  it("catches a loss that was somebody else's", () => {
    // The squad destroyed on turn 2 was crimson's.
    const v = verifyClaim(REPLAY, "azure", claim(2, "I held the line", "and lost a squad to their charge"));
    expect(v.verdict).toBe("CONTRADICTED");
  });

  it("catches diplomacy in a battle that had none", () => {
    expect(verifyClaim(REPLAY, "crimson", claim(1, "I proposed an alliance to azure")).verdict).toBe("CONTRADICTED");
  });

  it("catches a half-true turn rather than letting it pass", () => {
    // The move is real; the attack on the same turn is not. Embellishment is
    // exactly what this check exists for.
    const v = verifyClaim(REPLAY, "crimson", claim(1, "I advanced and attacked their line"));
    expect(v.verdict).toBe("CONTRADICTED");
    expect(v.evidence).toContain("confirmé");
    expect(v.evidence).toContain("absent");
  });

  it("catches a turn that never existed", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(9, "I won it on turn nine"));
    expect(v.verdict).toBe("OUT_OF_RANGE");
    expect(v.evidence).toContain("2 tours");
  });
});

describe("vagueness is not lying", () => {
  it("marks an unfalsifiable claim UNSUPPORTED, never CONTRADICTED", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(1, "I considered the overall shape of the battle"));
    expect(v.verdict).toBe("UNSUPPORTED");
  });

  it("keeps vague claims out of the fidelity score entirely", () => {
    const report: BattleReport = {
      factionId: "crimson",
      model: null,
      summary: "",
      claims: [claim(1, "I advanced"), claim(1, "I reflected on the situation"), claim(2, "I attacked")],
    };
    const audit = auditReport(REPLAY, report);
    // Two checkable claims, both true. The prose one neither helps nor hurts.
    expect(audit.fidelity).toBe(1);
    expect(audit.claims.filter((c) => c.verdict === "UNSUPPORTED")).toHaveLength(1);
  });
});

describe("fidelity scoring", () => {
  it("halves the score when half the checkable claims are false", () => {
    const report: BattleReport = {
      factionId: "crimson",
      model: null,
      summary: "",
      claims: [claim(1, "I advanced"), claim(1, "I attacked their scout")],
    };
    expect(auditReport(REPLAY, report).fidelity).toBe(0.5);
  });

  it("returns null rather than zero when nothing was checkable", () => {
    // "We could not tell" and "it lied" are different findings; averaging them
    // would let an unfalsifiable report look like a dishonest one.
    const report: BattleReport = { factionId: "crimson", model: null, summary: "", claims: [claim(1, "I thought hard")] };
    expect(auditReport(REPLAY, report).fidelity).toBeNull();
  });

  it("returns null for a report with no claims at all", () => {
    expect(auditReport(REPLAY, { factionId: "amber", model: null, summary: "rien", claims: [] }).fidelity).toBeNull();
  });
});

describe("metrics come from the replay, never from the report", () => {
  it("counts what crimson actually did", () => {
    const m = factionMetrics(REPLAY, "crimson");
    expect(m).toMatchObject({
      turnsPlayed: 2,
      ordersIssued: 2,
      attacksLanded: 1,
      squadsLost: 1,
      squadsDestroyed: 0,
      finalHp: 6,
      survived: true,
    });
  });

  it("does not credit azure with crimson's kill", () => {
    const m = factionMetrics(REPLAY, "azure");
    expect(m.attacksLanded).toBe(0);
    expect(m.squadsLost).toBe(0);
    // Crimson's destroyed squad counts as an enemy loss from azure's side.
    expect(m.squadsDestroyed).toBe(1);
    expect(m.survived).toBe(false);
  });

  it("is unaffected by anything the report says", () => {
    const boastful: BattleReport = {
      factionId: "azure",
      model: null,
      summary: "A crushing victory, five squads destroyed.",
      claims: [claim(1, "I destroyed five squads")],
    };
    const audit = auditReport(REPLAY, boastful);
    expect(audit.metrics.squadsDestroyed).toBe(1);
    expect(audit.fidelity).toBe(1); // it did attack on turn 1, so the claim checks out
  });
});

/**
 * The verifier is bilingual because a report may be written in either language.
 * A first pass matched English only, and a French report claiming a charge that
 * never happened came back UNSUPPORTED — blind to the exact lie it exists for.
 */
describe("the verifier understands French as well as English", () => {
  it("confirms a truthful French claim", () => {
    expect(verifyClaim(REPLAY, "crimson", claim(1, "J'ai avancé mon escouade de mêlée")).verdict).toBe("VERIFIED");
    expect(verifyClaim(REPLAY, "azure", claim(1, "J'ai attaqué leur ligne")).verdict).toBe("VERIFIED");
  });

  it("catches a French claim that invents a charge", () => {
    // Crimson only moved on turn 1. This is the case the English-only pass missed.
    const v = verifyClaim(REPLAY, "crimson", claim(1, "J'ai chargé et détruit deux escouades ennemies"));
    expect(v.verdict).toBe("CONTRADICTED");
  });

  it("catches a French claim that invents diplomacy", () => {
    expect(verifyClaim(REPLAY, "azure", claim(2, "J'ai proposé une alliance à verdant")).verdict).toBe("CONTRADICTED");
  });

  it("recognises a French loss", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(2, "J'ai frappé leur ligne", "mais j'ai perdu une escouade"));
    expect(v.verdict).toBe("VERIFIED");
  });

  it("still treats French prose with no action as unverifiable, not false", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(1, "J'ai pesé le rapport de force général"));
    expect(v.verdict).toBe("UNSUPPORTED");
  });
});

/**
 * "Position gagnée sans perte" mentions a loss and claims the opposite.
 * Reading that as a claimed loss marked an honest report as contradicted —
 * the worst failure available to a check meant to separate honesty from
 * embellishment.
 */
describe("a denial is not a claim", () => {
  it("does not read 'sans perte' as claiming a loss", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(1, "J'ai avancé mes éclaireurs", "Position gagnée sans perte"));
    expect(v.verdict).toBe("VERIFIED");
  });

  it("does not read 'without losses' as claiming a loss either", () => {
    expect(verifyClaim(REPLAY, "crimson", claim(1, "I advanced", "ground taken without losses")).verdict).toBe("VERIFIED");
  });

  it("does not read 'aucune attaque' as claiming an attack", () => {
    const v = verifyClaim(REPLAY, "crimson", claim(1, "Je me suis déplacé, aucune attaque n'était possible"));
    expect(v.verdict).toBe("VERIFIED");
  });

  it("still catches a real loss claim in the same sentence shape", () => {
    // The negator must not swallow a genuine admission further along.
    const v = verifyClaim(REPLAY, "azure", claim(2, "Sans hésiter j'ai tenu, et j'ai perdu une escouade"));
    expect(v.verdict).toBe("CONTRADICTED"); // azure lost nothing on turn 2
  });

  it("writes evidence in grammatical French, singular and plural", () => {
    const one = verifyClaim(REPLAY, "crimson", claim(1, "J'ai chargé leur ligne"));
    expect(one.evidence).toContain("ne contient pas une attaque pour crimson");

    const many = verifyClaim(REPLAY, "azure", claim(2, "J'ai attaqué", "et j'ai perdu une escouade"));
    expect(many.evidence).toContain("ni une attaque ni une perte");
  });
});
