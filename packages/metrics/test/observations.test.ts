import { describe, expect, it } from "vitest";
import { applyRuling, lifeEvent, newWorld, type Ruling, type Year } from "@abs/world";
import { buildObservations } from "../src/index.js";

const service = {
  requestedModel: "model/a",
  servedModel: "model/a",
  provider: "fixture",
  fallbackCount: 0,
  attempts: 1,
  latencyMs: 4,
  servedByFallback: false,
};

describe("construction des observations", () => {
  it("relie la decision a l'etat suivant et a la prochaine decision de la civilisation", () => {
    const origin = newWorld(["crimson", "azure"], 42);
    const atOne = structuredClone(origin);
    atOne.tick = 1;
    const before = atOne.civs.find((civ) => civ.id === "crimson")!;
    before.population = 90;
    before.stock.food = 80;
    const afterDecision = structuredClone(atOne);
    afterDecision.civs.find((civ) => civ.id === "crimson")!.doctrine.farming = 0.7;
    const atTwo = structuredClone(afterDecision);
    atTwo.tick = 2;
    atTwo.civs.find((civ) => civ.id === "crimson")!.population = 92;
    atTwo.civs.find((civ) => civ.id === "crimson")!.stock.food = 95;
    const famine = lifeEvent({ tick: 1, civ: "crimson", kind: "STARVED", detail: "famine, 10 morts" }, 0);
    const rulings: Ruling[] = [
      {
        tick: 1,
        civ: "crimson",
        kind: "FAMINE",
        doctrine: { farming: 0.7 },
        reason: "The famine requires more farming.",
        model: "model/a",
        deferredBy: 0,
        context: ["famine en cours"],
        service,
        consequenceRef: famine.id,
      },
      {
        tick: 2,
        civ: "crimson",
        kind: "SURPLUS",
        doctrine: { trade: 0.3 },
        reason: "Trade the surplus.",
        model: "model/a",
        deferredBy: 0,
        context: [],
        service,
        consequenceRef: null,
      },
    ];
    const years: Year[] = [
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: 1, world: afterDecision, events: [famine], rulings: [rulings[0]!] },
      { tick: 2, world: atTwo, events: [], rulings: [rulings[1]!] },
    ];

    const observation = buildObservations(years, rulings, "run-42")[0]!;
    expect(observation.nextDecisionTick).toBe(2);
    expect(observation.objectiveDeltas).toMatchObject({ population: 2, food: 15 });
    expect(observation).toMatchObject({ runId: "run-42", triggerEventIds: [famine.id] });
    expect(observation.attribution).toBe("observed-after");
    expect(observation.beforeDoctrine.farming).not.toBe(observation.afterDoctrine.farming);
  });

  it("garde les appels differes et retentes dans le service sans les rendre eligibles", () => {
    const origin = newWorld(["crimson"], 7);
    const atTwo = structuredClone(origin);
    atTwo.tick = 2;
    const ruling: Ruling = {
      tick: 1,
      civ: "crimson",
      kind: "DRIFT",
      doctrine: {},
      reason: "Hold.",
      model: "model/b",
      deferredBy: 1,
      context: [],
      service: { ...service, servedModel: "model/b", requestedModel: "model/b", attempts: 2, fallbackCount: 1 },
      consequenceRef: null,
    };

    const [observation] = buildObservations([
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: 2, world: atTwo, events: [], rulings: [ruling] },
    ], [ruling], "run-7");

    expect(observation).toMatchObject({ effectiveTick: 2, eligibleForNumerator: false });
    expect(observation!.service).toMatchObject({ attempts: 2, deferredBy: 1 });
  });

  it.each([
    ["reporte", 1, 1],
    ["retente", 0, 2],
  ])("exclut independamment un appel %s", (_label, deferredBy, attempts) => {
    const origin = newWorld(["crimson"], 71);
    const effectiveTick = 1 + deferredBy;
    const effective = structuredClone(origin);
    effective.tick = effectiveTick;
    const ruling: Ruling = {
      tick: 1, civ: "crimson", kind: "DRIFT", doctrine: {}, reason: "Hold.", model: "model/a",
      deferredBy, context: [], service: { ...service, attempts }, consequenceRef: null,
    };
    const [observation] = buildObservations([
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: effectiveTick, world: effective, events: [], rulings: [ruling] },
    ], [ruling], `run-${_label}`);
    expect(observation!.eligibleForNumerator).toBe(false);
  });

  it.each([
    ["service absente", "model/a", null],
    ["modele absent", null, null],
    ["modele servi different", "model/a", { ...service, servedModel: "model/b" }],
  ])("traite %s comme ineligible", (_label, model, evidence) => {
    const origin = newWorld(["crimson"], 8);
    const atOne = structuredClone(origin);
    atOne.tick = 1;
    const ruling: Ruling = {
      tick: 1,
      civ: "crimson",
      kind: "DRIFT",
      doctrine: {},
      reason: "Hold.",
      model,
      deferredBy: 0,
      context: [],
      service: evidence,
      consequenceRef: null,
    };

    const [observation] = buildObservations([
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: 1, world: atOne, events: [], rulings: [ruling] },
    ], [ruling], "run-evidence");

    expect(observation!.eligibleForNumerator).toBe(false);
    expect(observation!.service.selfServed).toBe(false);
    expect(observation!.service.evidence).toBe(evidence === null ? "UNKNOWN" : "KNOWN");
    expect(observation!.modelId).toBe(evidence === null ? null : "model/a");
  });

  it("ne joint que la consequence referencee, visible pour la civilisation au tick demande", () => {
    const origin = newWorld(["crimson", "azure"], 9);
    const atOne = structuredClone(origin);
    atOne.tick = 1;
    const atTwo = structuredClone(atOne);
    atTwo.tick = 2;
    const remembered = lifeEvent({ tick: 0, civ: "crimson", kind: "HARD_YEAR", detail: "annee dure" }, 0);
    const famine = lifeEvent({ tick: 1, civ: "crimson", kind: "STARVED", detail: "famine" }, 0);
    const unrelated = lifeEvent({ tick: 1, civ: "crimson", kind: "RAIDED", detail: "raid" }, 1);
    const later = lifeEvent({ tick: 2, civ: "crimson", kind: "ROUTED", detail: "route" }, 0);
    const otherCiv = lifeEvent({ tick: 1, civ: "azure", kind: "STARVED", detail: "autre famine" }, 2);
    const ruling = (consequenceRef: string | null): Ruling => ({
      tick: 1,
      civ: "crimson",
      kind: "FAMINE",
      doctrine: {},
      reason: "Observe.",
      model: "model/a",
      deferredBy: 1,
      context: [],
      service,
      consequenceRef,
    });
    const rulings = [ruling(famine.id), ruling(remembered.id), ruling(null), ruling(later.id), ruling(otherCiv.id)];
    const observations = buildObservations([
      { tick: 0, world: origin, events: [remembered], rulings: [] },
      { tick: 1, world: atOne, events: [famine, unrelated, otherCiv], rulings: [] },
      { tick: 2, world: atTwo, events: [later], rulings },
    ], rulings, "run-events");

    expect(observations.map((entry) => entry.triggerEventIds)).toEqual([[famine.id], [remembered.id], [], [], []]);
  });

  it("reconstruit les transitions depuis la derniere annee disponible meme si la chronique est sparse", () => {
    const origin = newWorld(["crimson"], 11);
    const first: Ruling = {
      tick: 2, civ: "crimson", kind: "FAMINE", doctrine: { farming: 0.7 }, reason: "Increase farming.",
      model: "model/a", deferredBy: 0, context: [], service, consequenceRef: null,
    };
    const second: Ruling = {
      tick: 2, civ: "crimson", kind: "DRIFT", doctrine: { farming: 0.4 }, reason: "Reduce farming.",
      model: "model/a", deferredBy: 0, context: [], service, consequenceRef: null,
    };
    const final = structuredClone(origin);
    final.tick = 2;
    const afterBoth = applyRuling(applyRuling(final, first), second);
    const observations = buildObservations([
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: 2, world: afterBoth, events: [], rulings: [first, second] },
    ], [first, second], "run-sparse");

    expect(observations[0]!.beforeDoctrine.farming).toBe(origin.civs[0]!.doctrine.farming);
    expect(observations[0]!.afterDoctrine.farming).toBe(0.7);
    expect(observations[1]!.beforeDoctrine.farming).toBe(0.7);
    expect(observations[1]!.afterDoctrine.farming).toBe(0.4);
  });

  it("reconstruit chaque transition lorsque deux rulings mordent au meme tick", () => {
    const origin = newWorld(["crimson"], 10);
    const first: Ruling = {
      tick: 1, civ: "crimson", kind: "FAMINE", doctrine: { farming: 0.7 }, reason: "Increase farming.",
      model: "model/a", deferredBy: 0, context: [], service, consequenceRef: null,
    };
    const second: Ruling = {
      tick: 1, civ: "crimson", kind: "DRIFT", doctrine: { farming: 0.4 }, reason: "Reduce farming.",
      model: "model/a", deferredBy: 0, context: [], service, consequenceRef: null,
    };
    const stepped = structuredClone(origin);
    stepped.tick = 1;
    const final = applyRuling(applyRuling(stepped, first), second);
    const observations = buildObservations([
      { tick: 0, world: origin, events: [], rulings: [] },
      { tick: 1, world: final, events: [], rulings: [first, second] },
    ], [first, second], "run-sequential");

    expect(observations[0]!.beforeDoctrine.farming).toBe(origin.civs[0]!.doctrine.farming);
    expect(observations[0]!.afterDoctrine.farming).toBe(0.7);
    expect(observations[1]!.beforeDoctrine.farming).toBe(0.7);
    expect(observations[1]!.afterDoctrine.farming).toBe(0.4);
  });
});
