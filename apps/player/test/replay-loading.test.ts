import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchReplay, parseReplay, replayUrlFromSearch } from "../src/replay-loading";

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
