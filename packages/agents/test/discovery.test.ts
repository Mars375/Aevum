import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createSpectatorServer } from "../../../scripts/spectator-server.js";

it("offers a verified recorded demo without credentials and stops bounded campaigns", async () => {
  const directory = mkdtempSync(join(tmpdir(), "aevum-discovery-"));
  const server = createSpectatorServer(directory, {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (path: string, body?: unknown) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    expect((await (await request("/api/health")).json()).application).toBe(
      "aevum",
    );
    const settings = await (await request("/api/campaigns")).json();
    expect(settings.defaultModels.amber).toBe("nous:meituan/longcat-2.0:free");
    const remote = await (
      await request("/api/campaigns", {
        seed: 42,
        mode: "remote",
        maxTurns: 12,
      })
    ).json();
    const remoteBefore = await (
      await request(`/api/campaigns/${remote.id}`)
    ).json();
    expect(remoteBefore.campaign.models).toEqual(settings.defaultModels);
    await request(`/api/campaigns/${remote.id}/step`, { turn: 0 });
    let unavailable = await (
      await request(`/api/campaigns/${remote.id}`)
    ).json();
    for (let wait = 0; unavailable.busy && wait < 100; wait++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      unavailable = await (await request(`/api/campaigns/${remote.id}`)).json();
    }
    expect(unavailable.busy).toBe(false);
    expect(unavailable.state.world.tick).toBe(0);
    expect(unavailable.state.sequence.activeCiv).toBe("amber");
    expect(unavailable.error).toContain("Nous");
    expect(unavailable.campaign.pending).toBeNull();
    const demo = await (await request("/api/demo", {})).json();
    expect((await (await request("/api/demo", {})).json()).id).toBe(demo.id);
    const saved = await (await request(`/api/campaigns/${demo.id}`)).json();
    expect(saved.state.world.tick).toBe(50);
    expect(saved.campaign.maxTurns).toBe(50);
    expect(
      saved.campaign.turns
        .flatMap((t: any) => t.answers)
        .some((a: any) => a.source === "local"),
    ).toBe(false);
    expect(
      (await request(`/api/campaigns/${demo.id}/step`, { turn: 50 })).status,
    ).toBe(409);
    const created = await (
      await request("/api/campaigns", { seed: 7, mode: "local", maxTurns: 12 })
    ).json();
    for (let turn = 0; turn < 48; turn++) {
      expect(
        (await request(`/api/campaigns/${created.id}/step`, { turn })).status,
      ).toBe(202);
      for (let wait = 0; wait < 100; wait++) {
        const data = await (
          await request(`/api/campaigns/${created.id}`)
        ).json();
        if (!data.busy) {
          expect(data.state.world.tick).toBe(turn + 1);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(
      (await request(`/api/campaigns/${created.id}/step`, { turn: 48 })).status,
    ).toBe(409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
