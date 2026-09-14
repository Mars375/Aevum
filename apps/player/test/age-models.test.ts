import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { newCivilizationWorld, type Year } from "@abs/world";
import { AgeSchema } from "../../../packages/world/src/ages";
import { ageModel } from "../src/three/age-models";
import { projectWorld, WORLD_ASSETS } from "../src/three/world-projection";

describe("age silhouettes", () => {
  it("keeps every model finite, above ground and within its parcel", () => {
    for (const age of AgeSchema.options) {
      for (const soldier of [false, true]) {
        const parts = ageModel(age, soldier);
        expect(parts.length).toBeGreaterThan(0);
        const bounds = new THREE.Box3();
        for (const { geometry, material } of parts) {
          expect(
            [...geometry.getAttribute("position").array].every(Number.isFinite),
          ).toBe(true);
          geometry.computeBoundingBox();
          bounds.union(geometry.boundingBox!);
          geometry.dispose();
          material.dispose();
        }
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
        expect(bounds.max.y).toBeLessThan(1.1);
        expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(1);
        expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(1);
      }
    }
  });

  it("projects each advanced age to its registered city and unit models without mutating the world", () => {
    const world = newCivilizationWorld(["crimson", "azure"], 42);
    const year: Year = { tick: 0, world, events: [], rulings: [] };
    const before = structuredClone(year);
    for (const age of ["industrial", "modern", "future"] as const) {
      const parcels = projectWorld(year, [year], { crimson: age, azure: age });
      for (const city of world.simulation!.cities) {
        const asset = parcels[city.position]!.assets[0]!.asset;
        expect(asset).toBe(`${age}_city`);
        expect(WORLD_ASSETS).toContain(asset);
      }
      for (const unit of world.simulation!.units.filter(
        (unit) => unit.role === "soldier",
      )) {
        const asset = parcels[unit.position]!.assets.find(
          (asset) => asset.unitId === unit.id,
        )!.asset;
        expect(asset).toBe(`${age}_soldier`);
        expect(WORLD_ASSETS).toContain(asset);
      }
    }
    expect(year).toEqual(before);
  });
});
