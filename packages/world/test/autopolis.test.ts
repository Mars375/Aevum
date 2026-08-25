import { describe, expect, it } from "vitest";
import {
  AUTOPOLIS_RULESET,
  MAX_SHORT_MEMORY,
  acceptAutopolisProposal,
  newAutopolisJournal,
  newAutopolisWorld,
  replayAutopolis,
  stepAutopolis,
  succeedAutopolisLeader,
  type AutopolisDecisionProposal,
} from "../src/index.js";

const proposal = (world: ReturnType<typeof newAutopolisWorld>, patch: Partial<AutopolisDecisionProposal> = {}): AutopolisDecisionProposal => ({
  pointTick: world.tick + 1,
  civ: "crimson",
  leaderId: world.civs.find((civ) => civ.id === "crimson")!.identity.leader.id,
  kind: "SURPLUS",
  reasoning: "nourrir la cite",
  doctrinePatch: { farming: 0.8, military: 0.2 },
  ...patch,
});

describe("Autopolis — progression pure et déterministe", () => {
  it("fait progresser les ressources et déverrouille un progrès sans effet caché", () => {
    const origin = newAutopolisWorld(7, ["crimson"], { totalLand: 4, population: 20, food: 300 });
    const after = stepAutopolis(origin).world;
    expect(after.tick).toBe(1);
    expect(after.civs[0]!.stock.food).toBeGreaterThanOrEqual(0);
    expect(after.civs[0]!.advances).toContain("irrigation");
    expect(stepAutopolis(origin)).toEqual(stepAutopolis(origin));
  });

  it("refuse un patch hors bornes sans modifier le monde", () => {
    const world = newAutopolisWorld(7, ["crimson"]);
    const before = JSON.stringify(world);
    const result = acceptAutopolisProposal(world, proposal(world, { doctrinePatch: { farming: 9 } }));
    expect(result.ruling).toBeNull();
    expect(result.events.some((event) => event.kind === "PROPOSAL_REJECTED")).toBe(true);
    expect(JSON.stringify(result.world)).toBe(before);
  });

  it("journalise et rejoue exactement une doctrine acceptée", () => {
    const origin = newAutopolisWorld(9, ["crimson", "azure"]);
    const accepted = acceptAutopolisProposal(origin, proposal(origin));
    expect(accepted.ruling).not.toBeNull();
    const journal = newAutopolisJournal(origin);
    journal.entries.push({ type: "ruling", ruling: accepted.ruling! });
    const replay = replayAutopolis(journal, 1);
    expect(replay.world).toEqual(accepted.world);
    expect(replay.events).toEqual(accepted.events);
  });

  it("transmet l'artefact immuable au successeur et borne la mémoire", () => {
    const origin = newAutopolisWorld(11, ["crimson"]);
    const ruling = acceptAutopolisProposal(origin, proposal(origin, {
      proposedDoctrineText: "La réserve avant la gloire.",
      proposedClaims: ["la réserve protège la cité"],
    })).ruling!;
    const after = acceptAutopolisProposal(origin, proposal(origin, {
      proposedDoctrineText: "La réserve avant la gloire.",
      proposedClaims: ["la réserve protège la cité"],
    })).world;
    const succession = succeedAutopolisLeader(after, "crimson");
    expect(succession.world.civs[0]!.identity.leader.predecessorId).toBe(after.civs[0]!.identity.leader.id);
    expect(succession.world.civs[0]!.identity.leader.doctrine.text).toBe("La réserve avant la gloire.");
    expect(succession.world.civs[0]!.identity.lineage).toContain(ruling!.acceptedDoctrineArtifactId);
    expect(succession.world.civs[0]!.identity.leader.shortMemory.length).toBeLessThanOrEqual(MAX_SHORT_MEMORY);
  });

  it("ne consomme pas une proposition pour une civilisation éteinte", () => {
    const origin = newAutopolisWorld(13, ["crimson"], { population: 1, food: 0 });
    const after = stepAutopolis(origin).world;
    expect(after.civs[0]!.alive).toBe(false);
    const result = acceptAutopolisProposal(after, proposal(after));
    expect(result.ruling).toBeNull();
    expect(result.events.some((event) => event.kind === "PROPOSAL_REJECTED")).toBe(true);
  });

  it("conserve le ruleset Autopolis hors des replays w8", () => {
    expect(newAutopolisWorld(1, ["crimson"]).ruleset).toBe(AUTOPOLIS_RULESET);
  });

  it("sépare le délai de service de la date d'application", () => {
    const origin = newAutopolisWorld(17, ["crimson"]);
    const accepted = acceptAutopolisProposal(origin, proposal(origin), { model: "m", deferredBy: 2 });
    expect(accepted.ruling!.askedAt).toBe(1);
    expect(accepted.ruling!.appliedAt).toBe(3);
    expect(accepted.world.tick).toBe(1);
    expect(accepted.world.civs[0]!.identity.leader.policy.farming).not.toBe(0.8);
    const journal = newAutopolisJournal(origin);
    journal.entries.push({ type: "ruling", ruling: accepted.ruling! });
    const replay = replayAutopolis(journal, 3);
    expect(replay.world.tick).toBe(3);
    expect(replay.world.civs[0]!.identity.leader.policy.farming).toBeGreaterThan(0.4);
    expect(replay.events.some((event) => event.kind === "RULING_ACCEPTED")).toBe(true);
  });

  it("rejoue une succession depuis le journal sans rappeler un modèle", () => {
    const origin = newAutopolisWorld(19, ["crimson"]);
    const succession = succeedAutopolisLeader(origin, "crimson");
    const journal = newAutopolisJournal(origin);
    journal.livedTo = 1;
    journal.entries.push(succession.succession!);
    const replay = replayAutopolis(journal, 1);
    expect(replay.world.civs[0]!.identity.leader.id).toBe(succession.world.civs[0]!.identity.leader.id);
    expect(replay.world.civs[0]!.identity.leader.doctrine.id).toBe(origin.civs[0]!.identity.leader.doctrine.id);
  });
});
