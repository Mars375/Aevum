import { describe, expect, it } from "vitest";
import {
  chronicle,
  fingerprint,
  DRIFT_TICKS,
  MIN_GAP_TICKS,
  STANDING_GAP_TICKS,
  detectDecisions,
  foodRunway,
  newCiv,
  census,
  isOver,
  living,
  newJournal,
  newWorld,
  raidOn,
  replay,
  tickWorld,
  type World,
} from "../src/index.js";

/** The board is built for exactly the civilisations a fixture asks for. */
const world = (over: Partial<World> = {}): World => {
  const ids = over.civs?.map((c) => c.id) ?? ["crimson"];
  const base = newWorld(ids, 42);
  return census({ ...base, ...over, board: over.board ?? base.board });
};

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
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: STANDING_GAP_TICKS, stock: { food: 10, timber: 0, ore: 0, wealth: 50 } }],
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
    // Depuis w4, ce qu'une civilisation peut faire depend du lieu ou elle est
    // fondee : celle-ci nait sur une colline, donc labourer y leve un MISMATCH,
    // plus urgent que la derive. On lui donne une plaine pour ne mesurer que
    // la derive.
    const base = world({
      civs: [
        {
          ...newCiv("crimson"),
          ticksSinceDecision: DRIFT_TICKS,
          stock: { food: 400, timber: 100, ore: 50, wealth: 200 },
          doctrine: { ...newCiv("crimson").doctrine, farming: 1, forestry: 0, mining: 0, trade: 0, military: 0 },
        },
      ],
    });
    const calm = census({
      ...base,
      board: base.board.map((p) => (p.owner === "crimson" ? { ...p, kind: "plain" as const } : p)),
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
    // Une penurie qui dure est une situation, pas une alerte : elle attend le
    // delai long. Une famine qui tue, elle, passe outre (test suivant).
    expect(detectDecisions(hungry(MIN_GAP_TICKS), [])).toEqual([]);
    expect(detectDecisions(hungry(STANDING_GAP_TICKS), [])).toHaveLength(1);
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
      civs: [{ ...newCiv("crimson"), ticksSinceDecision: STANDING_GAP_TICKS, stock: { food: 100, timber: 0, ore: 0, wealth: 50 } }],
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
      deferredBy: 0,
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

describe("les bandits pressent sans decapiter", () => {
  const rich = (over: Partial<ReturnType<typeof newCiv>> = {}) => ({
    ...newCiv("crimson"),
    population: 400,
    soldiers: 0,
    stock: { food: 2000, timber: 100, ore: 100, wealth: 4000 },
    ...over,
  });

  it("un pillage coute une part, jamais tout", () => {
    let w = world({ civs: [rich()] });
    let worstLoss = 0;
    for (let i = 0; i < 200; i += 1) {
      const before = w.civs[0]!.population;
      const stepped = tickWorld(w);
      if (stepped.events.some((e) => e.kind === "RAIDED")) {
        worstLoss = Math.max(worstLoss, (before - stepped.world.civs[0]!.population) / before);
      }
      w = stepped.world;
    }
    // Une civilisation ne perd jamais plus d'une fraction de ses gens en un
    // seul raid : les bandits entretiennent la pression, ils ne la terminent pas.
    expect(worstLoss).toBeLessThanOrEqual(0.06);
  });

  it("un pillage ne peut pas eteindre une civilisation a lui seul", () => {
    let w = world({ civs: [rich({ population: 3 })] });
    for (let i = 0; i < 100; i += 1) w = tickWorld(w).world;
    // Elle peut mourir de faim, jamais du seul passage des bandits.
    const events = tickWorld(world({ civs: [rich({ population: 3 })] })).events;
    expect(events.some((e) => e.kind === "RAIDED" && e.detail.includes("3 morts"))).toBe(false);
  });

  it("ils viennent pour la richesse, pas pour la misere", () => {
    const poor = { ...newCiv("crimson"), stock: { food: 200, timber: 0, ore: 0, wealth: 0 } };
    const count = (civ: typeof poor) => {
      let w = world({ civs: [civ] });
      let n = 0;
      for (let i = 0; i < 300; i += 1) {
        const stepped = tickWorld(w);
        if (stepped.events.some((e) => e.kind === "RAIDED" || e.kind === "REPELLED")) n += 1;
        w = { ...stepped.world, civs: [{ ...civ, ticksSinceDecision: 0 }] }; // etat fige
      }
      return n;
    };
    expect(count(rich())).toBeGreaterThan(count(poor));
  });

  it("les memes bandits reviennent au meme tour, a chaque relecture", () => {
    const a = tickWorld(world({ civs: [rich()] })).events.map((e) => e.kind);
    const b = tickWorld(world({ civs: [rich()] })).events.map((e) => e.kind);
    expect(a).toEqual(b);
  });
});

describe("le monde s'arrete quand il ne reste qu'une civilisation", () => {
  it("quatre vivantes : il continue", () => {
    expect(isOver(world({ civs: [newCiv("crimson"), newCiv("azure"), newCiv("verdant"), newCiv("amber")] }))).toBe(false);
  });

  it("une seule vivante : il est fini", () => {
    const w = world({
      civs: [newCiv("crimson"), { ...newCiv("azure"), fellOnTick: 4 }, { ...newCiv("verdant"), fellOnTick: 9 }, { ...newCiv("amber"), fellOnTick: 12 }],
    });
    expect(isOver(w)).toBe(true);
    expect(living(w)).toHaveLength(1);
  });

  it("aucune vivante : il est fini aussi, personne n'a gagne", () => {
    expect(isOver(world({ civs: [{ ...newCiv("crimson"), fellOnTick: 1 }] }))).toBe(true);
  });
});

describe("la pression monte avec l'age du monde, pas la severite d'un pillage", () => {
  const rich = () => ({
    ...newCiv("crimson"),
    population: 400,
    soldiers: 0,
    stock: { food: 2000, timber: 100, ore: 100, wealth: 4000 },
  });

  it("un monde vieux est visite plus souvent", () => {
    const visits = (from: number) => {
      let n = 0;
      for (let t = from; t < from + 400; t += 1) if (raidOn(rich(), 42, t).strength > 0) n += 1;
      return n;
    };
    expect(visits(800)).toBeGreaterThan(visits(0));
  });

  it("mais un pillage ne prend jamais plus que son plafond, quel que soit l'age", () => {
    for (const tick of [0, 500, 2000, 10_000]) {
      for (let t = tick; t < tick + 50; t += 1) {
        // Le plafond est absolu : c'est ce qui garantit qu'un village ne se
        // fait pas raser d'un coup, meme dans un monde tres vieux.
        expect(raidOn(rich(), 42, t).strength).toBeLessThanOrEqual(1);
      }
    }
  });

  it("une civilisation sans rien a prendre est laissee tranquille", () => {
    const destitute = { ...newCiv("crimson"), population: 300, stock: { food: 100, timber: 0, ore: 0, wealth: 0 } };
    // Trouve en mesurant : sans cette regle, la pression ecrasait les quatre
    // civilisations a vingt ames et les y maintenait indefiniment.
    for (let t = 0; t < 500; t += 1) expect(raidOn(destitute, 42, t).strength).toBe(0);
  });
})

describe("la chronique recompose le monde annee par annee", () => {
  const journal = () => {
    const j = newJournal(world({ civs: [newCiv("crimson"), newCiv("azure")] }));
    j.livedTo = 40;
    j.rulings.push({
      tick: 12,
      civ: "crimson",
      kind: "FAMINE",
      doctrine: { farming: 0.9, creed: "nourrir avant tout" },
      reason: "les greniers etaient vides",
      model: "test/model",
      deferredBy: 3,
    });
    return j;
  };

  it("une entree par annee vecue, l'origine comprise", () => {
    expect(chronicle(journal())).toHaveLength(41);
  });

  it("la derniere annee est exactement celle qu'un rejeu donne", () => {
    const years = chronicle(journal());
    const j = journal();
    expect(years[years.length - 1]!.world).toEqual(replay(j.origin, j.rulings, j.livedTo).world);
  });

  it("chaque decision est rangee dans l'annee ou elle a MORDU", () => {
    // Celle-ci a ete posee en l'an 12 et repondue trois ans plus tard : elle
    // apparait donc en l'an 15, avec l'etat du monde qu'elle a produit. Le
    // retard voyage avec elle, pour que le lecteur puisse dire les deux.
    const years = chronicle(journal());
    expect(years.find((y) => y.tick === 12)!.rulings).toHaveLength(0);

    const year = years.find((y) => y.tick === 15)!;
    expect(year.rulings).toHaveLength(1);
    expect(year.rulings[0]!.reason).toBe("les greniers etaient vides");
    expect(year.rulings[0]!.deferredBy).toBe(3);
    expect(year.world.civs.find((c) => c.id === "crimson")!.doctrine.creed).toBe("nourrir avant tout");
  });
});

describe("W4 tient aussi quand une decision a ete differee", () => {
  /**
   * Le monde 'monde' se declarait amber eteinte en l'an 194 alors qu'un rejeu
   * de son propre journal la montrait vivante en 290 : quatre decisions
   * avaient attendu un modele, et le rejeu les appliquait a l'annee ou elles
   * avaient ete POSEES et non a celle ou elles avaient ete REPONDUES.
   */
  const origin = () => world({ civs: [newCiv("crimson"), newCiv("azure")] });

  const deferred = (by: number) => [
    {
      tick: 10,
      civ: "crimson" as const,
      kind: "FAMINE" as const,
      doctrine: { farming: 0.95, forestry: 0.05, mining: 0, trade: 0, military: 0 },
      reason: "tout au ble",
      model: null,
      deferredBy: by,
    },
  ];

  it("une decision differee mord l'annee ou elle a ete repondue", () => {
    const start = origin();
    const late = replay(start, deferred(6), 40).world;
    const onTime = replay(start, deferred(0), 40).world;
    // Six annees de doctrine differente ne peuvent pas donner le meme monde.
    expect(JSON.stringify(late.civs)).not.toBe(JSON.stringify(onTime.civs));
  });

  it("et rejouer deux fois donne toujours le meme monde", () => {
    const start = origin();
    expect(replay(start, deferred(6), 40).world).toEqual(replay(start, deferred(6), 40).world);
  });

  it("la chronique et le rejeu s'accordent, decision differee comprise", () => {
    const j = newJournal(origin());
    j.livedTo = 40;
    j.rulings.push(...deferred(6));
    const years = chronicle(j);
    expect(years[years.length - 1]!.world).toEqual(replay(j.origin, j.rulings, j.livedTo).world);
  });
});

describe("un monde prouve qu'il se rejoue comme il a ete vecu", () => {
  /**
   * Le monde 'monde' a atteint l'an 290 en portant une decision sur une
   * invasion en l'an 199, alors qu'un rejeu placait sa premiere terre perdue en
   * 227 : un defaut de rejeu avait ete corrige entre deux seances, et chaque
   * reprise repartait d'une histoire qui n'avait pas eu lieu. Rien ne s'en
   * plaignait. Ceci s'en plaint.
   */
  const lived = (ticks: number) => {
    let w = world({ civs: [newCiv("crimson"), newCiv("azure")] });
    for (let i = 0; i < ticks; i += 1) w = tickWorld(w).world;
    return w;
  };

  it("la meme histoire donne la meme empreinte", () => {
    expect(fingerprint(lived(50))).toBe(fingerprint(lived(50)));
  });

  it("une annee de plus la change", () => {
    expect(fingerprint(lived(50))).not.toBe(fingerprint(lived(51)));
  });

  it("un seul lieu qui change de main la change aussi", () => {
    const w = lived(40);
    const moved = { ...w, board: w.board.map((p, i) => (i === 0 ? { ...p, owner: "azure" as const } : p)) };
    expect(fingerprint(moved)).not.toBe(fingerprint(w));
  });

  it("mais elle ne depend pas de l'ordre du tableau des civilisations", () => {
    const w = lived(40);
    expect(fingerprint({ ...w, civs: [...w.civs].reverse() })).toBe(fingerprint(w));
  });
})
