import * as THREE from "three";
import type { FactionId, Squad, WorldState } from "@abs/contracts";

/**
 * Isometric 3D view of the battlefield.
 *
 * Built from procedural geometry only — no imported models, no sprites, no
 * borrowed assets. The visual language is the 2D player's, lifted into three
 * dimensions rather than replaced: same faction palette, and the same
 * archetype-by-shape rule, so a reader who learned the grid can read this.
 *
 * The 2D grid stays the default and stays complete. This is an alternative
 * view, not a successor.
 */

export const FACTION_COLOURS: Record<FactionId, number> = {
  crimson: 0xf87171,
  azure: 0x60a5fa,
  verdant: 0x4ade80,
  amber: 0xfbbf24,
};

const TILE = 1;

/** Archetype reads as shape here exactly as it reads as shape on the grid. */
function geometryFor(archetype: string): THREE.BufferGeometry {
  switch (archetype) {
    case "RANGED":
      return new THREE.CylinderGeometry(0.3, 0.3, 0.55, 20);
    case "SCOUT":
      // Tall and thin: the unit that trades everything for reach.
      return new THREE.ConeGeometry(0.28, 0.85, 4);
    case "HEAVY":
      return new THREE.BoxGeometry(0.62, 0.62, 0.62);
    default:
      return new THREE.BoxGeometry(0.46, 0.5, 0.46);
  }
}

interface SquadMesh {
  group: THREE.Group;
  body: THREE.Mesh;
  hpBar: THREE.Mesh;
  ring: THREE.Mesh;
  /** Where it is drawn now, and where it is heading. Movement is interpolated. */
  from: THREE.Vector3;
  to: THREE.Vector3;
}

export class BattleScene {
  readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly squads = new Map<string, SquadMesh>();
  private readonly root = new THREE.Group();
  private readonly gridSize: number;
  private raf = 0;
  private progress = 1;
  private reducedMotion = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    gridSize: number,
  ) {
    this.gridSize = gridSize;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    // Capped: this runs on modest hardware, and a battlefield of a dozen boxes
    // does not need a 3x pixel ratio.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0x020617);

    const half = gridSize / 2;
    this.camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
    this.camera.position.set(half * 1.6, half * 1.7, half * 1.6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(this.root);
    this.buildBoard();
    this.buildLights();
    this.resize();
    this.loop();
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 12, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.35);
    rim.position.set(-8, 5, -6);
    this.scene.add(rim);
  }

  private buildBoard() {
    const n = this.gridSize;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(n * TILE, 0.3, n * TILE),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.95, metalness: 0 }),
    );
    board.position.y = -0.15;
    this.root.add(board);

    // One shared geometry and material for every dark tile: 128 meshes that
    // cost one draw setup rather than 128.
    const dark = new THREE.MeshStandardMaterial({ color: 0x080d1c, roughness: 1 });
    const tile = new THREE.BoxGeometry(TILE, 0.02, TILE);
    for (let x = 0; x < n; x += 1) {
      for (let y = 0; y < n; y += 1) {
        if ((x + y) % 2 === 0) continue;
        const mesh = new THREE.Mesh(tile, dark);
        const [wx, , wz] = this.tileToWorld(x, y);
        mesh.position.set(wx, 0.005, wz);
        this.root.add(mesh);
      }
    }

    const grid = new THREE.GridHelper(n * TILE, n, 0x1e2537, 0x1e2537);
    grid.position.y = 0.02;
    this.root.add(grid);
  }

  /** Grid coordinates are y-down; the world is z-forward. */
  private tileToWorld(x: number, y: number, height = 0): [number, number, number] {
    const half = this.gridSize / 2;
    return [x - half + TILE / 2, height, y - half + TILE / 2];
  }

  private makeSquad(squad: Squad): SquadMesh {
    const colour = FACTION_COLOURS[squad.factionId];
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      geometryFor(squad.archetype),
      new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.28, roughness: 0.45 }),
    );
    body.position.y = 0.35;
    group.add(body);

    const hpBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: colour }));
    hpBar.position.y = 0.95;
    group.add(hpBar);

    // Alliance marker: a ring on the ground, so it never competes with the
    // faction colour for meaning.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide, transparent: true, opacity: 0 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);

    this.root.add(group);
    const at = new THREE.Vector3(...this.tileToWorld(squad.position.x, squad.position.y));
    group.position.copy(at);
    return { group, body, hpBar, ring, from: at.clone(), to: at.clone() };
  }

  /** Show a world state, easing squads from wherever they are currently drawn. */
  render(state: WorldState, alliedFactions: Set<string>) {
    const seen = new Set<string>();

    for (const squad of state.squads) {
      seen.add(squad.id);
      let mesh = this.squads.get(squad.id);
      if (!mesh) {
        mesh = this.makeSquad(squad);
        this.squads.set(squad.id, mesh);
      }
      mesh.from.copy(mesh.group.position);
      mesh.to.set(...this.tileToWorld(squad.position.x, squad.position.y));

      const ratio = Math.max(0, squad.hp / squad.maxHp);
      mesh.hpBar.scale.x = ratio || 0.001;
      mesh.hpBar.position.x = -(0.6 * (1 - ratio)) / 2;
      (mesh.ring.material as THREE.MeshBasicMaterial).opacity = alliedFactions.has(squad.factionId) ? 0.9 : 0;
    }

    // A destroyed squad leaves the board rather than lingering as a ghost.
    for (const [id, mesh] of this.squads) {
      if (seen.has(id)) continue;
      this.root.remove(mesh.group);
      mesh.body.geometry.dispose();
      (mesh.body.material as THREE.Material).dispose();
      this.squads.delete(id);
    }

    // Someone who asked for less motion gets the destination, not the journey.
    this.progress = this.reducedMotion ? 1 : 0;
    if (this.reducedMotion) for (const mesh of this.squads.values()) mesh.group.position.copy(mesh.to);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + 0.06);
      const eased = 1 - (1 - this.progress) ** 3;
      for (const mesh of this.squads.values()) mesh.group.position.lerpVectors(mesh.from, mesh.to, eased);
    }
    this.renderer.render(this.scene, this.camera);
  };

  /** Orbit the board. One axis only: a full trackball invites getting lost. */
  orbit(deltaX: number) {
    this.root.rotation.y += deltaX * 0.005;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth ?? this.canvas.clientWidth);
    const height = Math.max(1, Math.round(width * 0.72));
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const half = this.gridSize / 2 + 1;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const mesh of this.squads.values()) {
      mesh.body.geometry.dispose();
      (mesh.body.material as THREE.Material).dispose();
    }
    this.squads.clear();
    this.renderer.dispose();
  }
}
