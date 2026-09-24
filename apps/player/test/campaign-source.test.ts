import { describe, expect, it } from "vitest";
import { detectSource, modelLabel, publicSource } from "../src/campaign-source";

const respond = (body: unknown, type = "application/json", status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": type },
  });
const INDEX = [
  {
    id: "partie",
    title: "Une partie",
    seed: 42,
    version: "spectator-10",
    mode: "remote",
    models: {},
    turns: 3,
    maxTurns: 40,
    live: true,
    updatedAt: "2026-09-24T12:00:00.000Z",
    path: "partie.json",
  },
];

describe("d'où viennent les parties", () => {
  it("prend le service local quand il répond", async () => {
    const source = await detectSource((async (url: string) =>
      url === "/api/health"
        ? respond({ application: "aevum", ready: true })
        : respond("", "text/html", 404)) as typeof fetch);
    expect(source.kind).toBe("local");
  });

  /**
   * Le piège des hébergeurs statiques : une adresse absente répond 200 avec
   * la page HTML. `/api/health` doit alors mener aux parties publiées, pas à
   * une erreur de JSON illisible.
   */
  it("bascule sur les parties publiées quand /api répond la page HTML", async () => {
    const fetcher = (async (url: string) =>
      url === "campaigns/index.json"
        ? respond(INDEX)
        : respond("<!doctype html>", "text/html")) as typeof fetch;
    const source = await detectSource(fetcher);
    expect(source.kind).toBe("public");
    expect(await source.head("partie")).toMatchObject({
      turns: 3,
      busy: false,
      live: { on: true },
    });
  });

  it("dit qu'un fichier absent est absent, pas qu'il est corrompu", async () => {
    const source = publicSource(undefined, (async (url: string) =>
      url === "campaigns/index.json"
        ? respond(INDEX)
        : respond("<!doctype html>", "text/html")) as typeof fetch);
    await expect(source.campaign("partie")).rejects.toThrow(
      /pas un fichier JSON/,
    );
    await expect(source.campaign("inconnue")).rejects.toThrow(/non publiée/);
  });

  /**
   * La publication en direct est lue sur GitHub, qui sert du `text/plain` ;
   * injoignable, elle ne doit pas priver le site des parties livrées avec lui.
   */
  it("lit la publication en direct, et se replie sur les parties livrées", async () => {
    const live = "https://live.example/";
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url === `${live}index.json`)
        return respond(
          [{ ...INDEX[0], turns: 9 }],
          "text/plain; charset=utf-8",
        );
      if (url === `${live}partie.json`)
        return respond({ id: "partie" }, "text/plain");
      if (url === "campaigns/index.json") return respond(INDEX);
      return respond("", "text/plain", 404);
    }) as typeof fetch;
    const both = publicSource([live, "campaigns/"], fetcher);
    // Présente des deux côtés : prise là où elle a le plus de tours.
    expect((await both.head("partie")).turns).toBe(9);
    await both.campaign("partie");
    expect(calls).toContain(`${live}partie.json`);

    const down = (async (url: string) =>
      url.startsWith(live)
        ? Promise.reject(new TypeError("réseau"))
        : url === "campaigns/index.json"
          ? respond(INDEX)
          : respond("", "text/plain", 404)) as typeof fetch;
    const fallback = publicSource([live, "campaigns/"], down);
    expect((await fallback.head("partie")).turns).toBe(3);
  });

  it("nomme les modèles pour un lecteur, hébergeur compris", () => {
    expect(modelLabel("kilo:dots-studio/dots-3-note-preview:free")).toBe(
      "dots-3-note-preview (Kilo)",
    );
    expect(modelLabel("mistral:codestral-latest")).toBe(
      "codestral-latest (Mistral)",
    );
    expect(modelLabel("google/gemma-4-26b-a4b-it:free")).toBe(
      "gemma-4-26b-a4b-it (OpenRouter)",
    );
  });
});
