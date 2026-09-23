import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Une feuille globale ne vit que dans une racine chargée seule.
 *
 * Le lecteur a deux racines : les archives (`App.vue`) et l'observatoire
 * (`Spectator.vue`). L'observatoire porte une feuille non scopée,
 * `spectator.css`. Tant que `main.ts` importait les deux racines
 * statiquement, ses règles s'appliquaient aussi aux archives :
 * `.civilizations { position: absolute }` sortait le tableau comparé de la
 * chronique de son flux et l'écrasait sur 295 px par-dessus le titre. Le
 * défaut datait de l'arrivée de l'observatoire, et aucun test ne le voyait —
 * il a fallu ouvrir la page.
 */
const SRC = resolve(import.meta.dirname, "../src");

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return vueFiles(path);
    return entry.endsWith(".vue") ? [path] : [];
  });
}

describe("les deux racines du lecteur ne partagent pas leurs styles", () => {
  const main = readFileSync(join(SRC, "main.ts"), "utf8");

  it("main.ts n'importe aucune racine statiquement", () => {
    expect(main).not.toMatch(
      /^import\s+\w+\s+from\s+["']\.\/(App|Spectator)\.vue["']/m,
    );
    expect(main).toMatch(/import\(["']\.\/App\.vue["']\)/);
    expect(main).toMatch(/import\(["']\.\/Spectator\.vue["']\)/);
  });

  /**
   * Égalité exacte, comme la garde de marque : une nouvelle feuille globale
   * ailleurs la casse, et la retirer de l'observatoire aussi — il faut alors
   * mettre la liste à jour en sachant pourquoi.
   */
  it("seul l'observatoire porte une feuille non scopée", () => {
    const unscoped = vueFiles(SRC)
      .filter((file) =>
        /<style(?![^>]*\bscoped\b)[^>]*>/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(SRC, file).split("\\").join("/"))
      .sort();
    expect(unscoped).toEqual(["Spectator.vue"]);
  });
});
