/**
 * Catalog and visual kind names for the v9 infrastructure silhouettes.
 * Pure metadata, no Three dependency: importing it from the eager UI path
 * must never pull the 3D engine into the initial bundle. The procedural
 * builders that consume these kinds live in infrastructure-models.ts.
 */
export const INFRASTRUCTURE_ASSETS = [
  "infra_foundry",
  "infra_thermal_plant",
  "infra_solar_array",
  "infra_research_center",
  "infra_automated_factory",
  "infra_spaceport",
] as const;

/** Visual kind names, mirroring the world contract (excluding the infra_ prefix). */
export type InfrastructureKind =
  | "foundry"
  | "thermal_plant"
  | "solar_array"
  | "research_center"
  | "automated_factory"
  | "spaceport";

export type InfrastructureAsset = (typeof INFRASTRUCTURE_ASSETS)[number];