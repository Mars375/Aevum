import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

/** Same-directory atomic replacement: readers see either complete version. */
export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(temp, "wx");
    try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, path);
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}

/**
 * Un verrou dont le propriétaire n'existe plus n'est pas un verrou.
 *
 * `lockWorld` refuse délibérément d'effacer : un plantage doit laisser une
 * trace qu'on puisse examiner. Mais sous Windows, fermer la fenêtre du lanceur
 * termine le processus sans lui laisser exécuter quoi que ce soit — ni signal,
 * ni `exit`. Le verrou survivait donc à **chaque fermeture normale**, et le
 * lancement suivant échouait sur un verrou que plus personne ne tenait. Le
 * lanceur npm savait s'en sortir ; une copie empaquetée, qui démarre le serveur
 * directement, restait bloquée.
 *
 * On ne retire que ce qui est vérifiablement mort : `ESRCH` seulement. Un
 * `EPERM` signifie que le processus existe et appartient à quelqu'un d'autre,
 * et là le verrou tient toujours.
 */
export function reclaimStaleLock(path: string): boolean {
  if (!existsSync(path)) return false;
  let pid: unknown;
  try {
    pid = (JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown }).pid;
  } catch {
    return false; // Illisible : on préfère l'examen humain à l'effacement.
  }
  if (!Number.isInteger(pid) || (pid as number) <= 0) return false;
  try {
    process.kill(pid as number, 0);
    return false; // Bien vivant.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
  }
  unlinkSync(path);
  return true;
}

/** Refuse competing writers. A crash leaves an explicit lock to investigate. */
export function lockWorld(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  let fd: number;
  try { fd = openSync(path, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`World already locked: ${path}. Check the recorded process before removing a stale lock.`);
    throw error;
  }
  writeFileSync(fd, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
  closeSync(fd);
  let released = false;
  return () => { if (!released) { released = true; unlinkSync(path); } };
}
