import { isAlive, neighbours, type Civ, type LandKind, type Lands, type World } from "./state.js";
import type { TickEvent } from "./events.js";

/**
 * Who may take what, and from whom.
 *
 * Every rule that moves a place from one owner to another lives here, and they
 * all rest on one idea: a civilisation reaches only what its own frontier
 * touches. Kept apart from the tick because the tick decides *whether* a
 * civilisation wants land, while these decide *which* land it can actually
 * have — two questions that kept being edited together and confused.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export const LAND_LABEL: Record<LandKind, string> = {
  plain: "plaine",
  forest: "foret",
  hill: "colline",
  river: "fleuve",
};

/**
 * How much a civilisation would miss one parcel of a kind it already has.
 *
 * Used only to decide what to abandon and what a raider takes first, so it is
 * a ranking and not a price: the last river is worth more than the tenth plain.
 */
export const value = (lands: Lands, kind: LandKind): number => (kind === "river" ? 3 : kind === "plain" ? 2 : 1) / lands[kind];

/**
 * The best place a civilisation can actually reach.
 *
 * "Reach" is the whole change from w3: a civilisation may only take what
 * borders something it already holds, so a frontier is a real edge and not an
 * accounting entry. Among reachable places, the one it covets wins; ties go to
 * the lowest index so the choice never depends on iteration order.
 */
export function reachable(
  board: readonly { kind: LandKind; owner: Civ["id"] | null }[],
  size: number,
  civ: Civ["id"],
  wanted: LandKind,
  belongsTo: Civ["id"] | null,
): number | null {
  const edge = new Set<number>();
  board.forEach((place, i) => {
    if (place.owner !== civ) return;
    for (const n of neighbours(size, i)) if (board[n]!.owner === belongsTo) edge.add(n);
  });
  if (edge.size === 0) return null;
  const ranked = [...edge].sort(
    (a, b) =>
      Number(board[b]!.kind === wanted) - Number(board[a]!.kind === wanted) || a - b,
  );
  return ranked[0]!;
}

export function contact(world: World, events: TickEvent[]): World {
  const tick = world.tick;
  const civs = world.civs;
  const alive = civs.filter(isAlive);
  if (alive.length < 2) return world;

  const board = world.board;
  const byId = new Map(civs.map((c) => [c.id, { ...c }]));

  // Trade is mutual or it does not happen: a civilisation cannot enrich itself
  // by declaring goodwill at someone who is arming against it.
  const traders = alive.filter((c) => c.doctrine.posture === "TRADE");
  if (traders.length >= 2) {
    for (const c of traders) {
      const partner = byId.get(c.id)!;
      const gain = Math.round(partner.population * 0.05);
      partner.stock = { ...partner.stock, wealth: round2(partner.stock.wealth + gain) };
      events.push({ tick, civ: c.id, kind: "TRADED", detail: `commerce avec ${traders.length - 1} voisin(s), +${gain} richesse` });
    }
  }

  for (const aggressor of alive
    .filter((c) => c.doctrine.posture === "PRESSURE")
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const attacker = byId.get(aggressor.id)!;

    /**
     * You can only take what you border.
     *
     * This is what the board changed. Before, an aggressor picked the weakest
     * civilisation anywhere in the world and took an abstract acre from it;
     * now it can only reach across a frontier it actually shares, so who is
     * exposed to whom is a fact about the map and not about a sort order.
     */
    const candidates = board
      .map((place, i) => ({ place, i }))
      .filter((x) => x.place.owner !== null && x.place.owner !== aggressor.id)
      .filter((x) => neighbours(world.size, x.i).some((n) => board[n]!.owner === aggressor.id))
      // What it covets first, then the weakest owner, then the lowest index.
      .sort(
        (a, b) =>
          Number(b.place.kind === attacker.doctrine.claim) - Number(a.place.kind === attacker.doctrine.claim) ||
          (byId.get(a.place.owner!)!.soldiers - byId.get(b.place.owner!)!.soldiers) ||
          a.i - b.i,
      );

    const target = candidates[0];
    if (!target) continue;

    const defender = byId.get(target.place.owner!)!;
    if (defender.territory <= 1) continue;
    // Guarding is worth something, or nobody would ever choose it over pressing.
    const defence = defender.soldiers * (defender.doctrine.posture === "GUARD" ? 1.5 : 1);
    if (attacker.soldiers <= defence * 1.2) continue;

    // The place changes hands and both sides pay for it. A seizure that costs
    // the taker nothing would make PRESSURE the only rational posture.
    board[target.i]!.owner = attacker.id;
    attacker.soldiers = Math.max(0, attacker.soldiers - Math.ceil(defence * 0.3));
    defender.soldiers = Math.max(0, defender.soldiers - Math.ceil(defender.soldiers * 0.4));

    if (defender.capital === target.i) {
      // A seat is not a field. Losing it costs people and treasure, and the
      // civilisation has to sit down somewhere else — its oldest remaining
      // place, which keeps the choice out of iteration order.
      const lost = Math.floor(defender.population * 0.15);
      defender.population = Math.max(1, defender.population - lost);
      defender.stock = { ...defender.stock, wealth: round2(defender.stock.wealth * 0.7) };
      const seat = board.findIndex((p, i) => p.owner === defender.id && i !== target.i);
      defender.capital = seat >= 0 ? seat : null;
      events.push({
        tick,
        civ: defender.id,
        kind: "CAPITAL_LOST",
        detail: `${target.place.name}, notre siege, est tombee : ${lost} morts et les coffres pilles`,
      });
      if (seat >= 0) {
        events.push({ tick, civ: defender.id, kind: "CAPITAL_MOVED", detail: `siege transfere a ${board[seat]!.name}` });
      }
    }
    // Counted here so a second aggressor this same year sees the new frontier.
    defender.territory -= 1;
    attacker.territory += 1;
    events.push({ tick, civ: attacker.id, kind: "SEIZED", detail: `${target.place.name} prise a ${defender.id}` });
    events.push({ tick, civ: defender.id, kind: "CEDED", detail: `${target.place.name} perdue au profit de ${attacker.id}` });
  }

  return { ...world, board, civs: civs.map((c) => byId.get(c.id)!) };
}

