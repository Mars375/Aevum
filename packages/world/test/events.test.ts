import { MAX_MEMORY_ENTRIES } from "@abs/contracts";
import { describe, expect, it } from "vitest";
import { eventId, memoryFor, newJournal, newWorld, type TickEvent } from "../src/index.js";

describe("les evenements du monde ont une identite stable", () => {
  const event: TickEvent = {
    tick: 7,
    civ: "crimson",
    kind: "STARVED",
    detail: "famine, 3 morts",
  };

  it("le meme fait garde le meme identifiant", () => {
    expect(eventId(event, 7, "crimson")).toBe(eventId({ ...event }, 7, "crimson"));
  });

  it("un autre fait ne partage pas son identifiant", () => {
    expect(eventId(event, 7, "crimson")).not.toBe(eventId({ ...event, detail: "famine, 4 morts" }, 7, "crimson"));
    // Regression: these two details collide under the former 32-bit FNV id.
    expect(eventId({ ...event, detail: "detail-17grus6-1f3x" }, 7, "crimson")).not.toBe(
      eventId({ ...event, detail: "detail-kd7bto-1xgz" }, 7, "crimson"),
    );
  });
});

describe("la memoire est une projection bornee du moteur", () => {
  const journal = () => {
    const value = newJournal(newWorld(["crimson", "azure"], 42));
    value.livedTo = 80;
    value.rulings.push({
      tick: 12,
      civ: "crimson",
      kind: "FAMINE",
      doctrine: { creed: "This text came from a ruler." },
      reason: "A model-authored reason must not become an engine fact.",
      model: "test/model",
      deferredBy: 0,
    });
    return value;
  };

  it("est identique pour le meme journal", () => {
    expect(JSON.stringify(memoryFor(journal(), "crimson", 80, MAX_MEMORY_ENTRIES))).toBe(
      JSON.stringify(memoryFor(journal(), "crimson", 80, MAX_MEMORY_ENTRIES)),
    );
  });

  it("ne contient que des faits emis par le moteur et respecte le plafond", () => {
    const memory = memoryFor(journal(), "crimson", 80, MAX_MEMORY_ENTRIES);
    expect(memory.length).toBeLessThanOrEqual(MAX_MEMORY_ENTRIES);
    expect(memory.every((entry) => entry.attribution === "engine-only")).toBe(true);
    expect(JSON.stringify(memory)).not.toContain("model-authored");
    expect(JSON.stringify(memory)).not.toContain("This text came from a ruler");
  });

  it("respecte un plafond plus petit et l'annee demandee", () => {
    const memory = memoryFor(journal(), "crimson", 30, 2);
    expect(memory.length).toBeLessThanOrEqual(2);
    expect(memory.every((entry) => entry.tick <= 30)).toBe(true);
  });

  it("ne permet pas a l'appelant de depasser le plafond global", () => {
    expect(memoryFor(journal(), "crimson", 80, MAX_MEMORY_ENTRIES + 100)).toHaveLength(MAX_MEMORY_ENTRIES);
    expect(memoryFor(journal(), "crimson", 80, Number.POSITIVE_INFINITY)).toHaveLength(MAX_MEMORY_ENTRIES);
  });
});
