import { describe, expect, it } from "vitest";
import {
  DRIFT_TICKS,
  MIN_GAP_TICKS,
  detectDecisions,
  foodRunway,
  newCiv,
  newJournal,
  replay,
  tickWorld,
  WORLD_VERSION,
  type World,
} from "../src/index.js";

const world = (over: Partial<World> = {}): World => ({
  worldVersion: WORLD_VERSION,
  tick: 0,
  seed: 42,
  civs: [newCiv("crimson")],
  ...over,
});

describe("W1 — un point de decision ne depend que de l'etat et des evenements", () => {
  it("les memes entrees donnent les memes points", () => {
    const w = world({ civs: [newCiv("crimson"), newCiv("azure")] });
    const a = tickWorld(w);
    expect(detectDecisions(a.world, a.events)).toEqual(detectDecisions(a.world, a.events));
  });
});

describe("W2 — une civilisation eteinte n'est jamais consultee", () => {
  it("meme quand tout va mal chez elle", () => {
    const dead = world({
      civs: [{ ...newCiv("crimson"), fellOnTick: 2, ticksSinceDecision: 999, stock: { food: 0, timber: 0, ore: 0, wealth: 0 } }],
    });
    expect(detectDecisions(dead, [])).toEqual([]);
  });
});

describe("W3 — chaque point porte ce qui l'a declenche", () => {
  it("la famine cite les vivres et la population", () => {
    const hungry = world({
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: MIN_GAP_TICKS, stock: { food: 10, timber: 0, ore: 0, wealth: 50 } }],
    });
    const point = detectDecisions(hungry, [])[0]!;
    expect(point.kind).toBe("FAMINE");
    expect(point.evidence.length).toBeGreaterThan(0);
    expect(point.evidence.join(" ")).toMatch(/vivres|habitants/);
  });
});

describe("une seule question par civilisation et par tour", () => {
  it("la plus urgente l'emporte quand plusieurs se declenchent", () => {
    const w = world({
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: DRIFT_TICKS + 5, stock: { food: 0, timber: 0, ore: 0, wealth: 0 } }],
    });
    const points = detectDecisions(w, [{ tick: 0, civ: "crimson", kind: "STARVED", detail: "famine" }]);
    expect(points).toHaveLength(1);
    expect(points[0]!.kind).toBe("FAMINE");
  });

  it("la derive finit par reveiller un dirigeant que rien n'a inquiete", () => {
    const calm = world({
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: DRIFT_TICKS, stock: { food: 400, timber: 100, ore: 50, wealth: 200 } }],
    });
    expect(detectDecisions(calm, [])[0]!.kind).toBe("DRIFT");
  });

  it("un dirigeant tout juste consulte n'est pas rappele pour derive", () => {
    const fresh = world({
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: 0, stock: { food: 400, timber: 100, ore: 50, wealth: 200 } }],
    });
    expect(detectDecisions(fresh, []).find((p) => p.kind === "DRIFT")).toBeUndefined();
  });
});

describe("un dirigeant qui vient de repondre n'est pas rappele pour la meme chose", () => {
  // Mesure a l'origine de la regle : sans elle, 500 tours coutaient 1576 appels
  // au lieu de 92, la famine se redeclenchant chaque tour sur un etat deja traite.
  const hungry = (ticksSinceDecision: number) =>
    world({ civs: [{ ...newCiv("crimson"), ticksSinceDecision, stock: { food: 60, timber: 0, ore: 0, wealth: 50 } }] });

  it("se tait tant que le delai n'est pas ecoule", () => {
    expect(detectDecisions(hungry(1), [])).toEqual([]);
  });

  it("reparle une fois le delai passe", () => {
    expect(detectDecisions(hungry(MIN_GAP_TICKS), [])).toHaveLength(1);
  });

  it("mais une famine qui tue deja passe outre le delai", () => {
    const dying = hungry(1);
    const points = detectDecisions(dying, [{ tick: 0, civ: "crimson", kind: "STARVED", detail: "famine" }]);
    expect(points).toHaveLength(1);
    expect(points[0]!.kind).toBe("FAMINE");
  });
});

describe("l'autonomie alimentaire previent avant les morts, pas apres", () => {
  it("une reserve courte declenche une famine sans qu'un seul habitant soit mort", () => {
    const thin = world({
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: MIN_GAP_TICKS, stock: { food: 100, timber: 0, ore: 0, wealth: 50 } }],
    });
    expect(foodRunway(thin.civs[0]!)).toBeLessThan(2.5);
    expect(detectDecisions(thin, [])[0]!.kind).toBe("FAMINE");
  });

  it("une civilisation sans bouche a nourrir a une autonomie infinie plutot qu'une division par zero", () => {
    expect(foodRunway({ ...newCiv("crimson"), population: 0, soldiers: 0 })).toBe(Infinity);
  });
});

describe("W4 — rejouer le journal reproduit l'etat", () => {
  it("sans aucune decision", () => {
    const origin = world({ civs: [newCiv("crimson"), newCiv("azure")] });
    let direct = origin;
    for (let i = 0; i < 60; i += 1) direct = tickWorld(direct).world;
    expect(replay(origin, [], 60).world).toEqual(direct);
  });

  it("avec des decisions, sans stocker un seul etat intermediaire", () => {
    const origin = world({ civs: [newCiv("crimson")] });
    const journal = newJournal(origin);
    journal.rulings.push({
      tick: 10,
      civ: "crimson",
      kind: "DRIFT",
      doctrine: { farming: 0.8, military: 0.2 },
      reason: "nourrir avant d'armer",
      model: null,
    });
    const a = replay(journal.origin, journal.rulings, 50).world;
    const b = replay(journal.origin, journal.rulings, 50).world;
    expect(a).toEqual(b);
    // La decision a bien mordu : la doctrine du tour 50 est celle du tour 10.
    expect(a.civs[0]!.doctrine.farming).toBe(0.8);
    // Et le journal reste minuscule : une entree, pas cinquante etats.
    expect(journal.rulings).toHaveLength(1);
  });
});

describe("un monde reprend la ou il en etait", () => {
  // Trouve en faisant tourner le monde, pas en le relisant : la reprise se
  // deduisait des decisions, et un monde de 120 ans sans aucune decision
  // repartait silencieusement de l'an 0.
  it("le journal dit jusqu'ou le monde a vecu, meme sans une seule decision", () => {
    const journal = newJournal(world({ civs: [newCiv("crimson")] }));
    const lived = replay(journal.origin, journal.rulings, 120).world;
    journal.livedTo = lived.tick;

    const resumed = replay(journal.origin, journal.rulings, journal.livedTo).world;
    expect(resumed.tick).toBe(120);
    expect(resumed).toEqual(lived);
  });

  it("reprendre puis continuer donne le meme monde que vivre d'une traite", () => {
    const origin = world({ civs: [newCiv("crimson"), newCiv("azure")] });
    const inOneGo = replay(origin, [], 200).world;
    const halfway = replay(origin, [], 90).world;
    const resumed = replay(halfway, [], 200).world;
    expect(resumed).toEqual(inOneGo);
  });
});
