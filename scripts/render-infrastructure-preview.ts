/**
 * Aevum - infrastructure v9 visual QA exporter (read-only).
 *
 * Imports the ACTUAL v9 model builders (apps/player/src/three/infrastructure-models.js),
 * instantiates the six silhouettes via infrastructureModel(kind) and serializes their
 * exact indexed geometry (positions + triangle indices) with per-part material colors
 * into a task-specific mesh JSON under the OS temp directory.
 *
 * No other project file is touched; the JSON is transient and never committed.
 *
 * Run (PowerShell, repo root; esbuild from the repo workspace, because player
 * sources use extensionless relative imports that Node ESM cannot resolve):
 *   $tmp = Join-Path $env:TEMP "aevum-infra-exporter.mjs"
 *   node -e "const e=require('esbuild'); e.buildSync({entryPoints:['scripts/render-infrastructure-preview.ts'], bundle:true, platform:'node', format:'esm', outfile:process.argv[1]})" $tmp
 *   node $tmp
 *
 * Prints the absolute path of the generated JSON on stdout.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as THREE from "three";
import {
  INFRASTRUCTURE_ASSETS,
  infrastructureModel,
} from "../apps/player/src/three/infrastructure-models.js";

/** Readable French/ASCII labels for the contact sheet (no external fonts). */
const LABELS: Record<string, string> = {
  infra_foundry: "Fonderie",
  infra_thermal_plant: "Centrale thermique",
  infra_solar_array: "Parc solaire",
  infra_research_center: "Centre de recherche",
  infra_automated_factory: "Usine automatisee",
  infra_spaceport: "Spatioport",
};

interface PartData {
  positions: number[];
  triangles: number[];
  color: string;
}

function serializePart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): PartData {
  const pos = geometry.attributes.position;
  if (!pos) throw new Error("Geometry without position attribute");
  const positions: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  const index = geometry.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const triangles: number[] = [];
  for (let t = 0; t < triCount; t++) {
    for (let j = 0; j < 3; j++) {
      triangles.push(index ? index.getX(t * 3 + j) : t * 3 + j);
    }
  }
  const standard = material as THREE.MeshStandardMaterial;
  const hex = standard.color ? standard.color.getHex() : 0x888888;
  const color = "#" + hex.toString(16).padStart(6, "0");
  return { positions, triangles, color };
}

const kinds = INFRASTRUCTURE_ASSETS.map((asset) => {
  const kind = asset.slice("infra_".length);
  const parts = infrastructureModel(kind as Parameters<typeof infrastructureModel>[0]).map(
    (part) => serializePart(part.geometry, part.material),
  );
  return { kind: asset, label: LABELS[asset] ?? asset, parts };
});

const dir = mkdtempSync(join(tmpdir(), "aevum-infra-preview-"));
const outPath = join(dir, "mesh.json");
writeFileSync(outPath, JSON.stringify({ kinds }), "utf8");
console.log(outPath);