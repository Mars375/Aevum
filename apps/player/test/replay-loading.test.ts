import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchReplay, NotServed, parseReplay, replayUrlFromSearch } from "../src/replay-loading";

const ROOT = resolve(import.meta.dirname, "../../..");

describe("replay URL compatibility", () => {
  it("loads and accepts an old nested replay URL unchanged", async () => {
    const fixture = JSON.parse(readFileSync(resolve(ROOT, "replays/reference/battle-seed42.json"), "utf8"));
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(fixture)));

    const requested = replayUrlFromSearch("?replay=replays/reference/reference.json");
    expect(requested).toBe("replays/reference/reference.json");

    const parsed = parseReplay(await fetchReplay(requested!, fetcher));

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("replays/reference/reference.json");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.manifest.battleId).toBe(fixture.manifest.battleId);
  });
});

/**
 * Le cas que la spécification fait un critère d'acceptation : les JSON du monde
 * ne doivent pas tomber silencieusement sur la page de l'application.
 */
describe("un JSON qui n'est pas servi", () => {
  const page = "<!doctype html><html><body>l'application</body></html>";

  it("reconnaît la page de repli annoncée en HTML", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } }));
    await expect(fetchReplay("replays/reference.json", fetcher)).rejects.toBeInstanceOf(NotServed);
  });

  it("la reconnaît aussi quand le serveur n'annonce aucun type", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(page));
    await expect(fetchReplay("replays/reference.json", fetcher)).rejects.toBeInstanceOf(NotServed);
  });

  it("nomme l'adresse absente plutôt qu'une erreur d'analyse", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(page, { headers: { "content-type": "text/html" } }));
    await expect(fetchReplay("replays/manquant.json", fetcher)).rejects.toThrow(/replays\/manquant\.json/);
  });

  it("laisse passer un vrai JSON servi sans type déclaré", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{"ok":true}'));
    await expect(fetchReplay("replays/x.json", fetcher)).resolves.toEqual({ ok: true });
  });

  it("distingue une absence d'un fichier réellement illisible", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{ pas du json", { headers: { "content-type": "application/json" } }));
    await expect(fetchReplay("replays/x.json", fetcher)).rejects.not.toBeInstanceOf(NotServed);
  });
});
