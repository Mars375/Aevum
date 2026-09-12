import { z } from "zod";
import { FactionIdSchema } from "@abs/contracts";
import type { World } from "./state.js";
import { unitPath } from "./units.js";

/** Orders are intentions. Only the resolver changes positions. */
export const UnitCommandSchema = z
  .object({
    unit: z.string().min(1).max(120),
    action: z.enum([
      "move",
      "defend",
      "attack",
      "settle",
      "explore",
      "retreat",
      "escort",
    ]),
    escort: z.string().max(120).nullable().optional(),
    target: z.number().int().nonnegative(),
    reason: z.string().max(800),
  })
  .strict();
export const CommandBatchSchema = z
  .object({
    civ: FactionIdSchema,
    turn: z.number().int().nonnegative(),
    orders: z.array(UnitCommandSchema).max(64),
  })
  .strict();
export type CommandBatch = z.infer<typeof CommandBatchSchema>;
export type UnitCommand = z.infer<typeof UnitCommandSchema>;
export interface Mission extends UnitCommand {
  civ: CommandBatch["civ"];
  issuedAt: number;
  status: "active" | "completed" | "blocked" | "interrupted";
  route: number[];
  detail: string;
}
export interface CommandRejection {
  civ: string;
  unit: string | null;
  detail: string;
}

/**
 * Movement phase only: decisions use one immutable world snapshot.
 * Opposing arrivals and swaps block both sides until combat is implemented.
 * Friendly units may share a tile. Existing opposing occupants block entry,
 * even if they intend to leave, so initiative never decides who slips past.
 */
export function resolveCommands(
  input: World,
  previous: readonly Mission[],
  submissions: readonly unknown[],
) {
  if (!input.simulation)
    throw new Error("Commands require a civilization simulation");
  const world: World = {
    ...input,
    simulation: {
      ...input.simulation,
      units: input.simulation.units.map((u) => ({
        ...u,
        previous: u.position,
      })),
    },
  };
  const missions = new Map(
    previous.map((m) => [m.unit, { ...m, route: [...m.route] }]),
  );
  const rejected: CommandRejection[] = [];
  const parsed = submissions.map((batch) =>
    CommandBatchSchema.safeParse(batch),
  );
  const batches = parsed.flatMap((result) =>
    result.success ? [result.data] : [],
  );
  for (const result of parsed)
    if (!result.success)
      rejected.push({
        civ: "unknown",
        unit: null,
        detail: "Invalid command batch",
      });
  const counts = new Map<string, number>();
  for (const batch of batches)
    counts.set(batch.civ, (counts.get(batch.civ) ?? 0) + 1);
  for (const batch of batches.sort((a, b) => a.civ.localeCompare(b.civ))) {
    const civ = input.civs.find(
      (c) => c.id === batch.civ && c.fellOnTick === null,
    );
    if (!civ || batch.turn !== input.tick || counts.get(batch.civ)! > 1) {
      rejected.push({
        civ: batch.civ,
        unit: null,
        detail: "Unknown ruler, stale turn or duplicate submission",
      });
      continue;
    }
    const duplicates = new Set(
      batch.orders
        .filter((o, i, all) =>
          all.some((other, j) => j !== i && other.unit === o.unit),
        )
        .map((o) => o.unit),
    );
    for (const order of [...batch.orders].sort((a, b) =>
      a.unit.localeCompare(b.unit),
    )) {
      const unit = input.simulation.units.find(
        (u) => u.id === order.unit && u.owner === batch.civ,
      );
      const destination = input.board[order.target];
      let detail = "";
      if (duplicates.has(order.unit))
        detail = "Conflicting orders for the same unit";
      else if (!unit) detail = "Unit does not belong to this ruler";
      else if (
        order.action === "escort" &&
        (unit.role !== "soldier" ||
          !input.simulation.units.some(
            (other) =>
              other.id === order.escort &&
              other.owner === unit.owner &&
              other.id !== unit.id,
          ))
      )
        detail = "Escort requires a friendly unit and a military escort";
      else if (!destination) detail = "Target is outside the map";
      else if (
        destination.owner !== null &&
        destination.owner !== batch.civ &&
        order.action !== "attack"
      )
        detail = "Movement cannot replace an attack order";
      else if (
        order.action === "attack" &&
        (unit.role !== "soldier" ||
          !destination.owner ||
          destination.owner === unit.owner ||
          !input.simulation.relations.some(
            (r) =>
              r.status === "war" &&
              [r.a, r.b].includes(unit.owner) &&
              [r.a, r.b].includes(destination.owner!),
          ))
      )
        detail = "Attack requires an enemy territory and a declared war";
      else if (
        order.action === "settle" &&
        (unit.role !== "settler" ||
          destination.owner !== null ||
          destination.kind === "river")
      )
        detail = "A settler needs unclaimed dry land";
      else if (order.action === "defend" && unit.role !== "soldier")
        detail = "Only military units can defend";
      else if (!unitPath(input, unit, order.target).length)
        detail = "No traversable route";
      if (detail) {
        rejected.push({ civ: batch.civ, unit: order.unit, detail });
        continue;
      }
      missions.set(order.unit, {
        ...order,
        civ: batch.civ,
        issuedAt: input.tick,
        status: "active",
        route: [],
        detail: "",
      });
    }
  }
  const intents = new Map<string, number>();
  for (const [id, mission] of missions) {
    if (mission.status === "completed" || mission.status === "interrupted")
      continue;
    const unit = world.simulation!.units.find(
      (u) => u.id === id && u.owner === mission.civ,
    );
    if (!unit) {
      mission.status = "interrupted";
      mission.detail = "Unit no longer available";
      mission.route = [];
      continue;
    }
    unit.previous = unit.position;
    if (mission.action === "escort") {
      const protectedUnit = input.simulation.units.find(
        (other) => other.id === mission.escort && other.owner === unit.owner,
      );
      if (!protectedUnit) {
        mission.status = "interrupted";
        mission.detail = "L'unité escortée a disparu";
        mission.route = [];
        continue;
      }
      mission.target = protectedUnit.position;
    }
    unit.target = mission.target;
    const owner = input.board[mission.target]?.owner;
    mission.route =
      owner === null || owner === unit.owner || mission.action === "attack"
        ? unitPath(input, unit, mission.target)
        : [];
    if (!mission.route.length) {
      mission.status = "blocked";
      mission.detail = "Route no longer available";
      continue;
    }
    if (unit.position === mission.target) {
      mission.status =
        mission.action === "defend" || mission.action === "escort"
          ? "active"
          : "completed";
      unit.task = mission.action === "defend" ? "guard" : "idle";
      mission.detail = "Destination reached";
      continue;
    }
    mission.status = "active";
    if (unit.cooldown > 0) {
      unit.cooldown--;
      mission.detail = "Terrain delay";
      continue;
    }
    intents.set(id, mission.route[1]!);
  }
  for (const unit of world.simulation!.units) {
    const target = intents.get(unit.id);
    if (target === undefined) continue;
    const mission = missions.get(unit.id)!;
    const contested =
      (mission.action === "attack" && target === mission.target) ||
      input.simulation.units.some(
        (other) =>
          other.owner !== unit.owner &&
          (other.position === target || intents.get(other.id) === target),
      );
    if (contested) {
      mission.status = "blocked";
      mission.detail = "Opposing unit contests this tile";
      continue;
    }
    unit.position = target;
    unit.task = "march";
    unit.cooldown =
      input.board[target]!.kind === "river" &&
      !input.civs
        .find((c) => c.id === unit.owner)!
        .advances.includes("engineering")
        ? 1
        : 0;
    mission.route = mission.route.slice(1);
    mission.detail = "Moving toward destination";
    if (target === mission.target) {
      mission.status =
        mission.action === "defend" || mission.action === "escort"
          ? "active"
          : "completed";
      unit.task = mission.action === "defend" ? "guard" : "idle";
      mission.detail = "Destination reached";
    }
  }
  return {
    world,
    missions: [...missions.values()].sort((a, b) =>
      a.unit.localeCompare(b.unit),
    ),
    rejected,
  };
}
