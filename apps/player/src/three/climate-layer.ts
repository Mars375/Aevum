import * as THREE from "three";
import type { ClimateKind } from "./climate";

/**
 * Le ciel de l'épisode climatique : neige qui tombe, poussière qui dérive,
 * poussières d'or qui montent des plaines. Des points, une seule géométrie,
 * un seul appel de rendu : l'atmosphère ne doit rien coûter à la carte.
 *
 * Immobile quand le système demande moins de mouvement ; toujours visible,
 * parce que l'épisode est une information, pas un décor.
 */
const SETTINGS: Record<
  ClimateKind,
  { count: number; color: string; size: number; opacity: number }
> = {
  winter: { count: 700, color: "#ffffff", size: 6, opacity: 0.9 },
  drought: { count: 260, color: "#e0c089", size: 5, opacity: 0.6 },
  harvest: { count: 220, color: "#ffe28a", size: 5, opacity: 0.85 },
};

/** Un disque doux : des points carrés auraient l'air de pixels morts. */
function softDisc(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

/** Un pseudo-hasard stable : l'atmosphère ne doit pas changer à chaque tour. */
function noise(i: number, salt: number) {
  let h = Math.imul(i + 1, 0x45d9f3b) ^ Math.imul(salt + 7, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h >>> 0) / 4294967296;
}

export class ClimateLayer {
  readonly group = new THREE.Group();
  private points: THREE.Points | null = null;
  private seeds: Float32Array | null = null;
  private kind: ClimateKind | null = null;
  private size = 13;
  private texture: THREE.Texture | null = null;

  set(kind: ClimateKind | null, size: number) {
    if (kind === this.kind && size === this.size) return;
    this.clear();
    this.kind = kind;
    this.size = size;
    if (!kind) return;
    const { count, color, size: pointSize, opacity } = SETTINGS[kind];
    const positions = new Float32Array(count * 3);
    this.seeds = new Float32Array(count * 3);
    const half = size / 2 + 0.5;
    for (let i = 0; i < count; i++) {
      this.seeds[i * 3] = (noise(i, 1) * 2 - 1) * half;
      this.seeds[i * 3 + 1] = noise(i, 2);
      this.seeds[i * 3 + 2] = (noise(i, 3) * 2 - 1) * half;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.texture ??= softDisc();
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: pointSize,
        map: this.texture,
        transparent: true,
        opacity,
        depthWrite: false,
        // En pixels : la caméra est orthographique, et three.js n'y applique
        // pas l'atténuation. Donnée en unités du monde (0,17), la neige
        // faisait un cinquième de pixel et ne se voyait pas.
        sizeAttenuation: false,
      }),
    );
    this.points.name = `climate-${kind}`;
    this.group.add(this.points);
    this.tick(0, true);
  }

  tick(seconds: number, reducedMotion: boolean) {
    if (!this.points || !this.seeds || !this.kind) return;
    const t = reducedMotion ? 0 : seconds;
    const positions = this.points.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const count = positions.count;
    for (let i = 0; i < count; i++) {
      const x0 = this.seeds[i * 3]!,
        phase = this.seeds[i * 3 + 1]!,
        z0 = this.seeds[i * 3 + 2]!;
      let x = x0,
        y = 0,
        z = z0;
      if (this.kind === "winter") {
        // Tombe de 3,5 à 0,2 en boucle, en oscillant un peu.
        const u = (phase + t * 0.09) % 1;
        y = 3.5 - u * 3.3;
        x = x0 + Math.sin(t * 0.8 + phase * 20) * 0.12;
      } else if (this.kind === "drought") {
        // Dérive basse, d'ouest en est, qui revient.
        const span = this.size + 1;
        x = ((x0 + t * 0.35 + span * 10) % span) - span / 2;
        y = 0.35 + phase * 0.9 + Math.sin(t * 1.3 + phase * 12) * 0.05;
      } else {
        // Monte lentement des plaines et s'efface.
        const u = (phase + t * 0.07) % 1;
        y = 0.25 + u * 1.6;
      }
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  clear() {
    if (this.points) {
      this.group.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
    }
    this.points = null;
    this.seeds = null;
    this.kind = null;
  }

  dispose() {
    this.clear();
    this.texture?.dispose();
    this.texture = null;
  }
}
