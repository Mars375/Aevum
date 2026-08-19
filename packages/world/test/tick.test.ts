import { describe, expect, it } from "vitest";
import { applyRuling, disasterOn, newCiv, newWorld, season, shares, tickWorld, vowHeld, type World } from "../src/index.js";

const world = (over: Partial<World> = {}): World => ({
  ...newWorld(["crimson", "azure", "verdant", "amber"], 42),
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
    const a = shares({ farming: 1, forestry: 1, mining: 1, trade: 1, military: 1, posture: "GUARD", claim: "plain", vow: null, creed: "" });
    const b = shares({ farming: 40, forestry: 40, mining: 40, trade: 40, military: 40, posture: "GUARD", claim: "plain", vow: null, creed: "" });
    expect(a).toEqual(b);
  });

  it("une doctrine entierement a zero nourrit plutot que de tout bloquer", () => {
    expect(shares({ farming: 0, forestry: 0, mining: 0, trade: 0, military: 0, posture: "GUARD", claim: "plain", vow: null, creed: "" }).farming).toBe(1);
  });
});

describe("la terre n'est pas interchangeable", () => {
  const withLands = (lands: { plain: number; forest: number; hill: number; river: number }, doctrine = {}) =>
    world({
      civs: [
        {
          ...newCiv("crimson"),
          lands,
          territory: lands.plain + lands.forest + lands.hill + lands.river,
          doctrine: { ...newCiv("crimson").doctrine, ...doctrine },
        },
      ],
    });

  const oreGained = (lands: Parameters<typeof withLands>[0]) => {
    const before = withLands(lands, { farming: 0, forestry: 0, mining: 1, trade: 0 });
    return tickWorld(before).world.civs[0]!.stock.ore - before.civs[0]!.stock.ore;
  };

  it("mettre tout le monde a la mine sans colline ne produit presque rien", () => {
    expect(oreGained({ plain: 4, forest: 0, hill: 0, river: 0 })).toBeLessThan(
      oreGained({ plain: 0, forest: 0, hill: 4, river: 0 }) / 4,
    );
  });

  it("mais jamais exactement rien : un sol ingrat n'est pas une impasse", () => {
    const before = withLands({ plain: 4, forest: 0, hill: 0, river: 0 }, { farming: 0, mining: 1 });
    const after = tickWorld(before);
    expect(after.world.civs[0]!.stock.ore).toBeGreaterThan(before.civs[0]!.stock.ore);
  });

  it("les fleuves arrosent aussi les champs", () => {
    const farmers = { farming: 1, forestry: 0, mining: 0, trade: 0 };
    const plains = tickWorld(withLands({ plain: 2, forest: 2, hill: 0, river: 0 }, farmers));
    const rivers = tickWorld(withLands({ plain: 2, forest: 0, hill: 0, river: 2 }, farmers));
    expect(rivers.world.civs[0]!.stock.food).toBeGreaterThan(plains.world.civs[0]!.stock.food);
  });

  it("le monde ne cree ni ne detruit de terre", () => {
    let w = world();
    const total = (x: typeof w) =>
      x.civs.reduce((n, c) => n + c.lands.plain + c.lands.forest + c.lands.hill + c.lands.river, 0) +
      x.free.plain + x.free.forest + x.free.hill + x.free.river;
    const before = total(w);
    for (let i = 0; i < 300; i += 1) w = tickWorld(w).world;
    expect(total(w)).toBe(before);
  });

  it("le total des terres d'une civilisation reste egal a sa frontiere", () => {
    let w = world();
    for (let i = 0; i < 300; i += 1) {
      w = tickWorld(w).world;
      for (const c of w.civs) {
        expect(c.lands.plain + c.lands.forest + c.lands.hill + c.lands.river, `${c.id} an ${w.tick}`).toBe(c.territory);
      }
    }
  });

  it("une civilisation annexe d'abord ce qu'elle convoite", () => {
    let w = world({
      civs: [{ ...newCiv("crimson"), population: 400, stock: { food: 4000, timber: 4000, ore: 0, wealth: 100 }, doctrine: { ...newCiv("crimson").doctrine, claim: "hill" } }],
    });
    const before = w.civs[0]!.lands.hill;
    for (let i = 0; i < 6; i += 1) w = tickWorld(w).world;
    expect(w.civs[0]!.lands.hill).toBeGreaterThan(before);
  });

  it("et se rabat sur autre chose quand ce type est epuise", () => {
    let w = world({
      free: { plain: 5, forest: 0, hill: 0, river: 0 },
      civs: [{ ...newCiv("crimson"), population: 400, stock: { food: 4000, timber: 4000, ore: 0, wealth: 100 }, doctrine: { ...newCiv("crimson").doctrine, claim: "river" } }],
    });
    for (let i = 0; i < 4; i += 1) w = tickWorld(w).world;
    expect(w.civs[0]!.lands.plain).toBeGreaterThan(1);
    expect(w.civs[0]!.lands.river).toBe(1);
  });
});

describe("la terre convoitee porte aussi un risque", () => {
  const withLands = (lands: { plain: number; forest: number; hill: number; river: number }) => ({
    ...newCiv("crimson"),
    population: 300,
    territory: lands.plain + lands.forest + lands.hill + lands.river,
    lands,
    stock: { food: 3000, timber: 800, ore: 100, wealth: 200 },
  });

  const strikes = (civ: ReturnType<typeof withLands>, kind: string) => {
    let n = 0;
    for (let t = 0; t < 600; t += 1) if (disasterOn(civ, 42, t)?.kind === kind) n += 1;
    return n;
  };

  it("les fleuves nourrissent et noient : plus on en a, plus la crue vient", () => {
    expect(strikes(withLands({ plain: 4, forest: 0, hill: 0, river: 6 }), "flood")).toBeGreaterThan(
      strikes(withLands({ plain: 10, forest: 0, hill: 0, river: 0 }), "flood"),
    );
  });

  it("la peste vient de l'entassement, pas de la taille", () => {
    const crowded = { ...withLands({ plain: 2, forest: 0, hill: 0, river: 0 }), population: 900 };
    const roomy = { ...withLands({ plain: 20, forest: 0, hill: 0, river: 0 }), population: 900 };
    expect(strikes(crowded, "plague")).toBeGreaterThan(strikes(roomy, "plague"));
  });

  it("un desastre prend une part, jamais tout", () => {
    let w = world({ civs: [withLands({ plain: 2, forest: 4, hill: 0, river: 4 })] });
    for (let i = 0; i < 300; i += 1) {
      const before = w.civs[0]!.population;
      const stepped = tickWorld(w);
      if (stepped.events.some((e) => e.kind === "DISASTER")) {
        expect((before - stepped.world.civs[0]!.population) / before).toBeLessThanOrEqual(0.13);
      }
      w = stepped.world;
    }
  });

  it("et les memes desastres reviennent au meme tour, a chaque relecture", () => {
    const a = Array.from({ length: 200 }, (_, t) => disasterOn(withLands({ plain: 2, forest: 2, hill: 0, river: 4 }), 7, t)?.kind ?? "-");
    const b = Array.from({ length: 200 }, (_, t) => disasterOn(withLands({ plain: 2, forest: 2, hill: 0, river: 4 }), 7, t)?.kind ?? "-");
    expect(a).toEqual(b);
    expect(a.some((x) => x !== "-")).toBe(true);
  });
});

describe("un serment engage les successeurs", () => {
  const swearing = (floor: number, food = 2000) =>
    world({
      civs: [
        {
          ...newCiv("crimson"),
          stock: { food, timber: 100, ore: 50, wealth: 200 },
          doctrine: { ...newCiv("crimson").doctrine, vow: { metric: "food", floor, sworn: 0 } },
        },
      ],
    });

  it("tenu, rien ne se passe", () => {
    const after = tickWorld(swearing(100));
    expect(after.world.civs[0]!.vowBrokenOn).toBeNull();
    expect(after.events.some((e) => e.kind === "VOW_BROKEN")).toBe(false);
  });

  it("rompu, l'annee est inscrite et le monde le dit", () => {
    const after = tickWorld(swearing(5000));
    expect(after.world.civs[0]!.vowBrokenOn).toBe(1);
    expect(after.events.some((e) => e.kind === "VOW_BROKEN")).toBe(true);
  });

  it("un manquement n'est annonce qu'une fois, pas chaque annee", () => {
    let w = swearing(5000);
    let announced = 0;
    for (let i = 0; i < 40; i += 1) {
      const stepped = tickWorld(w);
      announced += stepped.events.filter((e) => e.kind === "VOW_BROKEN").length;
      w = stepped.world;
    }
    expect(announced).toBe(1);
  });

  it("jurer a nouveau efface le manquement de ses predecesseurs", () => {
    const broken = tickWorld(swearing(5000)).world;
    expect(broken.civs[0]!.vowBrokenOn).toBe(1);
    const after = applyRuling(broken, {
      tick: 2,
      civ: "crimson",
      kind: "VOW_BROKEN",
      doctrine: { vow: { metric: "soldiers", floor: 1, sworn: 2 } },
      reason: "je jure autre chose",
      model: null,
      deferredBy: 0,
    });
    expect(after.civs[0]!.vowBrokenOn).toBeNull();
  });

  it("mais une decision qui ne parle pas de serment laisse le verdict debout", () => {
    const broken = tickWorld(swearing(5000)).world;
    const after = applyRuling(broken, {
      tick: 2,
      civ: "crimson",
      kind: "FAMINE",
      doctrine: { farming: 0.9 },
      reason: "nourrir",
      model: null,
      deferredBy: 0,
    });
    expect(after.civs[0]!.vowBrokenOn).toBe(1);
  });

  it("sans serment, il n'y a rien a tenir", () => {
    expect(vowHeld(newCiv("crimson"))).toBeNull();
  });
});
