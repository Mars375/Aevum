import { describe, expect, it } from "vitest";
import { chronicle, JournalSchema, newJournal, newWorld, RulingSchema } from "../src/index.js";

const legacyJournal = () => {
  const raw = JSON.parse(JSON.stringify(newJournal(newWorld(["crimson", "azure"], 42)))) as Record<string, any>;
  raw.livedTo = 3;
  raw.rulings = [
    {
      tick: 2,
      civ: "crimson",
      kind: "DRIFT",
      doctrine: { posture: "TRADE" },
      reason: "Seek exchange.",
      model: "model/a",
      deferredBy: 0,
    },
  ];
  for (const civ of raw.origin.civs) delete civ.identity;
  return raw;
};

describe("compatibilite des journaux v0.2.0", () => {
  it("ajoute seulement des valeurs par defaut aux anciens journaux", () => {
    const journal = JournalSchema.parse(legacyJournal());
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
    const parsed = JournalSchema.parse(legacyJournal());
    expect(JournalSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it("produit les memes annees sans champs de preuve", () => {
    const parsed = JournalSchema.parse(legacyJournal());
    const explicit = JournalSchema.parse({
      ...legacyJournal(),
      rulings: legacyJournal().rulings.map((r: object) => ({
        ...r,
        context: [],
        service: null,
        consequenceRef: null,
      })),
    });
    expect(chronicle(parsed)).toEqual(chronicle(explicit));
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
