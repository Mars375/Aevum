import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CIVILIAN_ASSETS,
  CIVILIAN_ROLES,
  type CivilianAsset,
  type CivilianRole,
} from "../src/three/civilian-assets";
import { civilianModel } from "../src/three/civilian-models";
import type { Age } from "../../../packages/world/src/ages";

const ageOf = (asset: CivilianAsset): Age => {
  const age = asset.split("_")[1];
  if (!age) throw new Error(`unexpected asset name ${asset}`);
  return age as Age;
};
const roleOf = (asset: CivilianAsset): CivilianRole => {
  const role = asset.split("_")[2];
  if (!role) throw new Error(`unexpected asset name ${asset}`);
  return role as CivilianRole;
};

type Parts = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

function disposeParts(parts: Parts) {
  for (const { geometry, material } of parts) {
    geometry.dispose();
    material.dispose();
  }
}

/** Vertex/index/material signature, ignoring Three runtime UUIDs. */
function signature(parts: Parts): string {
  return parts
    .map(({ geometry, material }) => {
      const position = geometry.getAttribute("position");
      const index = geometry.getIndex();
      const standard = material as THREE.MeshStandardMaterial;
      const pos = [...position.array]
        .slice(0, 24)
        .map((value) => Math.round(value * 1000) / 1000);
      return [
        position.count,
        index?.count ?? 0,
        standard.color.getHex(),
        pos.join(","),
      ].join("|");
    })
    .join(";");
}

/** Top-down silhouette signature: parts count plus occupied xz cells. */
function silhouetteSignature(parts: Parts): string {
  const cell = 0.02;
  const occupied: string[] = [];
  for (const { geometry } of parts) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    for (let gx = 0; gx < 25; gx += 1) {
      for (let gz = 0; gz < 25; gz += 1) {
        const x0 = -0.25 + gx * cell;
        const z0 = -0.25 + gz * cell;
        const overlaps =
          box.min.x < x0 + cell &&
          box.max.x > x0 &&
          box.min.z < z0 + cell &&
          box.max.z > z0;
        if (overlaps) occupied.push(`${gx}:${gz}`);
      }
    }
  }
  return `${parts.length}|${[...new Set(occupied)].sort().join(",")}`;
}

describe("civilian silhouettes", () => {
  it("keeps all 30 assets finite, non-empty, above ground and in the unit footprint", () => {
    expect(CIVILIAN_ASSETS).toHaveLength(30);
    for (const asset of CIVILIAN_ASSETS) {
      const parts = civilianModel(ageOf(asset), roleOf(asset));
      expect(parts.length).toBeGreaterThan(0);
      const bounds = new THREE.Box3();
      for (const { geometry, material } of parts) {
        expect(
          [...geometry.getAttribute("position").array].every(Number.isFinite),
        ).toBe(true);
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        geometry.computeBoundingBox();
        bounds.union(geometry.boundingBox!);
      }
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
      expect(bounds.max.y).toBeLessThanOrEqual(0.6);
      for (const axis of ["x", "z"] as const) {
        expect(bounds.min[axis]).toBeGreaterThanOrEqual(-0.22);
        expect(bounds.max[axis]).toBeLessThanOrEqual(0.22);
      }
      disposeParts(parts);
    }
  });

  it("rebuilds every asset with identical vertex, index and color signatures", () => {
    for (const asset of CIVILIAN_ASSETS) {
      const first = civilianModel(ageOf(asset), roleOf(asset));
      const second = civilianModel(ageOf(asset), roleOf(asset));
      expect(signature(second)).toBe(signature(first));
      disposeParts(second);
      disposeParts(first);
    }
  });

  it("gives every role a distinct silhouette in industrial, modern and future", () => {
    for (const age of ["industrial", "modern", "future"] as const) {
      const models = CIVILIAN_ROLES.map((role) => civilianModel(age, role));
      const signatures = models.map(silhouetteSignature);
      expect(new Set(signatures).size).toBe(CIVILIAN_ROLES.length);
      for (const parts of models) disposeParts(parts);
    }
  });

  it("distinguishes early, modern and future civilian silhouettes", () => {
    const eraSignature = (age: Age): string => {
      const parts = CIVILIAN_ROLES.flatMap((role) => civilianModel(age, role));
      disposeParts(parts);
      return silhouetteSignature(parts);
    };
    for (const age of ["bronze", "classical", "medieval"] as const) {
      expect(eraSignature(age)).not.toBe(eraSignature("modern"));
      expect(eraSignature(age)).not.toBe(eraSignature("future"));
    }
    expect(eraSignature("modern")).not.toBe(eraSignature("future"));
  });
});
