import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  CURRENT_RULES,
  createSpectatorServer,
  type LiveTiming,
} from "../../../scripts/spectator-server.js";
import { SPECTATOR_RULES } from "../../world/src/spectator.js";
import { STABLE_FREE_MODELS } from "../src/stable-models.js";

const FAST: LiveTiming = {
  remotePaceMs: 5,
  localPaceMs: 5,
  backoffMs: [5],
  maxFailures: 3,
};

/**
 * Le direct : le serveur joue seul une partie, page ouverte ou non.
 *
 * Les tours automatiques vivaient dans la page, et fermer l'onglet arrêtait la
 * partie. Ce qui est vérifié ici, c'est ce qui manquait : que la partie avance
 * sans personne, qu'elle reprenne après un redémarrage, et qu'un dirigeant
 * muet la suspende en le disant — sans jamais être remplacé.
 */
describe("parties en direct", () => {
  let server: Server | null = null;
  let directory = "";
  afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = null;
    if (directory) rmSync(directory, { recursive: true, force: true });
  });
  const start = async (timing = FAST) => {
    server = createSpectatorServer(directory, {}, timing);
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return (path: string, body?: unknown) =>
      fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Host: "127.0.0.1:5174",
          Origin: "http://127.0.0.1:5173",
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }).then((r) => r.json());
  };
  const until = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 400; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("délai dépassé");
  };

  it("crée les parties avec les dernières règles", async () => {
    directory = mkdtempSync(join(tmpdir(), "aevum-live-"));
    const request = await start();
    expect(CURRENT_RULES).toBe(SPECTATOR_RULES[SPECTATOR_RULES.length - 1]);
    const { id } = await request("/api/campaigns", { seed: 42, mode: "local" });
    const data = await request(`/api/campaigns/${id}`);
    expect(data.campaign.version).toBe(CURRENT_RULES);
    expect(data.live.on).toBe(false);
    // Sans clé posée, le formulaire ne propose que les modèles retenus sans clé.
    const { stableModels } = await request("/api/campaigns");
    expect(stableModels.map((m: { ref: string }) => m.ref)).toEqual(
      STABLE_FREE_MODELS.filter((m) => !m.key).map((m) => m.ref),
    );
  });

  it("joue seul, s'arrête sur demande, et reprend après un redémarrage", async () => {
    directory = mkdtempSync(join(tmpdir(), "aevum-live-"));
    let request = await start();
    const { id } = await request("/api/campaigns", {
      seed: 42,
      mode: "local",
      maxTurns: 12,
    });
    expect(
      (await request(`/api/campaigns/${id}/live`, { live: true })).live.on,
    ).toBe(true);
    await until(
      async () => (await request(`/api/campaigns/${id}/head`)).turns >= 3,
    );
    expect(
      JSON.parse(readFileSync(join(directory, ".live.json"), "utf8")),
    ).toEqual([id]);

    // Un redémarrage reprend le direct là où il était.
    await new Promise<void>((r) => server!.close(() => r()));
    const before = readFileSync(join(directory, `${id}.json`), "utf8");
    const turnsBefore = JSON.parse(before).turns.length;
    request = await start();
    await until(
      async () =>
        (await request(`/api/campaigns/${id}/head`)).turns > turnsBefore,
    );

    const stopped = await request(`/api/campaigns/${id}/live`, { live: false });
    expect(stopped.live.on).toBe(false);
    await until(async () => !(await request(`/api/campaigns/${id}/head`)).busy);
    const frozen = (await request(`/api/campaigns/${id}/head`)).turns;
    await new Promise((r) => setTimeout(r, 60));
    expect((await request(`/api/campaigns/${id}/head`)).turns).toBe(frozen);
    expect(
      JSON.parse(readFileSync(join(directory, ".live.json"), "utf8")),
    ).toEqual([]);
  });

  it("suspend le direct quand un dirigeant ne répond pas, sans le remplacer", async () => {
    directory = mkdtempSync(join(tmpdir(), "aevum-live-"));
    const request = await start();
    // Un modèle qui exige une clé absente : indisponible, sans appel réseau.
    const { id } = await request("/api/campaigns", {
      seed: 42,
      mode: "remote",
      maxTurns: 12,
      models: Object.fromEntries(
        ["amber", "azure", "crimson", "verdant"].map((civ) => [
          civ,
          "nous:meituan/longcat-2.0:free",
        ]),
      ),
    });
    await request(`/api/campaigns/${id}/live`, { live: true });
    await until(
      async () =>
        (await request(`/api/campaigns/${id}/head`)).live.stopped !== null,
    );
    const head = await request(`/api/campaigns/${id}/head`);
    expect(head.turns).toBe(0);
    expect(head.live.on).toBe(false);
    expect(head.live.failures).toBe(3);
    expect(head.live.stopped).toContain("Direct suspendu après 3 essais");
    expect(existsSync(join(directory, ".live.json"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(directory, ".live.json"), "utf8")),
    ).toEqual([]);
  });

  it("refuse le direct sur une partie terminée", async () => {
    directory = mkdtempSync(join(tmpdir(), "aevum-live-"));
    const request = await start();
    const demo = await request("/api/demo", {});
    const answer = await request(`/api/campaigns/${demo.id}/live`, {
      live: true,
    });
    expect(answer.error).toContain("terminée");
  });
});
