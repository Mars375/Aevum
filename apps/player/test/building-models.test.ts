import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { newCivilizationWorld, type Year } from "@abs/world";
import {
  BUILDING_ASSETS,
  buildingAsset,
  buildingEra,
  buildingModel,
} from "../src/three/building-models";
import type { BuildingEra, BuildingShape } from "../src/three/building-assets";
import { projectWorld } from "../src/three/world-projection";

const bounds = (parts: { geometry: THREE.BufferGeometry }[]) => {
  const box = new THREE.Box3();
  for (const { geometry } of parts) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
  }
  return box;
};
const parse = (asset: string) => {
  const [, era, shape] = asset.split("_");
  return [era as BuildingEra, shape as BuildingShape] as const;
};

describe("les bâtiments de ville en 3D", () => {
  it("construit chaque bâtiment des deux époques, à sa taille", () => {
    expect(BUILDING_ASSETS).toHaveLength(12);
    for (const asset of BUILDING_ASSETS) {
      const [era, shape] = parse(asset);
      const parts = buildingModel(era, shape);
      expect(parts.length, asset).toBeGreaterThan(3);
      const box = bounds(parts);
      expect(box.min.y, asset).toBeGreaterThanOrEqual(-0.001);
      // Les remparts entourent la case ; le reste tient sur le pourtour.
      const reach = shape === "walls" ? 0.5 : 0.31;
      for (const v of [box.min.x, box.max.x, box.min.z, box.max.z])
        expect(Math.abs(v), `${asset} déborde`).toBeLessThanOrEqual(reach);
      // Des remparts plus hauts que la ville la cacheraient.
      if (shape === "walls") expect(box.max.y, asset).toBeLessThan(0.3);
    }
  });

  it("donne au marché et à l'académie la couleur de la civilisation", () => {
    for (const era of ["ancient", "modern"] as const)
      for (const shape of ["market", "academy"] as const)
        expect(
          buildingModel(era, shape).some(
            (part) => part.material.name === "Faction cloth",
          ),
          `${era} ${shape}`,
        ).toBe(true);
  });

  it("change de silhouette avec l'âge", () => {
    expect(buildingEra("medieval")).toBe("ancient");
    expect(buildingEra("industrial")).toBe("modern");
    expect(buildingAsset("future", "granary")).toBe("building_modern_granary");
  });
});

const yearWith = (
  buildings: string[],
  queue: { building: string; remaining: number } | null,
): Year => {
  const world = newCivilizationWorld(["crimson", "azure"], 42);
  const city = world.simulation!.cities[0]!;
  city.buildings = buildings as typeof city.buildings;
  city.queue = queue as typeof city.queue;
  return { tick: 0, world, events: [], rulings: [] };
};
const cityAssets = (year: Year, ages?: Record<string, "bronze" | "modern">) => {
  const city = year.world.simulation!.cities[0]!;
  return projectWorld(year, [year], ages)[city.position]!.assets;
};

describe("les bâtiments sur la carte", () => {
  it("montre ce que le dirigeant a construit, et son chantier", () => {
    const year = yearWith(["granary", "walls", "market"], {
      building: "academy",
      remaining: 3,
    });
    const owner = year.world.simulation!.cities[0]!.owner;
    const assets = cityAssets(year, { [owner]: "bronze" });
    const names = assets.map((a) => a.asset);
    expect(names).toContain("building_ancient_granary");
    expect(names).toContain("building_ancient_market");
    expect(names).toContain("building_ancient_site");
    expect(names).not.toContain("building_ancient_academy");
    const walls = assets.find((a) => a.asset === "building_ancient_walls")!;
    expect([walls.x, walls.z, walls.scale]).toEqual([0, 0, 1]);
    // Les bâtiments portent la civilisation, pour la couleur des auvents.
    expect(
      assets.find((a) => a.asset === "building_ancient_market")!.faction,
    ).toBe(owner);
    // Deux bâtiments, un chantier : trois places distinctes du pourtour.
    const rim = assets.filter(
      (a) => a.asset.startsWith("building_") && a.scale < 1,
    );
    expect(new Set(rim.map((a) => `${a.x},${a.z}`)).size).toBe(3);
  });

  it("suit l'époque de la civilisation", () => {
    const year = yearWith(["granary"], null);
    const owner = year.world.simulation!.cities[0]!.owner;
    expect(
      cityAssets(year, { [owner]: "modern" }).map((a) => a.asset),
    ).toContain("building_modern_granary");
  });

  it("laisse une vue archivée, sans âges, exactement comme avant", () => {
    const year = yearWith(["granary", "walls", "market", "workshop"], null);
    expect(cityAssets(year).some((a) => a.asset.startsWith("building_"))).toBe(
      false,
    );
  });
});
