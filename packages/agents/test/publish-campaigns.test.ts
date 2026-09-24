import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publish } from "../../../scripts/publish-campaigns.js";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
} from "../../world/src/spectator.js";
import {
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../../world/src/campaign.js";

function play(id: string, turns: number): Campaign {
  let state = newSpectator(42, "spectator-10");
  const campaign: Campaign = {
    version: "spectator-10",
    id,
    seed: 42,
    mode: "local",
    models: {},
    maxTurns: 40,
    turns: [],
    pending: null,
  };
  for (let n = 0; n < turns; n++) {
    const decision = localCouncil(state, activeCiv(state)!);
    state = resolveCouncil(state, [decision]).state;
    campaign.turns.push({
      turn: decision.turn,
      signature: stateSignature(state),
      answers: [
        {
          civ: decision.civ,
          decision,
          source: "local",
          model: null,
          service: null,
          error: null,
        },
      ],
    });
  }
  return campaign;
}

/**
 * Le site public ne montre que ce que ce script publie. Ce qu'on vérifie :
 * une partie publiée se rejoue, un conseil en cours n'est pas publié comme un
 * fait, et l'état « en direct » vient de la liste que tient le serveur.
 */
describe("publier des parties pour le site public", () => {
  let source = "",
    out = "";
  afterEach(() => {
    for (const dir of [source, out])
      if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("publie, met à jour, dit ce qui est en direct, et retire", () => {
    source = mkdtempSync(join(tmpdir(), "aevum-pub-src-"));
    out = mkdtempSync(join(tmpdir(), "aevum-pub-out-"));
    const first = play("premiere", 4);
    first.pending = { turn: 4, answers: [] };
    writeFileSync(join(source, "premiere.json"), JSON.stringify(first));
    writeFileSync(
      join(source, "seconde.json"),
      JSON.stringify(play("seconde", 2)),
    );
    writeFileSync(join(source, ".live.json"), JSON.stringify(["seconde"]));

    let index = publish({
      source,
      out,
      add: [{ id: "premiere", title: "La première" }, { id: "seconde" }],
      remove: [],
      now: new Date("2026-09-24T12:00:00Z"),
    });
    expect(index.map((e) => [e.id, e.live, e.turns])).toEqual([
      ["seconde", true, 2],
      ["premiere", false, 4],
    ]);
    expect(index.find((e) => e.id === "premiere")!.title).toBe("La première");
    const published = JSON.parse(
      readFileSync(join(out, "premiere.json"), "utf8"),
    ) as Campaign;
    expect(published.pending).toBeNull();
    expect(replayCampaign(published).history).toHaveLength(5);
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual(
      index,
    );

    // Un tour de plus : la date change, le titre reste.
    writeFileSync(
      join(source, "seconde.json"),
      JSON.stringify(play("seconde", 3)),
    );
    index = publish({
      source,
      out,
      add: [{ id: "seconde" }],
      remove: ["premiere"],
      now: new Date("2026-09-24T12:05:00Z"),
    });
    expect(index).toHaveLength(1);
    expect(index[0]!.turns).toBe(3);
    expect(index[0]!.updatedAt).toBe("2026-09-24T12:05:00.000Z");
  });

  it("refuse un identifiant qui sortirait du répertoire, et une partie qui ne se rejoue pas", () => {
    source = mkdtempSync(join(tmpdir(), "aevum-pub-src-"));
    out = mkdtempSync(join(tmpdir(), "aevum-pub-out-"));
    expect(() =>
      publish({ source, out, add: [{ id: "../secret" }], remove: [] }),
    ).toThrow(/invalide/);
    const broken = play("cassee", 3);
    broken.turns[1]!.signature = "falsifiée";
    writeFileSync(join(source, "cassee.json"), JSON.stringify(broken));
    expect(() =>
      publish({ source, out, add: [{ id: "cassee" }], remove: [] }),
    ).toThrow(/Rejeu/);
  });
});
