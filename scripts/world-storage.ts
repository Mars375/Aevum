import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
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
