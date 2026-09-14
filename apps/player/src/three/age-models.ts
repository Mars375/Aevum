import * as THREE from "three";
import type { Age } from "../../../../packages/world/src/ages";

/** Small instanced silhouettes; all geometry is owned by the scene's model cache. */
export function ageModel(age: Age, soldier: boolean) {
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] =
    [];
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
  // Later ages use a different silhouette, while historical models stay intact.
  if (age === "industrial" || age === "modern" || age === "future") {
    if (soldier && age === "industrial") {
      for (const x of [-0.035, 0.035])
        add(new THREE.BoxGeometry(0.04, 0.12, 0.045), "#3d4548", x, 0.06, 0);
      add(new THREE.BoxGeometry(0.12, 0.13, 0.065), "#617173", 0, 0.185, 0);
      add(new THREE.IcosahedronGeometry(0.04, 0), "#c7a785", 0, 0.28, 0);
      add(
        new THREE.CylinderGeometry(0.047, 0.052, 0.06, 8),
        "#354951",
        0,
        0.315,
        0,
      );
      const rifle = new THREE.BoxGeometry(0.018, 0.23, 0.02);
      rifle.rotateZ(-0.35);
      add(rifle, "#555345", 0.09, 0.19, 0.045);
      add(new THREE.BoxGeometry(0.13, 0.016, 0.075), "#b7b8a1", 0, 0.18, 0);
    } else if (soldier && age === "modern") {
      // Tracked vehicle with a forward barrel; fits the existing unit footprint.
      for (const x of [-0.12, 0.12]) {
        add(new THREE.BoxGeometry(0.07, 0.085, 0.3), "#343d3c", x, 0.05, 0);
        for (const z of [-0.1, 0, 0.1]) {
          const wheel = new THREE.CylinderGeometry(0.033, 0.033, 0.074, 8);
          wheel.rotateZ(Math.PI / 2);
          add(wheel, "#687571", x, 0.045, z);
        }
      }
      add(new THREE.BoxGeometry(0.24, 0.085, 0.25), "#728477", 0, 0.11, 0);
      add(
        new THREE.CylinderGeometry(0.075, 0.095, 0.07, 6),
        "#869286",
        0,
        0.185,
        -0.025,
      );
      const barrel = new THREE.CylinderGeometry(0.012, 0.016, 0.2, 6);
      barrel.rotateX(Math.PI / 2);
      add(barrel, "#566c65", 0, 0.19, 0.12);
    } else if (soldier) {
      // Suspended drone with four pods and a faceted central hull.
      const hull = new THREE.OctahedronGeometry(0.105, 0);
      hull.scale(1, 0.55, 1.3);
      add(hull, "#d7e5e5", 0, 0.24, 0);
      for (const x of [-0.13, 0.13])
        for (const z of [-0.1, 0.1]) {
          add(
            new THREE.BoxGeometry(0.14, 0.018, 0.018),
            "#627b83",
            x / 2,
            0.235,
            z,
          );
          add(
            new THREE.CylinderGeometry(0.045, 0.03, 0.06, 8),
            "#91bdc7",
            x,
            0.23,
            z,
          );
          add(
            new THREE.CylinderGeometry(0.025, 0.013, 0.035, 8),
            "#9be8e2",
            x,
            0.182,
            z,
          );
        }
      add(new THREE.BoxGeometry(0.035, 0.02, 0.02), "#a8f2eb", 0, 0.245, 0.13);
    } else if (age === "industrial") {
      add(new THREE.BoxGeometry(0.58, 0.25, 0.43), "#916653", 0, 0.125, 0.04);
      for (const x of [-0.2, 0, 0.2]) {
        const roof = new THREE.ConeGeometry(0.16, 0.13, 4);
        roof.rotateY(Math.PI / 4);
        roof.scale(0.85, 1, 1.5);
        add(roof, "#56676b", x, 0.315, 0.04);
        add(new THREE.BoxGeometry(0.1, 0.07, 0.012), "#d2b77c", x, 0.15, 0.262);
      }
      for (const x of [-0.21, 0.19]) {
        add(
          new THREE.CylinderGeometry(0.038, 0.06, 0.62, 8),
          "#805342",
          x,
          0.31,
          -0.22,
        );
        add(
          new THREE.CylinderGeometry(0.049, 0.049, 0.04, 8),
          "#4d4d49",
          x,
          0.62,
          -0.22,
        );
      }
    } else if (age === "modern") {
      add(new THREE.BoxGeometry(0.7, 0.025, 0.6), "#747e7a", 0, 0.0125, 0);
      for (const [x, z, height] of [
        [-0.19, -0.12, 0.7],
        [0.17, -0.08, 0.48],
        [0.04, 0.21, 0.3],
      ]) {
        add(
          new THREE.BoxGeometry(0.21, height!, 0.2),
          "#9cb2b7",
          x!,
          height! / 2 + 0.025,
          z!,
        );
        for (let y = 0.12; y < height!; y += 0.12)
          add(new THREE.BoxGeometry(0.218, 0.025, 0.208), "#496571", x!, y, z!);
        add(
          new THREE.BoxGeometry(0.23, 0.03, 0.22),
          "#d4d6ce",
          x!,
          height! + 0.04,
          z!,
        );
      }
    } else {
      add(
        new THREE.CylinderGeometry(0.35, 0.37, 0.04, 12),
        "#8da6b0",
        0,
        0.02,
        0,
      );
      add(
        new THREE.CylinderGeometry(0.09, 0.15, 0.71, 6),
        "#d6e4e5",
        0,
        0.395,
        0,
      );
      add(new THREE.ConeGeometry(0.09, 0.19, 6), "#95d9dc", 0, 0.845, 0);
      const ring = new THREE.TorusGeometry(0.22, 0.018, 5, 20);
      ring.rotateX(Math.PI / 2);
      add(ring, "#a2e4df", 0, 0.51, 0);
      for (const x of [-0.22, 0.22]) {
        add(
          new THREE.CylinderGeometry(0.055, 0.09, 0.35, 6),
          "#acc6cc",
          x,
          0.215,
          0.1,
        );
        add(new THREE.SphereGeometry(0.09, 8, 4), "#bce8e8", x, 0.39, 0.1);
        add(
          new THREE.BoxGeometry(0.19, 0.035, 0.05),
          "#688d9b",
          x / 2,
          0.32,
          0.05,
        );
      }
    }
    return parts;
  }
  const stone =
    age === "bronze" ? "#ba9470" : age === "classical" ? "#ddd2b4" : "#929b99";
  if (soldier) {
    for (const x of [-0.035, 0.035])
      add(new THREE.BoxGeometry(0.04, 0.11, 0.045), "#514d43", x, 0.055, 0);
    add(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 6), stone, 0, 0.16, 0);
    add(new THREE.IcosahedronGeometry(0.045, 0), "#c7a785", 0, 0.26, 0);
    add(
      new THREE.CylinderGeometry(0.007, 0.007, 0.36, 5),
      "#786342",
      0.1,
      0.18,
      0,
    );
    add(new THREE.ConeGeometry(0.018, 0.065, 4), "#a1aaa6", 0.1, 0.39, 0);
    if (age === "bronze") {
      const shield = new THREE.CylinderGeometry(0.063, 0.063, 0.014, 10);
      shield.rotateX(Math.PI / 2);
      add(shield, "#aa793e", -0.065, 0.17, 0.055);
    } else {
      add(
        new THREE.BoxGeometry(0.08, 0.13, 0.02),
        age === "classical" ? "#995a49" : "#677c8b",
        -0.065,
        0.16,
        0.055,
      );
      add(
        new THREE.CylinderGeometry(0.05, 0.05, 0.055, 8),
        "#aab0a9",
        0,
        0.28,
        0,
      );
      if (age === "classical")
        add(new THREE.BoxGeometry(0.018, 0.055, 0.095), "#914c38", 0, 0.325, 0);
      else add(new THREE.ConeGeometry(0.05, 0.065, 6), "#aab0a9", 0, 0.335, 0);
    }
  } else if (age === "bronze") {
    for (const [x, z] of [
      [-0.2, -0.14],
      [0.17, -0.09],
      [0, 0.2],
    ]) {
      add(
        new THREE.CylinderGeometry(0.13, 0.15, 0.19, 8),
        stone,
        x!,
        0.095,
        z!,
      );
      add(new THREE.ConeGeometry(0.18, 0.17, 8), "#827044", x!, 0.265, z!);
    }
  } else if (age === "classical") {
    add(new THREE.BoxGeometry(0.64, 0.06, 0.5), stone, 0, 0.03, 0);
    for (const x of [-0.24, -0.08, 0.08, 0.24])
      for (const z of [-0.17, 0.17])
        add(
          new THREE.CylinderGeometry(0.027, 0.034, 0.28, 8),
          stone,
          x,
          0.2,
          z,
        );
    add(new THREE.BoxGeometry(0.64, 0.055, 0.45), stone, 0, 0.365, 0);
    const roof = new THREE.ConeGeometry(0.45, 0.17, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale(1, 1, 0.75);
    add(roof, "#a16650", 0, 0.475, 0);
  } else {
    add(new THREE.BoxGeometry(0.5, 0.27, 0.42), stone, 0, 0.135, 0);
    for (const x of [-0.25, 0.25])
      for (const z of [-0.21, 0.21]) {
        add(
          new THREE.CylinderGeometry(0.075, 0.09, 0.43, 8),
          stone,
          x,
          0.215,
          z,
        );
        add(new THREE.ConeGeometry(0.105, 0.19, 8), "#516574", x, 0.525, z);
      }
    add(new THREE.BoxGeometry(0.09, 0.15, 0.025), "#554736", 0, 0.075, 0.22);
  }
  return parts;
}
