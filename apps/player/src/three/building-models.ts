import * as THREE from "three";
import type { BuildingEra, BuildingShape } from "./building-assets";
export {
  BUILDING_ASSETS,
  BUILDING_KINDS,
  buildingAsset,
  buildingEra,
  type BuildingAsset,
  type BuildingKind,
  type BuildingShape,
} from "./building-assets";

/**
 * Les silhouettes des bâtiments de ville, dans la langue des autres modèles :
 * peu de polygones, géométrie construite à l'appel et translatée en place, un
 * matériau par pièce. L'appelant en possède la libération (cache de modèles).
 *
 * Deux échelles. Les bâtiments tiennent dans un carré d'environ ±0,3 et
 * s'affichent réduits sur le pourtour de la case, comme les infrastructures.
 * Les remparts, eux, sont dessinés à l'échelle de la case : ils l'entourent.
 *
 * Une pièce nommée « Faction cloth » prend la couleur de la civilisation —
 * auvents du marché, bannière de l'académie —, comme les tenues des unités.
 */

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material };
type Add = (
  geometry: THREE.BufferGeometry,
  color: string,
  x: number,
  y: number,
  z: number,
  cloth?: boolean,
) => void;

function model(build: (add: Add) => void): Part[] {
  const parts: Part[] = [];
  const add: Add = (geometry, color, x, y, z, cloth = false) => {
    geometry.translate(x, y, z);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: cloth ? 0.7 : 0.85,
      flatShading: true,
    });
    if (cloth) material.name = "Faction cloth";
    parts.push({ geometry, material });
  };
  build(add);
  return parts;
}

/** Un toit à deux pans : un prisme couché le long de x. */
function gable(width: number, height: number, depth: number) {
  const geometry = new THREE.CylinderGeometry(
    depth / Math.SQRT2,
    depth / Math.SQRT2,
    width,
    4,
  );
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateX(Math.PI / 4);
  geometry.scale(1, height / depth, 1);
  return geometry;
}

const STONE = "#b7ab94";
const TIMBER = "#8a6242";
const THATCH = "#c9a15a";
const TILE = "#a2543f";
const CONCRETE = "#aeb4b3";
const STEEL = "#7d8a92";
const GLASS = "#9cc7d6";

const ancient: Record<BuildingShape, (add: Add) => void> = {
  // Grenier : un silo de bois sur socle de pierre, toit de chaume conique.
  granary(add) {
    add(new THREE.BoxGeometry(0.46, 0.06, 0.46), STONE, 0, 0.03, 0);
    add(
      new THREE.CylinderGeometry(0.17, 0.19, 0.3, 10),
      TIMBER,
      -0.05,
      0.21,
      0,
    );
    add(new THREE.ConeGeometry(0.22, 0.2, 10), THATCH, -0.05, 0.46, 0);
    add(new THREE.BoxGeometry(0.07, 0.11, 0.02), "#4a3526", -0.05, 0.12, 0.19);
    add(
      new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6),
      "#d9c28e",
      0.17,
      0.1,
      0.12,
    );
    add(
      new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6),
      "#d9c28e",
      0.17,
      0.1,
      -0.02,
    );
  },
  // Atelier : halle à colombages, cheminée, enclume et bois empilé.
  workshop(add) {
    add(new THREE.BoxGeometry(0.42, 0.2, 0.3), "#d8c6a4", 0, 0.1, 0);
    add(gable(0.46, 0.14, 0.34), TILE, 0, 0.27, 0);
    add(new THREE.BoxGeometry(0.06, 0.2, 0.06), STONE, 0.13, 0.36, -0.06);
    add(new THREE.BoxGeometry(0.08, 0.06, 0.05), "#3b3b3e", -0.12, 0.03, 0.22);
    add(
      new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6).rotateZ(Math.PI / 2),
      TIMBER,
      0.1,
      0.03,
      0.22,
    );
    add(
      new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6).rotateZ(Math.PI / 2),
      TIMBER,
      0.1,
      0.075,
      0.22,
    );
  },
  // Marché : trois étals sous auvents aux couleurs de la civilisation.
  market(add) {
    add(new THREE.BoxGeometry(0.5, 0.03, 0.44), STONE, 0, 0.015, 0);
    for (const [x, z] of [
      [-0.15, -0.1],
      [0.15, -0.1],
      [0, 0.13],
    ] as const) {
      add(new THREE.BoxGeometry(0.16, 0.08, 0.1), TIMBER, x, 0.07, z);
      add(
        new THREE.BoxGeometry(0.2, 0.02, 0.15).rotateX(-0.25),
        "#cccccc",
        x,
        0.19,
        z,
        true,
      );
      add(
        new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4),
        TIMBER,
        x - 0.08,
        0.12,
        z + 0.05,
      );
      add(
        new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4),
        TIMBER,
        x + 0.08,
        0.12,
        z + 0.05,
      );
    }
    add(new THREE.BoxGeometry(0.06, 0.06, 0.06), "#9b7a4c", 0.2, 0.06, 0.16);
  },
  // Remparts : une enceinte de pierre autour de la case, quatre tours et une
  // porte ouverte au sud. Dessinés à l'échelle de la case.
  walls(add) {
    // Assez basse pour laisser voir ce qu'elle protège : à 0,11, un chantier
    // près de la porte disparaissait derrière elle.
    const h = 0.075,
      t = 0.035,
      r = 0.44;
    add(new THREE.BoxGeometry(2 * r, h, t), STONE, 0, h / 2, -r);
    add(new THREE.BoxGeometry(t, h, 2 * r), STONE, -r, h / 2, 0);
    add(new THREE.BoxGeometry(t, h, 2 * r), STONE, r, h / 2, 0);
    // Le mur sud, coupé par la porte.
    add(
      new THREE.BoxGeometry(r - 0.08, h, t),
      STONE,
      -(r + 0.08) / 2,
      h / 2,
      r,
    );
    add(new THREE.BoxGeometry(r - 0.08, h, t), STONE, (r + 0.08) / 2, h / 2, r);
    for (const [x, z] of [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ] as const) {
      add(
        new THREE.CylinderGeometry(0.04, 0.045, 0.13, 8),
        "#a89c86",
        x,
        0.065,
        z,
      );
      add(new THREE.ConeGeometry(0.05, 0.06, 8), TILE, x, 0.16, z);
    }
    add(new THREE.BoxGeometry(0.2, 0.04, 0.05), "#a89c86", 0, 0.095, r);
  },
  // Académie : un péristyle sur degrés, fronton, bannière de la civilisation.
  academy(add) {
    add(new THREE.BoxGeometry(0.5, 0.04, 0.4), STONE, 0, 0.02, 0);
    add(new THREE.BoxGeometry(0.44, 0.04, 0.34), STONE, 0, 0.06, 0);
    for (const x of [-0.17, -0.06, 0.06, 0.17])
      for (const z of [-0.12, 0.12])
        add(
          new THREE.CylinderGeometry(0.022, 0.024, 0.22, 8),
          "#e7e0d0",
          x,
          0.19,
          z,
        );
    add(new THREE.BoxGeometry(0.46, 0.04, 0.34), "#e0d7c2", 0, 0.32, 0);
    add(gable(0.46, 0.09, 0.34), "#d9ceb6", 0, 0.38, 0);
    add(new THREE.PlaneGeometry(0.07, 0.12), "#cccccc", 0.26, 0.2, 0.12, true);
  },
  // Chantier : fondations, échafaudage de perches et une chèvre de levage.
  site(add) {
    add(new THREE.BoxGeometry(0.4, 0.04, 0.32), "#8f8573", 0, 0.02, 0);
    for (const [x, z] of [
      [-0.17, -0.13],
      [0.17, -0.13],
      [0.17, 0.13],
      [-0.17, 0.13],
    ] as const)
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), TIMBER, x, 0.17, z);
    add(new THREE.BoxGeometry(0.36, 0.015, 0.015), TIMBER, 0, 0.2, -0.13);
    add(new THREE.BoxGeometry(0.36, 0.015, 0.015), TIMBER, 0, 0.2, 0.13);
    add(new THREE.BoxGeometry(0.2, 0.1, 0.16), STONE, -0.04, 0.09, 0);
    add(
      new THREE.CylinderGeometry(0.01, 0.01, 0.42, 4).rotateZ(0.5),
      TIMBER,
      0.12,
      0.2,
      0.2,
    );
  },
};

const modern: Record<BuildingShape, (add: Add) => void> = {
  // Silos : trois cuves métalliques à dôme et un convoyeur.
  granary(add) {
    add(new THREE.BoxGeometry(0.5, 0.04, 0.34), CONCRETE, 0, 0.02, 0);
    for (const x of [-0.15, 0, 0.15]) {
      add(
        new THREE.CylinderGeometry(0.065, 0.065, 0.36, 12),
        "#c7ccce",
        x,
        0.22,
        -0.03,
      );
      add(
        new THREE.SphereGeometry(0.065, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        "#9fa6a9",
        x,
        0.4,
        -0.03,
      );
    }
    add(
      new THREE.BoxGeometry(0.04, 0.04, 0.3).rotateX(0.7),
      STEEL,
      0.2,
      0.2,
      0.08,
    );
  },
  // Usine : hangar à toit en sheds et haute cheminée.
  workshop(add) {
    add(new THREE.BoxGeometry(0.46, 0.18, 0.32), "#b99a7c", 0, 0.09, 0);
    for (const x of [-0.15, 0, 0.15])
      add(new THREE.BoxGeometry(0.14, 0.07, 0.32), GLASS, x, 0.215, 0);
    add(
      new THREE.CylinderGeometry(0.03, 0.04, 0.46, 8),
      "#8a3f2e",
      0.19,
      0.23,
      -0.12,
    );
    add(new THREE.BoxGeometry(0.1, 0.1, 0.02), "#4f5559", -0.1, 0.06, 0.17);
  },
  // Halle marchande vitrée, bannière de la civilisation en façade.
  market(add) {
    add(new THREE.BoxGeometry(0.48, 0.03, 0.4), CONCRETE, 0, 0.015, 0);
    add(new THREE.BoxGeometry(0.42, 0.16, 0.3), GLASS, 0, 0.11, 0);
    add(
      new THREE.CylinderGeometry(
        0.16,
        0.16,
        0.42,
        12,
        1,
        false,
        0,
        Math.PI,
      ).rotateZ(Math.PI / 2),
      "#b8c9cf",
      0,
      0.19,
      0,
    );
    add(new THREE.BoxGeometry(0.3, 0.05, 0.01), "#cccccc", 0, 0.14, 0.16, true);
  },
  // Enceinte de béton à bastions, à l'échelle de la case.
  walls(add) {
    const h = 0.06,
      t = 0.04,
      r = 0.44;
    add(new THREE.BoxGeometry(2 * r, h, t), CONCRETE, 0, h / 2, -r);
    add(new THREE.BoxGeometry(t, h, 2 * r), CONCRETE, -r, h / 2, 0);
    add(new THREE.BoxGeometry(t, h, 2 * r), CONCRETE, r, h / 2, 0);
    add(
      new THREE.BoxGeometry(r - 0.08, h, t),
      CONCRETE,
      -(r + 0.08) / 2,
      h / 2,
      r,
    );
    add(
      new THREE.BoxGeometry(r - 0.08, h, t),
      CONCRETE,
      (r + 0.08) / 2,
      h / 2,
      r,
    );
    for (const [x, z] of [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ] as const) {
      add(
        new THREE.BoxGeometry(0.07, 0.09, 0.07).rotateY(Math.PI / 4),
        "#9ea4a3",
        x,
        0.045,
        z,
      );
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), STEEL, x, 0.14, z);
    }
  },
  // Campus : un bâtiment en L, une tour et un dôme d'observatoire.
  academy(add) {
    add(new THREE.BoxGeometry(0.46, 0.03, 0.4), CONCRETE, 0, 0.015, 0);
    add(new THREE.BoxGeometry(0.34, 0.14, 0.14), "#d5d0c6", -0.04, 0.1, -0.1);
    add(new THREE.BoxGeometry(0.14, 0.14, 0.24), "#d5d0c6", -0.15, 0.1, 0.07);
    add(new THREE.BoxGeometry(0.1, 0.34, 0.1), GLASS, 0.14, 0.2, 0.08);
    add(
      new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      "#e8ecef",
      0.06,
      0.17,
      -0.1,
    );
    add(new THREE.PlaneGeometry(0.06, 0.1), "#cccccc", 0.2, 0.3, 0.14, true);
  },
  // Chantier : échafaudage d'acier et grue à tour.
  site(add) {
    add(new THREE.BoxGeometry(0.4, 0.03, 0.32), CONCRETE, 0, 0.015, 0);
    add(new THREE.BoxGeometry(0.24, 0.14, 0.18), "#9a9f9e", -0.05, 0.1, 0);
    for (const [x, z] of [
      [-0.18, -0.1],
      [0.08, -0.1],
      [0.08, 0.1],
      [-0.18, 0.1],
    ] as const)
      add(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 4), STEEL, x, 0.15, z);
    add(new THREE.BoxGeometry(0.03, 0.5, 0.03), "#d9a93c", 0.17, 0.25, 0.1);
    add(new THREE.BoxGeometry(0.4, 0.025, 0.025), "#d9a93c", 0.05, 0.5, 0.1);
    add(
      new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4),
      "#333333",
      -0.1,
      0.4,
      0.1,
    );
  },
};

export function buildingModel(era: BuildingEra, shape: BuildingShape): Part[] {
  return model((era === "modern" ? modern : ancient)[shape]);
}
