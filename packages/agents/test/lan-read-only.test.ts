import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  acceptedHost,
  createSpectatorServer,
  fromThisMachine,
} from "../../../scripts/spectator-server.js";

/**
 * Regarder depuis le wifi, sans pouvoir y dépenser le quota.
 *
 * Le service tient les clés. Ouvert au réseau, il doit laisser tout appareil
 * regarder et n'accepter de modification que de la machine elle-même.
 */
describe("le service ouvert au réseau local", () => {
  it("n'accepte un hôte du réseau que si on l'a ouvert, et jamais un hôte public", () => {
    expect(acceptedHost("127.0.0.1:5174", false)).toBe(true);
    expect(acceptedHost("192.168.1.20:5174", false)).toBe(false);
    expect(acceptedHost("192.168.1.20:5174", true)).toBe(true);
    expect(acceptedHost("10.0.0.7:5174", true)).toBe(true);
    expect(acceptedHost("172.16.4.2:5174", true)).toBe(true);
    expect(acceptedHost("172.32.4.2:5174", true)).toBe(false);
    expect(acceptedHost("aevum.example.com:5174", true)).toBe(false);
    expect(acceptedHost("8.8.8.8:5174", true)).toBe(false);
    // Tailscale : 100.64/10, et pas au-delà.
    expect(acceptedHost("100.107.1.13:5174", true)).toBe(true);
    expect(acceptedHost("100.128.0.1:5174", true)).toBe(false);
    expect(acceptedHost("100.63.0.1:5174", true)).toBe(false);
  });

  it("reconnaît la machine elle-même, et elle seule", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
      expect(fromThisMachine(address)).toBe(true);
    for (const address of ["192.168.1.20", "::ffff:192.168.1.20", undefined])
      expect(fromThisMachine(address)).toBe(false);
  });

  let server: Server | null = null;
  let directory = "";
  afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = null;
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  const lanAddress = Object.values(networkInterfaces())
    .flat()
    .find(
      (entry) =>
        entry &&
        entry.family === "IPv4" &&
        !entry.internal &&
        acceptedHost(`${entry.address}:1`, true),
    )?.address;

  it.skipIf(!lanAddress)(
    "laisse un appareil du réseau regarder, et lui refuse de jouer",
    async () => {
      directory = mkdtempSync(join(tmpdir(), "aevum-lan-"));
      server = createSpectatorServer(directory, { AEVUM_LAN: "1" });
      await new Promise<void>((r) => server!.listen(0, "0.0.0.0", r));
      const port = (server.address() as AddressInfo).port;
      const from = (host: string) => `http://${host}:${port}`;

      // Depuis la machine : on crée une partie.
      const created = await fetch(`${from("127.0.0.1")}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: 42, mode: "local" }),
      });
      expect(created.status).toBe(201);
      const { id } = await created.json();

      // Depuis le réseau : lire oui, jouer non.
      const health = await (
        await fetch(`${from(lanAddress!)}/api/health`)
      ).json();
      expect(health.readOnly).toBe(true);
      const head = await fetch(`${from(lanAddress!)}/api/campaigns/${id}/head`);
      expect(head.status).toBe(200);
      for (const [path, body] of [
        ["/api/campaigns", { seed: 1, mode: "local" }],
        [`/api/campaigns/${id}/step`, { turn: 0 }],
        [`/api/campaigns/${id}/live`, { live: true }],
      ] as const) {
        const refused = await fetch(`${from(lanAddress!)}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        expect(refused.status, path).toBe(403);
      }
      const local = await (
        await fetch(`${from("127.0.0.1")}/api/health`)
      ).json();
      expect(local.readOnly).toBe(false);
    },
  );
});
