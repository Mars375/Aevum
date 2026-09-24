import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { replayCampaign } from "../../../packages/world/src/campaign";

/**
 * Ce que les catalogues annoncent doit être réellement livré.
 *
 * Vite recopie `apps/player/public/` tel quel dans `dist`, donc ce répertoire
 * EST ce qu'un hébergeur statique sert. Un catalogue qui cite un fichier absent
 * ne se voit pas : avec `try_files $uri $uri/ /index.html`, l'adresse manquante
 * répond **200 avec la page de l'application**, si bien que `res.ok` est vrai
 * et que seul `res.json()` finit par échouer, loin de la cause. Le lecteur
 * apprend alors que son fichier est corrompu alors qu'il n'a jamais été publié.
 *
 * Les trois catalogues n'ont pas la même convention d'adresse, et c'est
 * précisément le genre de détail qu'on casse en déplaçant un fichier :
 * un monde donne un chemin depuis la racine du site, une bataille un chemin
 * relatif à `replays/`, un rapport un simple `slug`.
 */
const PUBLIC = resolve(import.meta.dirname, "../public");
const read = (file: string) =>
  JSON.parse(readFileSync(resolve(PUBLIC, file), "utf8")) as Record<
    string,
    unknown
  >[];

describe("tout ce qu'un build statique annonce, il le sert", () => {
  it("chaque monde du catalogue est publié", () => {
    const entries = read("worlds/index.json");
    expect(entries.length).toBeGreaterThan(0);
    const missing = entries
      .map((entry) => String(entry.path))
      .filter((path) => !existsSync(resolve(PUBLIC, path)));
    expect(missing).toEqual([]);
  });

  it("chaque courbe d'apprentissage annoncée est publiée", () => {
    const missing = read("worlds/index.json")
      .flatMap((entry) =>
        typeof entry.learningCurvePath === "string"
          ? [entry.learningCurvePath]
          : [],
      )
      .filter((path) => !existsSync(resolve(PUBLIC, path)));
    expect(missing).toEqual([]);
  });

  it("chaque bataille du catalogue est publiée", () => {
    const entries = read("replays/index.json");
    expect(entries.length).toBeGreaterThan(0);
    // Ces chemins-là sont relatifs à `replays/`, pas à la racine.
    const missing = entries
      .map((entry) => `replays/${String(entry.path)}`)
      .filter((path) => !existsSync(resolve(PUBLIC, path)));
    expect(missing).toEqual([]);
  });

  it("chaque partie publiée est livrée et se rejoue", () => {
    const entries = read("campaigns/index.json");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const path = resolve(PUBLIC, "campaigns", String(entry.path));
      expect(existsSync(path), String(entry.path)).toBe(true);
      const campaign = JSON.parse(readFileSync(path, "utf8"));
      // Le site rejoue la partie dans le navigateur : si elle ne se rejoue pas
      // ici, la page publique est cassée.
      expect(replayCampaign(campaign).history.length - 1).toBe(entry.turns);
    }
  });

  it("chaque rapport du catalogue est publié", () => {
    const entries = read("reports/index.json");
    expect(entries.length).toBeGreaterThan(0);
    const missing = entries
      .map((entry) => `reports/${String(entry.slug)}.html`)
      .filter((path) => !existsSync(resolve(PUBLIC, path)));
    expect(missing).toEqual([]);
  });
});
