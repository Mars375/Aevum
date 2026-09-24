/**
 * Le catalogue des bâtiments de ville, sans Three.
 *
 * Les dirigeants décident de construire un grenier, un atelier, un marché,
 * des remparts ou une académie — « Chantier lancé : granary » est dans leur
 * mémoire —, mais la vue 3D n'en montrait rien : la ville suivait l'âge de sa
 * civilisation et ignorait ses bâtiments. Une décision sans trace sur la carte
 * ne se voit pas.
 *
 * Deux époques de silhouettes, parce qu'un grenier de l'âge du bronze n'est
 * pas celui de l'âge industriel : `ancient` jusqu'au Moyen Âge, `modern`
 * ensuite. Le chantier (`site`) montre un bâtiment en cours.
 *
 * Métadonnées seules : ce module est sur le chemin immédiat de l'interface, et
 * les constructeurs 3D vivent dans `building-models.ts`.
 */
import type { Age } from "../../../../packages/world/src/ages";

export const BUILDING_KINDS = [
  "granary",
  "workshop",
  "market",
  "walls",
  "academy",
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];
export const BUILDING_ERAS = ["ancient", "modern"] as const;
export type BuildingEra = (typeof BUILDING_ERAS)[number];
export type BuildingShape = BuildingKind | "site";

export const BUILDING_ASSETS = BUILDING_ERAS.flatMap((era) =>
  [...BUILDING_KINDS, "site" as const].map(
    (kind) => `building_${era}_${kind}` as const,
  ),
);
export type BuildingAsset = `building_${BuildingEra}_${BuildingShape}`;

const MODERN_AGES: readonly Age[] = ["industrial", "modern", "future"];

export function buildingEra(age: Age): BuildingEra {
  return MODERN_AGES.includes(age) ? "modern" : "ancient";
}

export function buildingAsset(age: Age, shape: BuildingShape): BuildingAsset {
  return `building_${buildingEra(age)}_${shape}`;
}
