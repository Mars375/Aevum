import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite, lockWorld } from "../../../scripts/world-storage.js";

describe("durable journal storage", () => {
  it("replaces a complete document and excludes a competing writer", () => {
    const dir=mkdtempSync(join(tmpdir(),"aevum-storage-"));
    try {
      const path=join(dir,"journal.json"), lock=join(dir,"writer.lock");
      const release=lockWorld(lock);
      expect(() => lockWorld(lock)).toThrow("World already locked");
      atomicWrite(path,'{"year":1}'); atomicWrite(path,'{"year":2}');
      expect(JSON.parse(readFileSync(path,"utf8"))).toEqual({year:2});
      release(); release();
      const again=lockWorld(lock); again();
      expect(readdirSync(dir)).toEqual(["journal.json"]);
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
});
