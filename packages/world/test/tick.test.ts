import { describe, expect, it } from "vitest";
import { newCiv, season, shares, tickWorld, WORLD_VERSION, type World } from "../src/index.js";

const world = (over: Partial<World> = {}): World => ({
  worldVersion: WORLD_VERSION,
  tick: 0,
  seed: 42,
  civs: [newCiv("crimson"), newCiv("azure"), newCiv("verdant"), newCiv("amber")],
  ...over,
});

const run = (n: number, w = world()) => {
  let cur = w;
  for (let i = 0; i < n; i += 1) cur = tickWorld(cur).world;
  return cur;
};

describe("le tick est pur et deterministe", () => {
  it("ne modifie jamais le monde recu", () => {
    const before = world();
    const snapshot = JSON.stringify(before);
    tickWorld(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("donne le meme resultat pour la meme entree, cent tours plus tard", () => {
    expect(JSON.stringify(run(100))).toBe(JSON.stringify(run(100)));
  });

  it("ne depend pas de l'ordre des civilisations dans le tableau", () => {
    const a = run(50, world());
    const b = run(50, world({ civs: [...world().civs].reverse() }));
    expect(JSON.stringify(a.civs)).toBe(JSON.stringify(b.civs));
  });
});

describe("les stocks ne partent jamais en negatif", () => {
  it("une famine tue des gens plutot que de creuser un grenier negatif", () => {
    const starving = world({
      civs: [{ ...newCiv("crimson"), stock: { food: 0, timber: 0, ore: 0, wealth: 100 }, population: 200 }],
    });
    const after = tickWorld(starving);
    expect(after.world.civs[0]!.stock.food).toBe(0);
    expect(after.world.civs[0]!.population).toBeLessThan(200);
    expect(after.events.some((e) => e.kind === "STARVED")).toBe(true);
  });

  it("un tresor vide fait deserter plutot que de descendre sous zero", () => {
    const broke = world({
      civs: [{ ...newCiv("crimson"), soldiers: 200, stock: { food: 5000, timber: 0, ore: 0, wealth: 0 } }],
    });
    const after = tickWorld(broke);
    expect(after.world.civs[0]!.stock.wealth).toBe(0);
    expect(after.world.civs[0]!.soldiers).toBeLessThan(200);
  });

  it("une population a zero eteint la civilisation, qui reste dans le monde", () => {
    const doomed = world({
      civs: [{ ...newCiv("crimson"), population: 1, stock: { food: 0, timber: 0, ore: 0, wealth: 0 } }],
    });
    const after = tickWorld(doomed);
    expect(after.world.civs[0]!.fellOnTick).toBe(1);
    expect(after.world.civs).toHaveLength(1);
  });

  it("une civilisation eteinte ne bouge plus jamais", () => {
    const dead = world({ civs: [{ ...newCiv("crimson"), fellOnTick: 3 }] });
    expect(JSON.stringify(run(20, dead).civs[0])).toBe(JSON.stringify(dead.civs[0]));
  });
});

describe("les saisons sont deterministes", () => {
  it("le meme monde vit les memes annees, a chaque relecture", () => {
    expect(season(42, 17)).toBe(season(42, 17));
  });

  it("deux graines donnent des annees differentes", () => {
    const a = Array.from({ length: 40 }, (_, t) => season(42, t));
    const b = Array.from({ length: 40 }, (_, t) => season(43, t));
    expect(a).not.toEqual(b);
  });

  it("une recolte reste dans des bornes vivables", () => {
    for (let t = 0; t < 2000; t += 1) {
      const h = season(7, t);
      expect(h).toBeGreaterThanOrEqual(0.55);
      expect(h).toBeLessThanOrEqual(1.35);
    }
  });
});

describe("les parts de doctrine sont normalisees", () => {
  it("accepte n'importe quelle echelle", () => {
    const a = shares({ farming: 1, forestry: 1, mining: 1, trade: 1, military: 1, creed: "" });
    const b = shares({ farming: 40, forestry: 40, mining: 40, trade: 40, military: 40, creed: "" });
    expect(a).toEqual(b);
  });

  it("une doctrine entierement a zero nourrit plutot que de tout bloquer", () => {
    expect(shares({ farming: 0, forestry: 0, mining: 0, trade: 0, military: 0, creed: "" }).farming).toBe(1);
  });
});
