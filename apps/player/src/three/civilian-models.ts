import * as THREE from "three";
import type { Age } from "../../../../packages/world/src/ages";
import { type CivilianRole } from "./civilian-assets";
export {
  CIVILIAN_ASSETS,
  CIVILIAN_ROLES,
  type CivilianAsset,
  type CivilianRole,
} from "./civilian-assets";

/**
 * Localized civilian silhouettes for the spectator layer (visual contract).
 * Deterministic and low-poly like ageModel/infrastructureModel: each call builds
 * fresh geometry translated in place, with one MeshStandardMaterial per part. The
 * caller owns disposal (model cache). Catalog and role metadata live in the
 * Three-free civilian-assets.ts so eager UI bundles never pull the 3D engine in.
 */

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };
type Add = (
  geometry: THREE.BufferGeometry,
  color: string,
  x: number,
  y: number,
  z: number,
) => void;

function model(build: (add: Add) => void): Part[] {
  const parts: Part[] = [];
  const add: Add = (geometry, color, x, y, z) => {
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

const EARLY_AGES = ["bronze", "classical", "medieval"] as const;
type EarlyAge = (typeof EARLY_AGES)[number];

/** Box helper: small readable blocks for bodies, cargo and props. */
function box(
  add: Add,
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
) {
  add(new THREE.BoxGeometry(w, h, d), color, x, y, z);
}

/** Wheel / roller helper lying along the x axis (radius in y/z). */
function wheel(
  add: Add,
  color: string,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
) {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 8);
  geometry.rotateZ(Math.PI / 2);
  add(geometry, color, x, y, z);
}

/** Standing labourer: legs, tunic and head within the civilian footprint. */
function human(add: Add, tunic: string) {
  for (const x of [-0.02, 0.02])
    add(new THREE.BoxGeometry(0.028, 0.09, 0.028), "#3f3a33", x, 0.045, 0);
  box(add, 0.09, 0.13, 0.055, tunic, 0, 0.155, 0);
  add(new THREE.IcosahedronGeometry(0.038, 0), "#c9a67a", 0, 0.245, 0);
}

/** Bronze: conical reed cap. */
function bronzeCap(add: Add) {
  add(new THREE.ConeGeometry(0.05, 0.055, 5), "#6d4c2a", 0, 0.295, 0);
}

/** Classical: laurel head band. */
function classicalBand(add: Add) {
  add(
    new THREE.CylinderGeometry(0.043, 0.043, 0.02, 8),
    "#8a8f83",
    0,
    0.272,
    0,
  );
}

/** Medieval: pointed cloth hood. */
function medievalHood(add: Add) {
  add(new THREE.ConeGeometry(0.055, 0.08, 6), "#6b3f2c", 0, 0.298, 0);
}

function farmerProps(add: Add) {
  // Hoe on the shoulder plus a freshly seeded row of sprouts.
  const shaft = new THREE.BoxGeometry(0.012, 0.18, 0.012);
  shaft.rotateZ(0.25);
  add(shaft, "#7a5a38", 0.07, 0.15, 0.03);
  box(add, 0.05, 0.018, 0.01, "#5b6268", 0.11, 0.26, 0.03);
  for (const z of [-0.06, 0.06])
    box(add, 0.018, 0.03, 0.018, "#5a7d3a", 0.13, 0.015, z);
}

function lumberjackProps(add: Add) {
  const shaft = new THREE.BoxGeometry(0.014, 0.11, 0.014);
  shaft.rotateZ(-0.3);
  add(shaft, "#6b5335", 0.07, 0.16, 0.03);
  box(add, 0.035, 0.032, 0.012, "#4e5c63", 0.1, 0.245, 0.03);
  // Cut log bundle at the feet.
  add(
    new THREE.CylinderGeometry(0.018, 0.018, 0.045, 6),
    "#6b4a2c",
    -0.1,
    0.0225,
    -0.03,
  );
  add(
    new THREE.CylinderGeometry(0.018, 0.018, 0.045, 6),
    "#7a5633",
    -0.13,
    0.0225,
    0.03,
  );
}

function minerProps(add: Add) {
  const shaft = new THREE.BoxGeometry(0.014, 0.12, 0.014);
  shaft.rotateZ(0.3);
  add(shaft, "#6b5335", -0.07, 0.16, 0.03);
  const head = new THREE.BoxGeometry(0.05, 0.014, 0.012);
  head.rotateZ(-0.3);
  add(head, "#4a5258", -0.1, 0.235, 0.03);
  add(new THREE.OctahedronGeometry(0.02, 0), "#5e6b78", 0.1, 0.02, 0.02);
  add(new THREE.OctahedronGeometry(0.016, 0), "#77828e", 0.13, 0.016, -0.04);
}

function merchantProps(add: Add) {
  box(add, 0.04, 0.06, 0.045, "#8a5a33", 0, 0.16, -0.06); // trade pack
  box(add, 0.028, 0.03, 0.02, "#7b4f2c", -0.03, 0.115, 0.04); // satchel
  box(add, 0.045, 0.035, 0.045, "#97602f", -0.1, 0.04, -0.08); // crate
  box(add, 0.045, 0.035, 0.045, "#6d562f", -0.13, 0.04, -0.04); // crate
}

function settlerProps(add: Add) {
  // Hand cart with a packed bundle, drawn beside the settler.
  box(add, 0.05, 0.03, 0.07, "#6b4a2c", 0.12, 0.045, 0);
  wheel(add, "#3b322a", 0.12, 0.028, 0.035, 0.024, 0.015);
  wheel(add, "#3b322a", 0.12, 0.028, -0.035, 0.024, 0.015);
  box(add, 0.05, 0.045, 0.062, "#8a5a33", 0.12, 0.1, 0);
  box(add, 0.018, 0.018, 0.11, "#7a5a38", 0.07, 0.095, 0); // tow handle
}

const EARLY_STYLE: Record<
  EarlyAge,
  { tunic: string; headwear: (add: Add) => void }
> = {
  bronze: { tunic: "#9a6a4a", headwear: bronzeCap },
  classical: { tunic: "#d9cdb3", headwear: classicalBand },
  medieval: { tunic: "#7d4438", headwear: medievalHood },
};

const EARLY_PROPS: Record<CivilianRole, (add: Add) => void> = {
  farmer: farmerProps,
  lumberjack: lumberjackProps,
  miner: minerProps,
  merchant: merchantProps,
  settler: settlerProps,
};

function earlyModel(age: EarlyAge, role: CivilianRole, add: Add) {
  const style = EARLY_STYLE[age];
  human(add, style.tunic);
  style.headwear(add);
  EARLY_PROPS[role](add);
}

function steamPlow(add: Add) {
  box(add, 0.2, 0.05, 0.12, "#6a4a34", 0, 0.025, 0);
  wheel(add, "#3a3a38", -0.09, 0.05, 0, 0.05, 0.035);
  wheel(add, "#3a3a38", 0.09, 0.05, 0, 0.05, 0.035);
  box(add, 0.06, 0.1, 0.1, "#7d5638", 0, 0.11, -0.02);
  add(
    new THREE.CylinderGeometry(0.024, 0.032, 0.22, 6),
    "#4a4440",
    0,
    0.26,
    -0.02,
  );
  box(add, 0.03, 0.02, 0.03, "#33302c", 0, 0.375, -0.02);
  const blade = new THREE.BoxGeometry(0.16, 0.04, 0.015);
  blade.rotateX(0.2);
  add(blade, "#4e5c63", 0, 0.06, 0.08);
}

function steamSawCart(add: Add) {
  box(add, 0.16, 0.04, 0.1, "#5a4633", 0, 0.02, 0);
  for (const x of [-0.07, 0.07])
    for (const z of [-0.035, 0.035])
      wheel(add, "#33302c", x, 0.04, z, 0.038, 0.028);
  const log = new THREE.CylinderGeometry(0.022, 0.022, 0.09, 6);
  log.rotateX(Math.PI / 2);
  add(log, "#6b4a2c", 0.05, 0.075, 0);
  add(
    new THREE.CylinderGeometry(0.02, 0.027, 0.18, 6),
    "#4a4440",
    -0.06,
    0.13,
    -0.02,
  );
  const saw = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10);
  saw.rotateX(Math.PI / 2);
  add(saw, "#8a9298", -0.02, 0.06, 0.06);
}

function steamDrillCart(add: Add) {
  box(add, 0.16, 0.04, 0.1, "#4a5350", 0, 0.02, 0);
  for (const x of [-0.07, 0.07])
    for (const z of [-0.035, 0.035])
      wheel(add, "#33302c", x, 0.04, z, 0.038, 0.028);
  box(add, 0.06, 0.06, 0.08, "#7a6a4a", 0.01, 0.09, 0);
  add(
    new THREE.CylinderGeometry(0.02, 0.027, 0.2, 6),
    "#4a4440",
    -0.065,
    0.14,
    -0.02,
  );
  const arm = new THREE.CylinderGeometry(0.016, 0.016, 0.14, 6);
  arm.rotateX(Math.PI / 2);
  add(arm, "#5b6268", -0.01, 0.09, 0.03);
  const tip = new THREE.ConeGeometry(0.02, 0.06, 6);
  tip.rotateX(Math.PI / 2);
  add(tip, "#8a9298", -0.01, 0.09, 0.14);
  add(new THREE.OctahedronGeometry(0.018, 0), "#5e6b78", -0.09, 0.02, 0.06);
  add(new THREE.OctahedronGeometry(0.014, 0), "#77828e", -0.11, 0.018, 0.04);
}

function steamCart(add: Add) {
  box(add, 0.16, 0.04, 0.1, "#5f4a32", 0, 0.03, 0);
  for (const x of [-0.07, 0.07])
    for (const z of [-0.035, 0.035])
      wheel(add, "#33302c", x, 0.045, z, 0.04, 0.026);
  box(add, 0.1, 0.07, 0.08, "#97602f", 0, 0.1, 0); // cargo
  add(
    new THREE.CylinderGeometry(0.018, 0.024, 0.16, 6),
    "#4a4440",
    -0.065,
    0.16,
    -0.03,
  );
  for (const tilt of [-0.6, 0.6]) {
    const roof = new THREE.BoxGeometry(0.07, 0.03, 0.1);
    roof.rotateX(tilt);
    add(roof, "#a8784a", 0, 0.172, 0);
  }
}

function coveredWagon(add: Add) {
  box(add, 0.18, 0.04, 0.1, "#5f4a32", 0, 0.03, 0);
  for (const x of [-0.08, 0.08])
    for (const z of [-0.035, 0.035])
      wheel(add, "#33302c", x, 0.045, z, 0.041, 0.026);
  box(add, 0.1, 0.06, 0.09, "#caa46a", 0, 0.06, 0); // canvas body
  add(
    new THREE.CylinderGeometry(0.018, 0.024, 0.16, 6),
    "#4a4440",
    -0.075,
    0.14,
    -0.03,
  );
  const arch = new THREE.TorusGeometry(0.062, 0.011, 5, 10, Math.PI);
  arch.rotateY(-Math.PI / 2);
  add(arch, "#d8b87e", 0, 0.14, 0);
}

function tractor(add: Add) {
  box(add, 0.13, 0.07, 0.18, "#7a2f2a", 0, 0.065, 0.02);
  box(add, 0.11, 0.06, 0.08, "#5e4a33", 0.02, 0.13, -0.07);
  wheel(add, "#33302c", -0.085, 0.09, 0.06, 0.055, 0.03);
  wheel(add, "#33302c", 0.085, 0.09, 0.06, 0.055, 0.03);
  wheel(add, "#33302c", -0.07, 0.05, -0.1, 0.03, 0.022);
  wheel(add, "#33302c", 0.07, 0.05, -0.1, 0.03, 0.022);
  add(
    new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6),
    "#4a4440",
    -0.02,
    0.2,
    -0.05,
  );
  box(add, 0.02, 0.02, 0.02, "#c9a13b", 0.04, 0.09, 0.115);
}

function loggingTruck(add: Add) {
  box(add, 0.1, 0.06, 0.09, "#3f4a52", -0.035, 0.055, -0.09);
  box(add, 0.16, 0.05, 0.08, "#4a4f44", 0.005, 0.055, 0.07);
  for (const dx of [-0.03, 0.03]) {
    const log = new THREE.CylinderGeometry(0.024, 0.024, 0.1, 6);
    log.rotateX(Math.PI / 2);
    add(log, "#7a5633", 0.005 + dx, 0.095, 0.07);
  }
  for (const z of [-0.12, 0.02, 0.13]) {
    wheel(add, "#2f3236", -0.09, 0.045, z, 0.036, 0.024);
    wheel(add, "#2f3236", 0.09, 0.045, z, 0.036, 0.024);
  }
}

function mineTruck(add: Add) {
  box(add, 0.09, 0.05, 0.06, "#5a5f3f", -0.05, 0.055, -0.1);
  const bed = new THREE.BoxGeometry(0.19, 0.035, 0.11);
  bed.rotateX(-0.12);
  add(bed, "#8a5f2a", 0.03, 0.075, 0.06);
  add(new THREE.OctahedronGeometry(0.022, 0), "#5e6b78", 0.02, 0.025, 0.14);
  for (const z of [-0.11, 0.02, 0.13]) {
    wheel(add, "#2f3236", -0.09, 0.045, z, 0.036, 0.024);
    wheel(add, "#2f3236", 0.09, 0.045, z, 0.036, 0.024);
  }
}

function cargoVan(add: Add) {
  box(add, 0.09, 0.08, 0.06, "#4a5a6b", -0.04, 0.08, -0.1);
  box(add, 0.19, 0.1, 0.14, "#6b7480", 0.03, 0.085, 0.05);
  for (const z of [-0.06, 0.12]) {
    wheel(add, "#2f3236", -0.1, 0.04, z, 0.034, 0.022);
    wheel(add, "#2f3236", 0.1, 0.04, z, 0.034, 0.022);
  }
  box(add, 0.03, 0.02, 0.03, "#3a4250", 0.08, 0.14, 0.05);
}

function settlerBus(add: Add) {
  box(add, 0.16, 0.09, 0.34, "#7a3f2a", 0, 0.075, -0.02);
  box(add, 0.15, 0.02, 0.34, "#8a4a33", 0, 0.13, -0.02);
  box(add, 0.154, 0.03, 0.28, "#9fb6c4", 0, 0.095, -0.02);
  for (const z of [-0.14, 0, 0.14]) {
    wheel(add, "#2f3236", -0.085, 0.04, z, 0.032, 0.02);
    wheel(add, "#2f3236", 0.085, 0.04, z, 0.032, 0.02);
  }
}

function farmingDrone(add: Add) {
  const hull = new THREE.OctahedronGeometry(0.06, 0);
  hull.scale(1, 0.55, 1.5);
  add(hull, "#8fd6cf", 0, 0.22, 0);
  for (const x of [-0.12, 0.12])
    for (const z of [-0.05, 0.05]) {
      box(add, 0.12, 0.015, 0.015, "#4f7a72", x / 2, 0.215, z);
      add(
        new THREE.CylinderGeometry(0.032, 0.02, 0.03, 8),
        "#63b8ae",
        x,
        0.21,
        z,
      );
    }
  box(add, 0.26, 0.012, 0.012, "#6aa89f", 0, 0.185, 0.14); // spray boom
  box(add, 0.012, 0.02, 0.012, "#a8e6d8", 0, 0.17, 0.16); // nozzle
  for (const x of [-0.05, 0.05])
    box(add, 0.012, 0.16, 0.012, "#4f7a72", x, 0.08, 0); // landing legs
}

function reforestRobot(add: Add) {
  box(add, 0.03, 0.09, 0.03, "#5a6b70", -0.045, 0.045, 0);
  box(add, 0.03, 0.09, 0.03, "#5a6b70", 0.045, 0.045, 0);
  box(add, 0.12, 0.1, 0.08, "#6f858b", 0, 0.14, 0);
  box(add, 0.05, 0.05, 0.06, "#8fb9bf", 0, 0.215, 0);
  box(add, 0.056, 0.012, 0.012, "#9fd9e0", 0, 0.222, 0.035);
  box(add, 0.08, 0.02, 0.05, "#4a4f44", -0.04, 0.035, 0.07);
  add(
    new THREE.CylinderGeometry(0.008, 0.008, 0.08, 4),
    "#6b4a2c",
    0.02,
    0.09,
    0.075,
  );
  add(new THREE.ConeGeometry(0.035, 0.06, 6), "#3f7d3f", 0.02, 0.16, 0.075);
}

function miningRover(add: Add) {
  box(add, 0.2, 0.04, 0.12, "#4a5654", 0, 0.02, 0);
  for (const z of [-0.06, 0.06]) {
    wheel(add, "#33302c", -0.095, 0.04, z, 0.035, 0.026);
    wheel(add, "#33302c", 0.095, 0.04, z, 0.035, 0.026);
  }
  add(
    new THREE.SphereGeometry(0.055, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    "#7a9e94",
    0,
    0.065,
    0,
  );
  box(add, 0.1, 0.06, 0.08, "#5e6b78", 0.04, 0.06, -0.03);
  const arm = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6);
  arm.rotateX(Math.PI / 2);
  add(arm, "#5b6268", -0.04, 0.09, 0.06);
  const tip = new THREE.ConeGeometry(0.024, 0.06, 6);
  tip.rotateX(Math.PI / 2);
  add(tip, "#8a9298", -0.04, 0.09, 0.16);
}

function hoverCargo(add: Add) {
  box(add, 0.18, 0.03, 0.12, "#5a6a70", 0, 0.03, 0);
  box(add, 0.07, 0.06, 0.06, "#8a5f2a", -0.035, 0.075, 0);
  box(add, 0.06, 0.05, 0.05, "#7a8a95", 0.04, 0.095, 0);
  for (const x of [-0.08, 0.08])
    for (const z of [-0.04, 0.04])
      add(
        new THREE.CylinderGeometry(0.014, 0.02, 0.02, 6),
        "#9fd9e0",
        x,
        0.01,
        z,
      );
  add(
    new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4),
    "#4a5654",
    0.03,
    0.16,
    -0.04,
  );
  box(add, 0.03, 0.015, 0.015, "#c9e86b", 0.03, 0.235, -0.04);
}

function habitatRover(add: Add) {
  box(add, 0.18, 0.05, 0.14, "#6a7a7e", 0, 0.025, 0);
  for (const z of [-0.05, 0.05]) {
    wheel(add, "#33302c", -0.09, 0.04, z, 0.035, 0.024);
    wheel(add, "#33302c", 0.09, 0.04, z, 0.035, 0.024);
  }
  const hab = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 8);
  hab.rotateX(Math.PI / 2);
  add(hab, "#8fd2c9", 0, 0.1, 0);
  box(add, 0.1, 0.01, 0.12, "#3f6f8f", 0, 0.145, 0);
  add(
    new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4),
    "#4a5654",
    0.08,
    0.19,
    -0.03,
  );
}

const INDUSTRIAL_BUILDERS: Record<CivilianRole, (add: Add) => void> = {
  farmer: steamPlow,
  lumberjack: steamSawCart,
  miner: steamDrillCart,
  merchant: steamCart,
  settler: coveredWagon,
};

const MODERN_BUILDERS: Record<CivilianRole, (add: Add) => void> = {
  farmer: tractor,
  lumberjack: loggingTruck,
  miner: mineTruck,
  merchant: cargoVan,
  settler: settlerBus,
};

const FUTURE_BUILDERS: Record<CivilianRole, (add: Add) => void> = {
  farmer: farmingDrone,
  lumberjack: reforestRobot,
  miner: miningRover,
  merchant: hoverCargo,
  settler: habitatRover,
};

/** Builds the silhouette parts for one localized civilian asset. */
export function civilianModel(age: Age, role: CivilianRole): Part[] {
  if (age === "industrial") return model(INDUSTRIAL_BUILDERS[role]);
  if (age === "modern") return model(MODERN_BUILDERS[role]);
  if (age === "future") return model(FUTURE_BUILDERS[role]);
  return model((add) => earlyModel(age, role, add));
}
