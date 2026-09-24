/**
 * L'atelier 3D : voir un modèle sans jouer une partie jusqu'à lui.
 *
 * Régler une silhouette en passant par l'observatoire demandait une partie où
 * la ville a ses bâtiments, puis de guider la caméra jusqu'à elle — une
 * capture sur trois montrait la mauvaise case. Ici, la case d'une ville est
 * **projetée par le code du jeu** (`projectWorld`), avec l'éclairage de la
 * scène : ce qu'on voit est ce que la carte montrera.
 *
 * `?scene=city` (défaut) : une ville par âge, tous bâtiments, un chantier,
 * deux infrastructures. `?scene=buildings` : chaque bâtiment seul, par époque.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { newCivilizationWorld, type Year } from "@abs/world";
import { AgeSchema, type Age } from "../../../../packages/world/src/ages";
const AGES = AgeSchema.options;
import { ageModel } from "../three/age-models";
import { buildingModel } from "../three/building-models";
import {
  BUILDING_ASSETS,
  type BuildingEra,
  type BuildingShape,
} from "../three/building-assets";
import { infrastructureModel } from "../three/infrastructure-models";
import type { InfrastructureKind } from "../three/infrastructure-assets";
import { CIV_COLORS, projectWorld } from "../three/world-projection";

type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
};

function parts(asset: string): Part[] {
  if (asset.startsWith("building_")) {
    const [, era, shape] = asset.split("_");
    return buildingModel(era as BuildingEra, shape as BuildingShape);
  }
  if (asset.startsWith("infra_"))
    return infrastructureModel(asset.slice(6) as InfrastructureKind);
  const [age, kind] = asset.split("_");
  return ageModel(age as Age, kind === "soldier");
}

function place(
  group: THREE.Group,
  asset: string,
  x: number,
  z: number,
  scale: number,
  faction?: keyof typeof CIV_COLORS,
) {
  for (const part of parts(asset)) {
    const material = (m: THREE.Material) => {
      if (
        faction &&
        m.name === "Faction cloth" &&
        m instanceof THREE.MeshStandardMaterial
      ) {
        const tinted = m.clone();
        tinted.color.set(CIV_COLORS[faction]);
        return tinted;
      }
      return m;
    };
    const mesh = new THREE.Mesh(
      part.geometry,
      Array.isArray(part.material)
        ? part.material.map(material)
        : material(part.material),
    );
    mesh.position.set(x, 0.16, z);
    mesh.scale.setScalar(scale);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function tile(group: THREE.Group, x: number, z: number, color = "#819469") {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.998, 0.22, 0.998),
    new THREE.MeshStandardMaterial({ color, roughness: 0.94 }),
  );
  mesh.position.set(x, 0.05, z);
  mesh.receiveShadow = true;
  group.add(mesh);
}

/** Une ville projetée par le jeu : bâtiments, chantier, infrastructures. */
function cityTile(group: THREE.Group, age: Age, x: number, z: number) {
  const world = newCivilizationWorld(["crimson", "azure"], 42);
  const city = world.simulation!.cities[0]!;
  city.buildings = ["granary", "workshop", "market", "walls"];
  city.queue = { building: "academy", remaining: 3 };
  const year: Year = { tick: 0, world, events: [], rulings: [] };
  const sites =
    age === "industrial" || age === "modern" || age === "future"
      ? [
          { city: city.id, kind: "foundry" as const },
          { city: city.id, kind: "solar_array" as const },
        ]
      : [];
  const parcel = projectWorld(year, [year], { [city.owner]: age }, sites)[
    city.position
  ]!;
  tile(group, x, z, "#8f9d6f");
  for (const a of parcel.assets)
    if (!a.unitId) place(group, a.asset, x + a.x, z + a.z, a.scale, city.owner);
}

const params = new URLSearchParams(location.search);
const host = document.getElementById("lab")!;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#354b46");
scene.add(new THREE.HemisphereLight(0xd6e8ec, 0x4f5744, 1.8));
const sun = new THREE.DirectionalLight(0xffe4b5, 2.8);
sun.position.set(-6, 12, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -6,
  right: 6,
  top: 6,
  bottom: -6,
  near: 0.5,
  far: 35,
});
scene.add(sun);
const rim = new THREE.DirectionalLight(0x9ccad8, 1.5);
rim.position.set(6, 4, -7);
scene.add(rim);

const group = new THREE.Group();
scene.add(group);
const legend: string[] = [];
if (params.get("scene") === "buildings") {
  BUILDING_ASSETS.forEach((asset, i) => {
    const x = (i % 6) * 1.1 - 2.75,
      z = Math.floor(i / 6) * 1.3 - 0.65;
    tile(group, x, z);
    place(group, asset, x, z, asset.endsWith("_walls") ? 1 : 1.6, "azure");
  });
  legend.push(
    "Rangée du haut : époque ancienne · rangée du bas : moderne — grenier, atelier, marché, remparts, académie, chantier",
  );
} else {
  const only = params.get("age") as Age | null;
  (only ? [only] : AGES).forEach((age, i) => {
    const x = only ? 0 : (i % 3) * 1.25 - 1.25,
      z = only ? 0 : Math.floor(i / 3) * 1.25 - 0.62;
    cityTile(group, age, x, z);
  });
  legend.push(
    "Une ville par âge, projetée par le jeu : grenier, atelier, marché, remparts, chantier d'académie ; deux infrastructures à partir de l'âge industriel",
  );
}
document.getElementById("legend")!.textContent = legend.join(" ");

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(-6, 6.5, 6);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener("change", () => renderer.render(scene, camera));
function resize() {
  const { clientWidth: w, clientHeight: h } = host;
  renderer.setSize(w, h);
  const span = Number(params.get("span") ?? 2.4);
  camera.left = (-span * w) / h;
  camera.right = (span * w) / h;
  camera.top = span;
  camera.bottom = -span;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
addEventListener("resize", resize);
resize();
(window as unknown as { labReady: boolean }).labReady = true;
