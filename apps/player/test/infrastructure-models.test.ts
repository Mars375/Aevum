import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  INFRASTRUCTURE_ASSETS,
  infrastructureModel,
  type InfrastructureKind,
} from "../src/three/infrastructure-models";

const kindOf = (
  asset: (typeof INFRASTRUCTURE_ASSETS)[number],
): InfrastructureKind => asset.slice("infra_".length) as InfrastructureKind;

/** Top-down silhouette signature: parts count plus occupied xz cells of each bounding box. */
function silhouetteSignature(
  parts: { geometry: THREE.BufferGeometry }[],
): string {
  const cell = 0.05;
  const occupied: string[] = [];
  for (const { geometry } of parts) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    for (let gx = 0; gx < 20; gx += 1) {
      for (let gz = 0; gz < 20; gz += 1) {
        const x0 = -0.5 + gx * cell;
        const z0 = -0.5 + gz * cell;
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

describe("infrastructure silhouettes", () => {
  it("ships exactly the six documented infrastructure assets", () => {
    expect([...INFRASTRUCTURE_ASSETS]).toEqual([
      "infra_foundry",
      "infra_thermal_plant",
      "infra_solar_array",
      "infra_research_center",
      "infra_automated_factory",
      "infra_spaceport",
    ]);
  });

  it("keeps every model finite, non-empty, above ground and within its parcel", () => {
    for (const asset of INFRASTRUCTURE_ASSETS) {
      const parts = infrastructureModel(kindOf(asset));
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
      expect(bounds.max.y).toBeLessThanOrEqual(1.3);
      expect(bounds.getSize(new THREE.Vector3()).x).toBeLessThan(1);
      expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(1);
    }
  });

  it("gives every kind a distinct silhouette signature", () => {
    const signatures = INFRASTRUCTURE_ASSETS.map((asset) =>
      silhouetteSignature(infrastructureModel(kindOf(asset))),
    );
    expect(new Set(signatures).size).toBe(INFRASTRUCTURE_ASSETS.length);
  });
});
