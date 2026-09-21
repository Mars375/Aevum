import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lockWorld, reclaimStaleLock } from "../../../scripts/world-storage.js";

/**
 * Sous Windows, fermer la fenêtre du lanceur termine le serveur sans lui
 * laisser exécuter son `exit` ni recevoir de signal : le verrou du monde
 * survivait à chaque fermeture normale, et le lancement suivant échouait.
 * Ce comportement a été découvert par le démarrage réel du paquet, pas par
 * lecture — d'où ces bornes, qui disent exactement ce qu'on accepte d'effacer.
 */
const fresh = () => mkdtempSync(join(tmpdir(), "aevum-lock-"));

/**
 * Un identifiant de processus qui a réellement existé, et n'existe plus.
 *
 * Calculé une seule fois : lancer un interpréteur coûte assez cher pour pousser
 * les tests voisins au-delà de leur délai quand la suite tourne en parallèle.
 */
const DEAD_PID = (() => {
  const child = spawnSync(process.execPath, ["-e", ""], { windowsHide: true });
  if (typeof child.pid !== "number") throw new Error("pas de pid");
  return child.pid;
})();

describe("reprise d'un verrou dont le propriétaire a disparu", () => {
  it("ne touche à rien quand il n'y a pas de verrou", () => {
    expect(reclaimStaleLock(join(fresh(), "server.lock"))).toBe(false);
  });

  it("laisse en place le verrou d'un processus vivant", () => {
    const path = join(fresh(), "server.lock");
    const release = lockWorld(path);
    // Ce test EST le processus enregistré : il est vivant par construction.
    expect(reclaimStaleLock(path)).toBe(false);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).pid).toBe(process.pid);
    release();
  });

  it("reprend le verrou d'un processus mort", () => {
    const path = join(fresh(), "server.lock");
    writeFileSync(
      path,
      JSON.stringify({ pid: DEAD_PID, started: "2026-09-21T00:00:00.000Z" }),
    );
    expect(reclaimStaleLock(path)).toBe(true);
    expect(existsSync(path)).toBe(false);
  });

  it("préfère l'examen humain à l'effacement d'un verrou illisible", () => {
    const path = join(fresh(), "server.lock");
    writeFileSync(path, "ceci n'est pas du JSON");
    expect(reclaimStaleLock(path)).toBe(false);
    expect(existsSync(path)).toBe(true);
  });

  it("refuse un identifiant de processus absurde", () => {
    const path = join(fresh(), "server.lock");
    writeFileSync(path, JSON.stringify({ pid: -1 }));
    expect(reclaimStaleLock(path)).toBe(false);
    expect(existsSync(path)).toBe(true);
  });

  it("un verrou repris peut être repris par un nouveau serveur", () => {
    const path = join(fresh(), "server.lock");
    writeFileSync(path, JSON.stringify({ pid: DEAD_PID }));
    expect(() => lockWorld(path)).toThrow(/already locked/);
    expect(reclaimStaleLock(path)).toBe(true);
    const release = lockWorld(path);
    expect(existsSync(path)).toBe(true);
    release();
    expect(existsSync(path)).toBe(false);
  });
});
