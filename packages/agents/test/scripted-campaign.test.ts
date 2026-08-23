import { describe, expect, it } from "vitest";
import fixture from "./fixtures/aevum-season-1-campaign.json";
import {
  DEFAULT_GENERALS,
  ScriptedRulerProvider,
  liveWorld,
  type ScriptedRuling,
} from "../src/index.js";
import {
  chronicle,
  fingerprint,
  identityOf,
  isOver,
  living,
  newJournal,
  newWorld,
  replay,
  turningPoints,
} from "@abs/world";

const factions = DEFAULT_GENERALS.map((general) => general.factionId);
const survivor = fixture.survivor as (typeof factions)[number];

function provider(): ScriptedRulerProvider {
  return new ScriptedRulerProvider((general, point) => {
    if (general.factionId === fixture.survivor) return fixture.survivorDoctrine as ScriptedRuling;
    return (point.tick < fixture.transitionTick ? fixture.beforeTransition : fixture.afterTransition) as ScriptedRuling;
  });
}

async function run() {
  const journal = newJournal(newWorld(factions, fixture.seed));
  const result = await liveWorld(replay(journal.origin, [], 0).world, {
    journal,
    generals: DEFAULT_GENERALS,
    provider: provider(),
    ticks: fixture.ticks,
  });
  journal.fingerprint = fingerprint(result.world);
  return { journal, result };
}

describe("la campagne scriptée Aevum Season 1", () => {
  it("produit une ère complète, historique et reliée à ses événements", async () => {
    const { journal, result } = await run();
    const years = chronicle(journal);
    const turnings = turningPoints(years);

    expect(result.closed).toBe(true);
    expect(isOver(result.world)).toBe(true);
    expect(living(result.world).map((civ) => civ.id)).toEqual([survivor]);
    expect(identityOf(survivor, years)?.fellOnTick).toBeNull();
    expect(result.world.civs.some((civ) => identityOf(civ, years)?.fellOnTick !== null)).toBe(true);
    expect(turnings.some((turning) => turning.sourceEventId !== undefined)).toBe(true);

    const eventIds = new Set(years.flatMap((year) => year.events.map((event) => event.id)));
    const chained = journal.rulings.filter((ruling) => ruling.consequenceRef !== null && ruling.consequenceRef !== undefined);
    expect(chained.length).toBeGreaterThan(0);
    expect(chained.every((ruling) => eventIds.has(ruling.consequenceRef!))).toBe(true);
    expect(chained.every((ruling) => (ruling.context?.length ?? 0) > 0)).toBe(true);
    expect(chained.every((ruling) => ruling.service === null)).toBe(true);

    const replayed = replay(journal.origin, journal.rulings, journal.livedTo).world;
    expect(fingerprint(replayed)).toBe(journal.fingerprint);
    expect(fingerprint(replayed)).toBe(fingerprint(result.world));
  });

  it("reproduit le même journal et le même fingerprint", async () => {
    const first = await run();
    const second = await run();
    expect(second.journal).toEqual(first.journal);
    expect(second.journal.fingerprint).toBe(first.journal.fingerprint);
  });
});
