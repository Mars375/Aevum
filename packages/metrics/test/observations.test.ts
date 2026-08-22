import { describe, expect, it } from "vitest";
import { lifeEvent, newWorld, type Ruling, type Year } from "@abs/world";
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

    const observation = buildObservations(years, rulings)[0]!;
    expect(observation.nextDecisionTick).toBe(2);
    expect(observation.objectiveDeltas).toMatchObject({ population: 2, food: 15 });
    expect(observation.triggerEventIds).toEqual([famine.id]);
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
    ], [ruling]);

    expect(observation).toMatchObject({ effectiveTick: 2, eligibleForNumerator: false });
    expect(observation!.service).toMatchObject({ attempts: 2, deferredBy: 1 });
  });
});
