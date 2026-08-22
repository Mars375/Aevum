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
    runId: "run-42",
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
      evidence: "KNOWN",
      servedModel: "model/a",
      provider: "fixture",
      selfServed: true,
      servedByFallback: false,
      fallbackCount: 0,
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

  it("ne compte pas deux references au meme evenement comme un echec repete", () => {
    const first = observation(10, {
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
    });
    const correctedDoctrine = doctrine({ posture: "GUARD", military: 0.05 });
    const repeatedReference = observation(20, {
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
      afterDoctrine: correctedDoctrine,
      afterDoctrineFingerprint: doctrineFingerprint(correctedDoctrine),
    });

    expect(scoreErrorCorrection([first, repeatedReference])).toMatchObject({
      numerator: 0,
      denominator: 0,
      value: null,
    });
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

  it("exclut une observation ineligible du numerateur, denominateur et Wilson", () => {
    const changed = doctrine({ posture: "GUARD", military: 0.05 });
    const ineligible = observation(10, {
      eligibleForNumerator: false,
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
      afterDoctrine: changed,
      afterDoctrineFingerprint: doctrineFingerprint(changed),
    });
    expect(scoreConsequenceRecognition([ineligible])).toMatchObject({
      numerator: 0,
      denominator: 0,
      value: null,
      sampleCount: 1,
      uncertainty: { lower: null, upper: null },
    });
  });

  it("ne fabrique pas une consequence negative depuis le type de decision", () => {
    expect(scoreConsequenceRecognition([observation(10, { decisionKind: "ROUTED" })]).denominator).toBe(0);
  });

  it("ne juge pas mauvaise une doctrine coherente uniquement parce que le monde perd", () => {
    const losing = observation(12, { objectiveDeltas: { population: -30, territory: -2 } });
    expect(scoreDoctrineCoherence([losing])).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
  });

  it("abaisse la fidelite d'une affirmation factuelle absente du journal", () => {
    const unsupported = observation(15, { reason: "We were raided and lost the capital." });
    expect(scoreNarrativeFidelity([unsupported])).toMatchObject({ numerator: 0, denominator: 2, value: 0 });
  });

  it("associe chaque direction a la clause qui nomme la ressource", () => {
    const afterDoctrine = doctrine({ farming: 0.5, military: 0.1 });
    const coherent = observation(16, {
      reason: "Increase farming and reduce military.",
      afterDoctrine,
      afterDoctrineFingerprint: doctrineFingerprint(afterDoctrine),
    });
    expect(scoreDoctrineCoherence([coherent])).toMatchObject({ numerator: 1, denominator: 1 });
  });

  it.each([
    ["Increase farming and forestry.", doctrine({ farming: 0.5, forestry: 0.1 })],
    ["Reduce military and trade.", doctrine({ military: 0.1, trade: 0.2 })],
  ])("propage la direction aux ressources coordonnees: %s", (reason, afterDoctrine) => {
    const contradictory = observation(17, {
      reason,
      afterDoctrine,
      afterDoctrineFingerprint: doctrineFingerprint(afterDoctrine),
    });
    expect(scoreDoctrineCoherence([contradictory])).toMatchObject({ numerator: 0, denominator: 1 });
  });
});

describe("protocole de courbe", () => {
  it("classe UNRANKED sous le seuil de service", () => {
    const fallback = observation(20, {
      service: {
        requestedModel: "model/a",
        evidence: "KNOWN",
        servedModel: "model/fallback",
        provider: "fixture",
        selfServed: false,
        servedByFallback: true,
        fallbackCount: 1,
        attempts: 2,
        deferredBy: 0,
      },
      eligibleForNumerator: false,
    });
    const curve = buildLearningCurve([observation(10), fallback], { windowSize: 20, minimumServiceRate: 0.7 });
    expect(classifyLearningSignal(curve)).toBe("UNRANKED");
    expect(curve.unrankedReasons).toContain("SERVICE_RATE_BELOW_THRESHOLD");
  });

  it("publie le service absent comme inconnu, jamais comme 100 %", () => {
    const unknown = observation(10, {
      eligibleForNumerator: false,
      service: {
        evidence: "UNKNOWN",
        requestedModel: "model/a",
        servedModel: null,
        provider: null,
        selfServed: false,
        servedByFallback: false,
        fallbackCount: null,
        attempts: 0,
        deferredBy: 0,
      },
    });
    const curve = buildLearningCurve([unknown], { windowSize: 20 });
    expect(curve).toMatchObject({ serviceRate: null, fallbackRate: null, unknownServiceCount: 1 });
    expect(curve.unrankedReasons).toContain("SERVICE_EVIDENCE_UNKNOWN");
    expect(classifyLearningSignal(curve)).toBe("UNRANKED");
  });

  it("inclut les preuves inconnues dans le denominateur des taux partiels", () => {
    const unknown = observation(20, {
      eligibleForNumerator: false,
      service: {
        evidence: "UNKNOWN", requestedModel: "model/a", servedModel: null, provider: null,
        selfServed: false, servedByFallback: false, fallbackCount: null, attempts: 0, deferredBy: 0,
      },
    });
    const curve = buildLearningCurve([observation(10), unknown], { windowSize: 20 });
    expect(curve).toMatchObject({ serviceRate: 0.5, fallbackRate: 0, unknownServiceCount: 1 });
  });

  it("refuse de fusionner des graines sans cle d'appariement explicite", () => {
    const observations = [observation(10), observation(10, { seed: 99, runId: "run-99" })];
    expect(() => buildLearningCurve(observations, { windowSize: 20 })).toThrow(/pairedRunKey/);
    expect(() => buildLearningCurve(observations, {
      windowSize: 20,
      pairedRunKey: "season-1-a",
      pairedRunIds: ["run-42", "run-99"],
    })).not.toThrow();
  });

  it("compte deux courses distinctes qui partagent la meme graine", () => {
    const observations = [observation(10), observation(10, { runId: "run-duplicate" })];
    const curve = buildLearningCurve(observations, {
      windowSize: 20,
      pairedRunKey: "duplicate-seed",
      pairedRunIds: ["run-42", "run-duplicate"],
    });
    expect(curve.series.doctrineCoherence[0]!.uncertainty).toMatchObject({ seedCount: 1, runCount: 2 });
  });

  it("refuse un groupe apparie dont une course declaree est absente", () => {
    const observations = [observation(10), observation(10, { runId: "run-99" })];
    expect(() => buildLearningCurve(observations, {
      windowSize: 20,
      pairedRunKey: "incomplete",
      pairedRunIds: ["run-42", "run-99", "run-missing"],
    })).toThrow(/complete paired group/);
  });

  it("refuse aussi un modele observe dans une seule course d'un groupe attendu", () => {
    expect(() => buildLearningCurve([observation(10)], {
      windowSize: 20,
      pairedRunKey: "incomplete-single",
      pairedRunIds: ["run-42", "run-missing"],
    })).toThrow(/complete paired group/);
  });

  it("ne laisse pas un fallback amorcer l'historique de correction du modele", () => {
    const fallback = observation(10, {
      eligibleForNumerator: false,
      triggerEventIds: ["r1"],
      triggerEvents: [routed("r1", 10)],
      service: {
        evidence: "KNOWN", requestedModel: "model/a", servedModel: "model/b", provider: "fixture",
        selfServed: false, servedByFallback: true, fallbackCount: 1, attempts: 2, deferredBy: 0,
      },
    });
    const own = observation(20, {
      triggerEventIds: ["r2"],
      triggerEvents: [routed("r2", 20)],
    });
    expect(scoreErrorCorrection([fallback, own]).denominator).toBe(0);
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
      runId: "run-99",
      decisionKind: "ROUTED",
      triggerEventIds: ["other"],
      triggerEvents: [routed("other", 20)],
    });
    const curve = buildLearningCurve([first, correction, otherSeed], {
      windowSize: 20,
      pairedRunKey: "paired",
      pairedRunIds: ["run-42", "run-99"],
    });
    expect(curve.series.errorCorrection[1]).toMatchObject({ numerator: 1, denominator: 1 });
  });
});
