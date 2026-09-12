import { z } from "zod";
import { FactionIdSchema } from "@abs/contracts";

export const BUILDINGS = ["granary", "workshop", "market", "walls", "academy"] as const;
export const BuildingSchema = z.enum(BUILDINGS);
export type Building = z.infer<typeof BuildingSchema>;
export const FocusSchema = z.enum(["balanced", "growth", "industry", "science", "military"]);
export const UnitRoleSchema = z.enum(["soldier", "farmer", "lumberjack", "miner", "merchant", "settler"]);
export const UnitSchema = z.object({
  id: z.string(), owner: FactionIdSchema, role: UnitRoleSchema,
  position: z.number().int().min(0), previous: z.number().int().min(0),
  target: z.number().int().min(0).nullable(),
  strength: z.number().int().min(1), cooldown: z.number().int().min(0),
  task: z.enum(["idle", "work", "guard", "march", "settle", "return"]),
});
export type WorldUnit = z.infer<typeof UnitSchema>;
export const CitySchema = z.object({
  id: z.string(), owner: FactionIdSchema, position: z.number().int().min(0),
  founded: z.number().int().min(0), buildings: z.array(BuildingSchema),
  queue: z.object({ building: BuildingSchema, remaining: z.number().int().min(1) }).nullable(),
});
export type City = z.infer<typeof CitySchema>;
export const RelationSchema = z.object({
  a: FactionIdSchema, b: FactionIdSchema,
  status: z.enum(["peace", "trade", "war"]), since: z.number().int().min(0),
  truceUntil: z.number().int().min(0),
});
export type Relation = z.infer<typeof RelationSchema>;
export const CivilizationSchema = z.object({
  cities: z.array(CitySchema).max(1024), units: z.array(UnitSchema).max(1024),
  relations: z.array(RelationSchema).max(6), nextUnit: z.number().int().min(0),
});
