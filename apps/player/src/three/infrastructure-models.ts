import * as THREE from "three";
import { type InfrastructureKind } from "./infrastructure-assets";
export {
  INFRASTRUCTURE_ASSETS,
  type InfrastructureKind,
} from "./infrastructure-assets";

/**
 * Localized infrastructure silhouettes for the v9 spectator layer (visual contract).
 * Deterministic and low-poly like ageModel: each call builds fresh geometry that is
 * translated in place, with one MeshStandardMaterial per part. The caller owns
 * disposal (model cache). Catalog and kind metadata live in the Three-free
 * infrastructure-assets.ts so eager UI bundles never pull the 3D engine in.
 */

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };

function model(
  build: (
    add: (
      geometry: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
    ) => void,
  ) => void,
): Part[] {
  const parts: Part[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    geometry.translate(x, y, z);
    parts.push({
      geometry,
      material: new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        flatShading: true,
      }),
    });
  };
  build(add);
  return parts;
}

function foundry(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Foundry: furnace hall, door, smoking chimney and slag heap.
  add(new THREE.BoxGeometry(0.5, 0.1, 0.42), "#6b6257", 0, 0.05, 0);
  add(new THREE.BoxGeometry(0.32, 0.26, 0.28), "#8a4b35", 0, 0.23, 0.03);
  add(new THREE.BoxGeometry(0.1, 0.14, 0.02), "#3a3230", 0, 0.16, 0.17);
  add(
    new THREE.CylinderGeometry(0.045, 0.06, 0.5, 8),
    "#5d4c40",
    0.17,
    0.435,
    -0.14,
  );
  add(new THREE.BoxGeometry(0.12, 0.045, 0.12), "#443a33", 0.17, 0.705, -0.14);
  add(
    new THREE.CylinderGeometry(0.06, 0.075, 0.1, 6),
    "#c96f2c",
    -0.12,
    0.16,
    -0.1,
  );
}

function thermalPlant(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Thermal plant: tapered cooling tower with flared rim, pipe rack and small stack.
  add(new THREE.BoxGeometry(0.5, 0.06, 0.5), "#9aa39e", 0, 0.03, 0);
  add(new THREE.CylinderGeometry(0.15, 0.24, 0.46, 8), "#c3cbc5", 0, 0.29, 0);
  add(new THREE.CylinderGeometry(0.21, 0.15, 0.12, 8), "#c3cbc5", 0, 0.58, 0);
  add(new THREE.BoxGeometry(0.5, 0.03, 0.1), "#7f8a84", 0, 0.03, 0.2);
  add(
    new THREE.CylinderGeometry(0.03, 0.035, 0.18, 6),
    "#7f8a84",
    0.15,
    0.13,
    0.28,
  );
}

function solarArray(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Solar array: ground frame holding three tilted photovoltaic panels on legs.
  add(new THREE.BoxGeometry(0.48, 0.05, 0.42), "#5d666a", 0, 0.025, 0);
  for (const x of [-0.16, 0, 0.16]) {
    add(
      new THREE.BoxGeometry(0.02, 0.09, 0.02),
      "#8d979b",
      x - 0.06,
      0.09,
      -0.02,
    );
    add(
      new THREE.BoxGeometry(0.02, 0.09, 0.02),
      "#8d979b",
      x + 0.06,
      0.09,
      0.08,
    );
    const panel = new THREE.BoxGeometry(0.17, 0.018, 0.26);
    panel.rotateX(-0.5);
    add(panel, "#2e5d8f", x, 0.17, 0.05);
  }
}

function researchCenter(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Research center: institute hall under a geodesic dome with a spire.
  add(new THREE.BoxGeometry(0.5, 0.09, 0.44), "#c9c1ae", 0, 0.045, 0);
  add(new THREE.BoxGeometry(0.3, 0.18, 0.26), "#ded6c3", 0, 0.225, 0);
  add(new THREE.BoxGeometry(0.26, 0.03, 0.2), "#b7ad95", 0, 0.14, 0.02);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.012), "#6e4a2f", 0, 0.11, 0.22);
  add(
    new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    "#3f6f6e",
    0,
    0.31,
    0,
  );
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), "#59635f", 0, 0.54, 0);
  add(new THREE.BoxGeometry(0.09, 0.02, 0.09), "#59635f", 0, 0.63, 0);
}

function automatedFactory(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Automated factory: sawtooth roof over the hall plus a robot annex.
  add(new THREE.BoxGeometry(0.5, 0.06, 0.44), "#6f6a62", 0, 0.03, 0);
  add(new THREE.BoxGeometry(0.42, 0.16, 0.3), "#9a9488", 0, 0.14, 0);
  const teeth: ReadonlyArray<readonly [number, number]> = [
    [-0.15, 0.5],
    [0, -0.5],
    [0.15, 0.5],
  ];
  for (const [x, tilt] of teeth) {
    const tooth = new THREE.BoxGeometry(0.14, 0.07, 0.34);
    tooth.rotateX(tilt);
    add(tooth, "#7d8a8c", x, 0.28, 0);
  }
  add(new THREE.BoxGeometry(0.12, 0.14, 0.1), "#8ba0a3", -0.16, 0.14, 0.2);
  add(new THREE.BoxGeometry(0.08, 0.07, 0.07), "#5f777b", -0.16, 0.245, 0.2);
  add(new THREE.BoxGeometry(0.14, 0.02, 0.02), "#4f5f62", 0.02, 0.24, 0.16);
}

function spaceport(
  add: (
    g: THREE.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
  ) => void,
) {
  // Spaceport: launch pad with rocket, fins and a gantry tower.
  add(new THREE.CylinderGeometry(0.26, 0.28, 0.05, 10), "#878c89", 0, 0.025, 0);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), "#e8e6df", 0, 0.26, 0);
  add(new THREE.ConeGeometry(0.06, 0.16, 8), "#b54534", 0, 0.55, 0);
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const fin = new THREE.BoxGeometry(0.014, 0.1, 0.05);
    fin.rotateY(angle);
    add(fin, "#a9b4b8", Math.sin(angle) * 0.055, 0.14, Math.cos(angle) * 0.055);
  }
  add(new THREE.BoxGeometry(0.035, 0.5, 0.035), "#5d6a70", 0.16, 0.28, 0);
  add(new THREE.BoxGeometry(0.09, 0.02, 0.02), "#5d6a70", 0.16, 0.16, 0);
  add(new THREE.BoxGeometry(0.09, 0.02, 0.02), "#5d6a70", 0.16, 0.42, 0);
}

const BUILDERS: Record<
  InfrastructureKind,
  (add: Parameters<typeof foundry>[0]) => void
> = {
  foundry,
  thermal_plant: thermalPlant,
  solar_array: solarArray,
  research_center: researchCenter,
  automated_factory: automatedFactory,
  spaceport,
};

/** Builds the silhouette parts for one localized infrastructure kind. */
export function infrastructureModel(kind: InfrastructureKind): Part[] {
  return model(BUILDERS[kind]);
}
