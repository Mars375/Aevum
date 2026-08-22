import { describe, expect, it } from "vitest";
import { chronicle, doctrineFingerprint, identityOf, newCiv, newJournal, newWorld } from "../src/index.js";

describe("les projections historiques restent deterministes", () => {
  it("donne aux evenements des identifiants byte-equivalents au rejeu", () => {
    const journal = newJournal(newWorld(["crimson", "azure"], 42));
    journal.livedTo = 60;
    const ids = () => chronicle(journal).flatMap((year) => year.events.map((event) => event.id));
    expect(JSON.stringify(ids())).toBe(JSON.stringify(ids()));
    expect(new Set(ids()).size).toBe(ids().length);
  });

  it("conserve une civilisation eteinte et son annee de chute", () => {
    const origin = newWorld(["crimson"], 42);
    origin.civs = [{
      ...newCiv("crimson"),
      population: 1,
      stock: { food: 0, timber: 0, ore: 0, wealth: 0 },
    }];
    const journal = newJournal(origin);
    journal.livedTo = 5;
    const years = chronicle(journal);
    const identity = identityOf("crimson", years);

    expect(identity).not.toBeNull();
    expect(identity!.fellOnTick).toBe(1);
    expect(years.at(-1)!.world.civs.some((civ) => civ.id === "crimson")).toBe(true);
  });
});

describe("l'empreinte de doctrine", () => {
  it("est stable et ne depend pas de l'echelle des parts", () => {
    const doctrine = newCiv("crimson").doctrine;
    expect(doctrineFingerprint(doctrine)).toBe(doctrineFingerprint({ ...doctrine }));
    expect(doctrineFingerprint(doctrine)).toBe(doctrineFingerprint({
      ...doctrine,
      farming: doctrine.farming * 10,
      forestry: doctrine.forestry * 10,
      mining: doctrine.mining * 10,
      trade: doctrine.trade * 10,
      military: doctrine.military * 10,
    }));
  });

  it("change quand une politique effective change", () => {
    const doctrine = newCiv("crimson").doctrine;
    expect(doctrineFingerprint(doctrine)).not.toBe(doctrineFingerprint({ ...doctrine, posture: "PRESSURE" }));
  });
});
