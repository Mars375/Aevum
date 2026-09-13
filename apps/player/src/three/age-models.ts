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
