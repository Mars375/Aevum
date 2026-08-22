import { describe, expect, it } from "vitest";
import legacyJournal from "./fixtures/journal-v0.2.0.json";
import {
  chronicle,
  fingerprint,
  JournalSchema,
  newJournal,
  newWorld,
  replay,
  RulingSchema,
  WorldSchema,
} from "../src/index.js";

describe("construction d'un journal", () => {
  it("refuse une origine w9 sans fabriquer un faux journal w8", () => {
    const w8 = newWorld(["crimson", "azure"], 42);
    const w9 = WorldSchema.parse({ ...w8, worldVersion: "w9" });

    expect(() => newJournal(w9)).toThrowError("cannot create a w8 journal from a w9 world");
    expect(JournalSchema.safeParse(newJournal(w8)).success).toBe(true);
  });
});

describe("compatibilite des journaux v0.2.0", () => {
  it("ajoute seulement des valeurs par defaut aux anciens journaux", () => {
    expect(legacyJournal.origin.civs.every((civ) => !("identity" in civ))).toBe(true);
    expect(legacyJournal.rulings.every((ruling) => !("context" in ruling) && !("service" in ruling) && !("consequenceRef" in ruling))).toBe(true);

    const journal = JournalSchema.parse(legacyJournal);
    expect(journal.origin.civs[0]!.identity).toEqual({
      displayName: "Crimson",
      values: [],
      origin: "",
    });
    expect(journal.rulings[0]).toMatchObject({
      context: [],
      service: null,
      consequenceRef: null,
    });
  });

  it("survit a un aller-retour JSON", () => {
    const parsed = JournalSchema.parse(legacyJournal);
    expect(JournalSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it("conserve la projection historique de la chronique et du rejeu", () => {
    const parsed = JournalSchema.parse(legacyJournal);
    const years = chronicle(parsed);
    expect(years.map(({ tick, world, rulings }) => ({
      tick,
      fingerprint: fingerprint(world),
      rulingTicks: rulings.map((ruling) => ruling.tick),
    }))).toEqual([
      { tick: 0, fingerprint: "22ced0e3", rulingTicks: [] },
      { tick: 1, fingerprint: "7ec18ecc", rulingTicks: [] },
      { tick: 2, fingerprint: "b6fac6ba", rulingTicks: [2] },
      { tick: 3, fingerprint: "76aefdfe", rulingTicks: [] },
    ]);

    const replayed = replay(parsed.origin, parsed.rulings, parsed.livedTo).world;
    expect(years.at(-1)!.world).toEqual(replayed);
    expect({ tick: replayed.tick, fingerprint: fingerprint(replayed) }).toEqual({ tick: 3, fingerprint: "76aefdfe" });
  });
});

describe("preuves d'une decision", () => {
  const ruling = {
    tick: 12,
    civ: "amber",
    kind: "BORDER",
    doctrine: { posture: "PRESSURE" },
    reason: "The frontier is closed.",
    model: "served/model",
    deferredBy: 1,
    context: ["No unclaimed land remains."],
    service: {
      requestedModel: "requested/model",
      servedModel: "served/model",
      provider: "groq",
      fallbackCount: 1,
      attempts: 3,
      latencyMs: 820,
      servedByFallback: true,
    },
    consequenceRef: "event-13-amber-1",
  };

  it("conserve toute la preuve de service", () => {
    expect(RulingSchema.parse(ruling)).toEqual(ruling);
  });

  it("refuse une annee negative", () => {
    expect(RulingSchema.safeParse({ ...ruling, tick: -1 }).success).toBe(false);
  });
});
