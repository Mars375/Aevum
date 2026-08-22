import type { FactionId } from "@abs/contracts";
import { DEFAULT_DOCTRINE, doctrineFingerprint, type Doctrine } from "@abs/world";
import { describe, expect, it } from "vitest";
import {
  buildLearningCurve,
  classifyLearningSignal,
  scoreConsequenceRecognition,
  scoreDoctrineCoherence,
  scoreErrorCorrection,
  scoreNarrativeFidelity,
  type LearningObservation,
} from "../src/index.js";

const doctrine = (patch: Partial<Doctrine> = {}): Doctrine => ({ ...DEFAULT_DOCTRINE, ...patch });

function observation(
  tick: number,
  patch: Partial<LearningObservation> = {},
): LearningObservation {
  const beforeDoctrine = patch.beforeDoctrine ?? doctrine({ posture: "PRESSURE", military: 0.2 });
  const afterDoctrine = patch.afterDoctrine ?? beforeDoctrine;
  return {
    modelId: "model/a",
    civId: "crimson" as FactionId,
    seed: 42,
    triggerEventIds: [],
    triggerEvents: [],
    decisionTick: tick,
    effectiveTick: tick,
    nextDecisionTick: null,
    decisionKind: "DRIFT",
    beforeDoctrineFingerprint: doctrineFingerprint(beforeDoctrine),
    afterDoctrineFingerprint: doctrineFingerprint(afterDoctrine),
    beforeDoctrine,
    afterDoctrine,
    objectiveDeltas: {},
    reason: "Maintain the standing doctrine.",
    context: [],
    attribution: "observed-after",
    eligibleForNumerator: true,
    service: {
      requestedModel: "model/a",
      servedModel: "model/a",
      provider: "fixture",
      selfServed: true,
      servedByFallback: false,
      attempts: 1,
      deferredBy: 0,
    },
    ...patch,
  };
}

const routed = (id: string, tick: number) => ({ id, tick, kind: "ROUTED" as const, detail: "assaut repousse" });

describe("les quatre series restent separees", () => {
  it("compte une correction apres un echec repete, pas une reussite generique", () => {
    const first = observation(10, {
      decisionKind: "ROUTED",
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
    });
    const correctedDoctrine = doctrine({ posture: "GUARD", military: 0.05 });
    const second = observation(20, {
      decisionKind: "ROUTED",
      triggerEventIds: ["r2"],
      triggerEvents: [routed("r2", 20)],
      afterDoctrine: correctedDoctrine,
      afterDoctrineFingerprint: doctrineFingerprint(correctedDoctrine),
      objectiveDeltas: { population: 100, food: 1000 },
    });

    expect(scoreErrorCorrection([first]).denominator).toBe(0);
    expect(scoreErrorCorrection([first, second])).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it("reconnait une consequence par un changement pertinent", () => {
    const changed = doctrine({ posture: "GUARD", military: 0.05 });
    const series = scoreConsequenceRecognition([observation(10, {
      decisionKind: "ROUTED",
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
      afterDoctrine: changed,
      afterDoctrineFingerprint: doctrineFingerprint(changed),
    })]);
    expect(series).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it("ne juge pas mauvaise une doctrine coherente uniquement parce que le monde perd", () => {
    const losing = observation(12, { objectiveDeltas: { population: -30, territory: -2 } });
    expect(scoreDoctrineCoherence([losing])).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it("abaisse la fidelite d'une affirmation factuelle absente du journal", () => {
    const unsupported = observation(15, { reason: "We were raided and lost the capital." });
    expect(scoreNarrativeFidelity([unsupported])).toMatchObject({ numerator: 0, denominator: 2, value: 0 });
  });
});

describe("protocole de courbe", () => {
  it("classe UNRANKED sous le seuil de service", () => {
    const fallback = observation(20, {
      service: {
        requestedModel: "model/a",
        servedModel: "model/fallback",
        provider: "fixture",
        selfServed: false,
        servedByFallback: true,
        attempts: 2,
        deferredBy: 0,
      },
      eligibleForNumerator: false,
    });
    const curve = buildLearningCurve([observation(10), fallback], { windowSize: 20, minimumServiceRate: 0.7 });
    expect(classifyLearningSignal(curve)).toBe("UNRANKED");
    expect(curve.unrankedReasons).toContain("SERVICE_RATE_BELOW_THRESHOLD");
  });

  it("refuse de fusionner des graines sans cle d'appariement explicite", () => {
    const observations = [observation(10), observation(10, { seed: 99 })];
    expect(() => buildLearningCurve(observations, { windowSize: 20 })).toThrow(/pairedRunKey/);
    expect(() => buildLearningCurve(observations, { windowSize: 20, pairedRunKey: "season-1-a" })).not.toThrow();
  });

  it("conserve l'historique d'erreur entre fenetres sans le partager entre graines", () => {
    const first = observation(19, {
      decisionKind: "ROUTED",
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 19)],
    });
    const changed = doctrine({ posture: "GUARD", military: 0.05 });
    const correction = observation(20, {
      decisionKind: "ROUTED",
      triggerEventIds: ["r2"],
      triggerEvents: [routed("r2", 20)],
      afterDoctrine: changed,
      afterDoctrineFingerprint: doctrineFingerprint(changed),
    });
    const otherSeed = observation(20, {
      seed: 99,
      decisionKind: "ROUTED",
      triggerEventIds: ["other"],
      triggerEvents: [routed("other", 20)],
    });
    const curve = buildLearningCurve([first, correction, otherSeed], {
      windowSize: 20,
      pairedRunKey: "paired",
    });
    expect(curve.series.errorCorrection[1]).toMatchObject({ numerator: 1, denominator: 1 });
  });
});
