/**
 * Catalog and role names for the civilian silhouettes (v9 spectator layer).
 * Pure metadata, no Three dependency: importing it from the eager UI path
 * must never pull the 3D engine into the initial bundle. The procedural
 * builders that consume these kinds live in civilian-models.ts.
 */
export const CIVILIAN_AGES = [
  "bronze",
  "classical",
  "medieval",
  "industrial",
  "modern",
  "future",
] as const;

/** Civilian labour roles, mirroring the unit contract (excluding soldiers). */
export const CIVILIAN_ROLES = [
  "farmer",
  "lumberjack",
  "miner",
  "merchant",
  "settler",
] as const;

/** One visual kind per age and role, named civilian_{age}_{role}. */
export const CIVILIAN_ASSETS = [
  "civilian_bronze_farmer",
  "civilian_bronze_lumberjack",
  "civilian_bronze_miner",
  "civilian_bronze_merchant",
  "civilian_bronze_settler",
  "civilian_classical_farmer",
  "civilian_classical_lumberjack",
  "civilian_classical_miner",
  "civilian_classical_merchant",
  "civilian_classical_settler",
  "civilian_medieval_farmer",
  "civilian_medieval_lumberjack",
  "civilian_medieval_miner",
  "civilian_medieval_merchant",
  "civilian_medieval_settler",
  "civilian_industrial_farmer",
  "civilian_industrial_lumberjack",
  "civilian_industrial_miner",
  "civilian_industrial_merchant",
  "civilian_industrial_settler",
  "civilian_modern_farmer",
  "civilian_modern_lumberjack",
  "civilian_modern_miner",
  "civilian_modern_merchant",
  "civilian_modern_settler",
  "civilian_future_farmer",
  "civilian_future_lumberjack",
  "civilian_future_miner",
  "civilian_future_merchant",
  "civilian_future_settler",
] as const;

export type CivilianRole = (typeof CIVILIAN_ROLES)[number];
export type CivilianAsset = (typeof CIVILIAN_ASSETS)[number];
