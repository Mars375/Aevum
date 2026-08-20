import type { World } from "./state.js";

/**
 * An empreinte of a world, so a resume can prove it resumed the right one.
 *
 * A world is lived in several sittings: a session stops, a nightly pass picks
 * it up, and each time the runner rebuilds the state by replaying the journal.
 * If the replay and the live run ever disagree, the world silently continues
 * from a history that never happened — and the journal then records decisions
 * answering events that, on re-reading, do not exist.
 *
 * That is not hypothetical. The world `monde` reached year 290 carrying a
 * ruling about an invasion in year 199 while a replay put its first lost place
 * in 227, because a replay bug had been fixed between two sittings. Nothing
 * complained. This is what complains.
 *
 * Deliberately not a cryptographic hash: it guards against divergence, not
 * against forgery, and it must stay cheap enough to compute on every save.
 */
export function fingerprint(world: World): string {
  const parts: string[] = [`${world.worldVersion}:${world.tick}:${world.seed}:${world.size}`];

  // Board in index order, civilisations in id order: the fingerprint must not
  // depend on an array's history, only on what the world is.
  parts.push(world.board.map((p) => `${p.kind[0]}${p.owner ?? "-"}`).join(","));

  for (const civ of [...world.civs].sort((a, b) => a.id.localeCompare(b.id))) {
    const d = civ.doctrine;
    parts.push(
      [
        civ.id,
        Math.round(civ.population),
        civ.territory,
        civ.soldiers,
        Math.round(civ.stock.food),
        Math.round(civ.stock.timber),
        Math.round(civ.stock.ore),
        Math.round(civ.stock.wealth),
        civ.advances.join("+"),
        civ.capital ?? "-",
        civ.fellOnTick ?? "-",
        d.posture,
        d.claim,
        d.vow ? `${d.vow.metric}>=${d.vow.floor}` : "-",
      ].join("|"),
    );
  }

  // FNV-1a, 32 bits, in hex. Enough to catch a divergence the moment it starts.
  let h = 0x811c9dc5;
  const text = parts.join(";");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
