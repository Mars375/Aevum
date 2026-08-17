import {
  ARCHETYPES,
  distance,
  inBounds,
  type BattleEvent,
  type FactionId,
  type Order,
  type Squad,
  type Vec2,
  type WorldState,
} from "@abs/contracts";

export interface FactionOrders {
  factionId: FactionId;
  orders: Order[];
}

export interface TurnResult {
  state: WorldState;
  events: BattleEvent[];
}

const key = (p: Vec2) => `${p.x},${p.y}`;

/**
 * Resolve one turn. Pure: no clock, no network, no randomness at ruleset v1.
 *
 * Squads are always walked in canonical id order rather than in the order the
 * generals happened to answer. That is what makes invariant I6 hold — shuffling
 * the faction list changes neither the resulting state nor the event log, so
 * simultaneity is real rather than a turn order in disguise.
 */
export function resolveTurn(
  state: WorldState,
  factionOrders: readonly FactionOrders[],
  roster: readonly string[],
  gridSize: number,
): TurnResult {
  const events: BattleEvent[] = [];
  const living = new Map(state.squads.map((s) => [s.id, s]));
  const rosterSet = new Set(roster);

  // ---- Phase 1: validation -------------------------------------------------
  const accepted = new Map<string, Order>();

  const sortedFactions = [...factionOrders].sort((a, b) => a.factionId.localeCompare(b.factionId));
  for (const { factionId, orders } of sortedFactions) {
    for (const order of orders) {
      const squad = living.get(order.squadId);
      if (!squad) {
        events.push({
          type: "ORDER_REJECTED",
          squadId: order.squadId,
          reason: rosterSet.has(order.squadId) ? "DEAD_SQUAD" : "UNKNOWN_SQUAD",
        });
        continue;
      }
      if (squad.factionId !== factionId) {
        events.push({ type: "ORDER_REJECTED", squadId: order.squadId, reason: "FOREIGN_SQUAD" });
        continue;
      }
      if (accepted.has(order.squadId)) {
        // First order wins. Taking the last would let a general stack orders to
        // get special treatment; first-wins is the deterministic choice.
        events.push({ type: "ORDER_REJECTED", squadId: order.squadId, reason: "DUPLICATE_ORDER" });
        continue;
      }
      accepted.set(order.squadId, normalise(order, squad, gridSize, events));
    }
  }

  for (const squad of [...living.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!accepted.has(squad.id)) {
      events.push({ type: "ORDER_MISSING", squadId: squad.id });
      accepted.set(squad.id, { squadId: squad.id, action: "HOLD", target: { ...squad.position } });
    }
  }

  // ---- Phase 2: simultaneous movement --------------------------------------
  const canonical = [...living.values()].sort((a, b) => a.id.localeCompare(b.id));
  const movers = new Set(canonical.filter((s) => accepted.get(s.id)!.action === "MOVE").map((s) => s.id));
  const positions = new Map(canonical.map((s) => [s.id, { ...s.position }]));

  // Iterate to a fixed point: a failed move pins its squad in place, which can
  // in turn invalidate another move. The pinned set only ever grows, so this
  // always converges — in at most one pass per squad — and the result does not
  // depend on traversal order.
  for (;;) {
    const pinned = canonical.filter((s) => !movers.has(s.id));
    const blockedTiles = new Set(pinned.map((s) => key(positions.get(s.id)!)));

    const claims = new Map<string, string[]>();
    for (const id of movers) {
      const dest = key(accepted.get(id)!.target);
      claims.set(dest, [...(claims.get(dest) ?? []), id]);
    }

    const failures = [...movers].filter((id) => {
      const dest = key(accepted.get(id)!.target);
      return claims.get(dest)!.length > 1 || blockedTiles.has(dest);
    });

    if (failures.length === 0) break;
    for (const id of failures) {
      movers.delete(id);
      events.push({ type: "MOVE_BLOCKED", squadId: id, attempted: { ...accepted.get(id)!.target } });
    }
  }

  for (const squad of canonical) {
    if (!movers.has(squad.id)) continue;
    const from = positions.get(squad.id)!;
    const to = { ...accepted.get(squad.id)!.target };
    positions.set(squad.id, to);
    events.push({ type: "MOVE_OK", squadId: squad.id, from: { ...from }, to: { ...to } });
  }

  // ---- Phase 3: simultaneous combat ----------------------------------------
  // Damage is read off a snapshot taken before any of it lands, so two squads
  // can strike each other dead in the same turn (invariant I7).
  const occupancy = new Map<string, Squad>();
  for (const squad of canonical) occupancy.set(key(positions.get(squad.id)!), squad);

  const damage = new Map<string, number>();
  for (const attacker of canonical) {
    const order = accepted.get(attacker.id)!;
    if (order.action !== "ATTACK") continue;

    const at = { ...order.target };
    const from = positions.get(attacker.id)!;
    const stats = ARCHETYPES[attacker.archetype];
    const dist = distance(from, at);

    if (dist > stats.range) {
      events.push({ type: "ATTACK_OUT_OF_RANGE", squadId: attacker.id, at, distance: dist, range: stats.range });
      continue;
    }
    const victim = occupancy.get(key(at));
    if (!victim) {
      // A target that moved away this turn dodges. Assumed consequence of
      // resolving movement before combat.
      events.push({ type: "ATTACK_MISSED", squadId: attacker.id, at });
      continue;
    }
    if (victim.factionId === attacker.factionId) {
      events.push({ type: "ATTACK_FRIENDLY_BLOCKED", squadId: attacker.id, at });
      continue;
    }
    damage.set(victim.id, (damage.get(victim.id) ?? 0) + stats.damage);
    events.push({ type: "ATTACK_HIT", squadId: attacker.id, targetSquadId: victim.id, at, damage: stats.damage });
  }

  // ---- Phase 4: simultaneous elimination -----------------------------------
  const survivors: Squad[] = [];
  const factionsBefore = new Set(canonical.map((s) => s.factionId));
  for (const squad of canonical) {
    const hp = squad.hp - (damage.get(squad.id) ?? 0);
    if (hp <= 0) {
      events.push({ type: "SQUAD_DESTROYED", squadId: squad.id, factionId: squad.factionId });
      continue;
    }
    survivors.push({ ...squad, hp, position: positions.get(squad.id)! });
  }

  const factionsAfter = new Set(survivors.map((s) => s.factionId));
  for (const factionId of [...factionsBefore].sort()) {
    if (!factionsAfter.has(factionId)) events.push({ type: "FACTION_ELIMINATED", factionId });
  }

  return { state: { turn: state.turn + 1, squads: survivors }, events };
}

/**
 * Reject what the engine cannot honour and downgrade it to HOLD. Illegal orders
 * are never quietly rewritten into something workable — the rejection is an
 * event the replay carries.
 */
function normalise(order: Order, squad: Squad, gridSize: number, events: BattleEvent[]): Order {
  const hold: Order = { squadId: order.squadId, action: "HOLD", target: { ...squad.position } };

  if (order.action === "HOLD") return hold; // A stray HOLD target is harmless: normalise, do not reject.
  if (order.action === "ATTACK") return { ...order, target: { ...order.target } };

  if (!inBounds(order.target, gridSize)) {
    events.push({ type: "ORDER_REJECTED", squadId: order.squadId, reason: "OUT_OF_BOUNDS" });
    return hold;
  }
  if (distance(squad.position, order.target) > ARCHETYPES[squad.archetype].movement) {
    events.push({ type: "ORDER_REJECTED", squadId: order.squadId, reason: "MOVE_TOO_FAR" });
    return hold;
  }
  return { ...order, target: { ...order.target } };
}
