import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createSpectatorServer } from "../../../scripts/spectator-server.js";

describe("spectator HTTP lifecycle", () => {
  it("creates, advances, exports and resumes a local campaign; blocks foreign origins", async () => {
    const directory = mkdtempSync(join(tmpdir(), "aevum-http-"));
    let server = createSpectatorServer(directory, {});
    const start = async () => {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    };
    let base = await start();
    const request = (
      path: string,
      body?: unknown,
      origin = "http://127.0.0.1:5173",
    ) =>
      fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Host: "127.0.0.1:5174",
          Origin: origin,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    try {
      expect(
        (await request("/api/campaigns", {}, "https://evil.example")).status,
      ).toBe(403);
      const response = await request("/api/campaigns", {
        seed: 42,
        mode: "local",
        models: { amber: "", azure: "", crimson: "", verdant: "" },
      });
      expect(response.status).toBe(201);
      const { id } = await response.json();
      expect(
        (await request(`/api/campaigns/${id}/step`, { turn: 0 })).status,
      ).toBe(202);
      let data = await (await request(`/api/campaigns/${id}`)).json();
      for (let i = 0; data.busy && i < 20; i++) {
        await new Promise((r) => setTimeout(r, 10));
        data = await (await request(`/api/campaigns/${id}`)).json();
      }
      expect(data.state.world.tick).toBe(1);
      expect(data.campaign.turns[0].answers).toHaveLength(1);
      expect(data.campaign.turns[0].answers[0].civ).toBe("amber");
      expect(data.state.sequence.activeCiv).toBe("azure");
      expect(
        (await request(`/api/campaigns/${id}/step`, { turn: 0 })).status,
      ).toBe(409);
      const exported = await (
        await request(`/api/campaigns/${id}/export`)
      ).json();
      expect(exported.turns).toHaveLength(1);
      await new Promise<void>((r) => server.close(() => r()));
      server = createSpectatorServer(directory, {});
      base = await start();
      expect(
        (await (await request(`/api/campaigns/${id}`)).json()).state,
      ).toEqual(data.state);
      expect(
        (await request(`/api/campaigns/${id}/step`, { turn: 1 })).status,
      ).toBe(202);
      const next = await (await request(`/api/campaigns/${id}`)).json();
      expect(next.state.world.tick).toBe(2);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
