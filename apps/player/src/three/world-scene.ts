import { ageModel } from "./age-models";
import {
  INFRASTRUCTURE_ASSETS,
  infrastructureModel,
  type InfrastructureKind,
} from "./infrastructure-models";
import { AgeSchema } from "../../../../packages/world/src/ages";
import { pathOffset, sampleOffset, type MotionOffset } from "./movement-path";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { FactionId } from "@abs/contracts";
import {
  CIV_COLORS,
  WORLD_ASSETS,
  type InfrastructureAsset,
  type WorldAsset,
  type WorldParcel,
} from "./world-projection";

interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}
const LAND = {
  plain: "#819469",
  forest: "#4f7654",
  hill: "#969785",
  river: "#4b969e",
};

/** A view only. Nothing in this renderer changes the simulated world. */
export class WorldScene {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private landscape = new THREE.Group();
  private routeLine: THREE.Line | null = null;
  private routeMarkers = new THREE.Group();
  private foundation = new THREE.Group();
  private models = new Map<WorldAsset | InfrastructureAsset, ModelPart[]>();
  private tiles: THREE.InstancedMesh | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private down = { x: 0, y: 0 };
  private frame = 0;
  private disposed = false;
  private visible = true;
  private size = 9;
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private parcels: WorldParcel[] = [];
  private activeParcel: number | null = null;
  private selection = new THREE.Mesh(
    new THREE.RingGeometry(0.21, 0.29, 48),
    new THREE.MeshBasicMaterial({
      color: "#fff0c4",
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  private tileGeometry = new THREE.BoxGeometry(0.998, 0.22, 0.998);
  private tileMaterial = new THREE.MeshStandardMaterial({ roughness: 0.94 });
  private baseMaterial = new THREE.MeshStandardMaterial({
    color: "#657066",
    roughness: 0.9,
  });
  private borderMaterials = new Map<string, THREE.LineBasicMaterial>();
  private flagGeometry = new THREE.PlaneGeometry(0.25, 0.15);
  private poleGeometry = new THREE.CylinderGeometry(0.013, 0.017, 0.85, 5);
  private poleMaterial = new THREE.MeshStandardMaterial({
    color: "#e3cba1",
    roughness: 0.8,
  });
  private flagMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private uniformMaterials = new Map<string, THREE.Material>();
  private motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private waterTime = { value: 0 };
  private unitPositions = new Map<string, number>();
  private marches: {
    mesh: THREE.InstancedMesh;
    index: number;
    target: THREE.Matrix4;
    dx: number;
    dz: number;
    path?: { dx: number; dz: number }[];
  }[] = [];
  private marchStarted = 0;
  private cameraFlight: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    started: number;
  } | null = null;
  private marchingUnits = new Map<string, MotionOffset>();
  private previousTick: number | undefined;

  constructor(
    private host: HTMLElement,
    private onPick: (index: number) => void,
    private onHover: (index: number | null) => void,
    private onFailure: () => void,
    private immersive = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Carte 3D des civilisations. Glissez pour tourner, utilisez les boutons pour zoomer et choisir une civilisation.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    host.appendChild(this.renderer.domElement);
    this.scene.add(this.landscape, this.foundation);
    if (this.immersive) {
      this.scene.background = new THREE.Color("#354b46");
      this.scene.fog = new THREE.FogExp2("#354b46", 0.025);
    }
    this.scene.add(new THREE.HemisphereLight(0xd6e8ec, 0x4f5744, 1.8));
    const sun = new THREE.DirectionalLight(0xffe4b5, 2.8);
    sun.position.set(-6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -9,
      right: 9,
      top: 9,
      bottom: -9,
      near: 0.5,
      far: 35,
    });
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9ccad8, 1.5);
    rim.position.set(6, 4, -7);
    this.scene.add(rim);
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.renderOrder = 10;
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping =
      this.immersive && !this.motionPreference.matches;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = this.immersive;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.12;
    this.controls.minZoom = 0.7;
    this.controls.maxZoom = 2.7;
    this.controls.enableZoom = this.immersive; // Scroll remains page navigation; explicit zoom buttons also work on touch.
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("start", this.cancelFocus);
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.addEventListener("pointermove", this.pointerMove);
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.pointerLeave,
    );
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = !!entry?.isIntersecting;
      if (this.visible) this.invalidate();
    });
    this.intersection.observe(host);
    document.addEventListener("visibilitychange", this.invalidate);
    this.motionPreference.addEventListener("change", this.motionChanged);
    this.reset();
    this.resize();
  }

  async load() {
    const loader = new GLTFLoader();
    await Promise.all(
      [...WORLD_ASSETS, ...INFRASTRUCTURE_ASSETS].map(async (asset) => {
        if (asset.startsWith("infra_")) {
          const parts = infrastructureModel(
            asset.slice("infra_".length) as InfrastructureKind,
          );
          if (this.disposed) this.disposeParts(parts);
          else this.models.set(asset, parts);
          return;
        }
        const age = AgeSchema.safeParse(asset.split("_")[0]);
        if (age.success) {
          const parts = ageModel(age.data, asset.endsWith("_soldier"));
          if (this.disposed) this.disposeParts(parts);
          else this.models.set(asset, parts);
          return;
        }
        const gltf = await loader.loadAsync(
          `${import.meta.env.BASE_URL}models/world/${asset}.glb`,
        );
        gltf.scene.updateMatrixWorld(true);
        const parts: ModelPart[] = [];
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const geometry = object.geometry
            .clone()
            .applyMatrix4(object.matrixWorld);
          object.geometry.dispose();
          parts.push({ geometry, material: object.material });
        });
        if (this.disposed) this.disposeParts(parts);
        else this.models.set(asset, parts);
      }),
    );
  }

  private disposeParts(parts: ModelPart[]) {
    for (const part of parts) {
      part.geometry.dispose();
      for (const material of Array.isArray(part.material)
        ? part.material
        : [part.material])
        material.dispose();
    }
  }

  private clearLandscape() {
    this.marches = [];
    this.marchingUnits.clear();
    for (const object of [...this.landscape.children]) {
      if (object instanceof THREE.LineSegments) object.geometry.dispose();
      if (object instanceof THREE.InstancedMesh) object.dispose();
      this.landscape.remove(object);
    }
    this.tiles = null;
  }

  update(
    parcels: WorldParcel[],
    size: number,
    selected: FactionId | null,
    tick?: number,
  ) {
    const consecutive =
      tick !== undefined &&
      this.previousTick !== undefined &&
      tick === this.previousTick + 1;
    this.previousTick = tick;
    if (this.disposed) return;
    const changedSize = this.size !== size || !this.foundation.children.length;
    this.size = size;
    this.parcels = parcels;
    this.clearLandscape();
    if (changedSize) {
      this.buildFoundation();
      this.reset();
      this.resize();
    }
    const matrix = new THREE.Matrix4();
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.tiles = new THREE.InstancedMesh(
      this.tileGeometry,
      this.tileMaterial,
      parcels.length,
    );
    this.tiles.receiveShadow = true;
    const placements = new Map<
      string,
      {
        asset: WorldAsset | InfrastructureAsset;
        faction?: FactionId;
        transforms: THREE.Matrix4[];
        offsets: MotionOffset[];
      }
    >();
    const nextUnitPositions = new Map<string, number>();
    const lines = new Map<string, number[]>();
    const seats = parcels.filter((parcel) => parcel.capital);
    for (const parcel of parcels) {
      const { index, place, x, z } = parcel;
      const top = place.kind === "river" ? 0.045 : 0.16;
      matrix.makeTranslation(x, top - 0.11, z);
      this.tiles.setMatrixAt(index, matrix);
      color.set(LAND[place.kind]);
      if (place.owner)
        color.lerp(
          new THREE.Color(CIV_COLORS[place.owner]),
          selected === place.owner ? 0.52 : 0.19,
        );
      if (selected && place.owner !== selected) color.multiplyScalar(0.75);
      this.tiles.setColorAt(index, color);
      for (const p of parcel.assets) {
        dummy.position.set(x + p.x, top, z + p.z);
        dummy.rotation.set(0, p.angle, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        const key = `${p.asset}:${p.faction ?? ""}`;
        const batch = placements.get(key) ?? {
          asset: p.asset,
          faction: p.faction,
          transforms: [],
          offsets: [],
        };
        batch.transforms.push(dummy.matrix.clone());
        const former = p.unitId ? this.unitPositions.get(p.unitId) : undefined;
        const route =
          p.movementPath ??
          (former === p.previousPosition ? [former!, index] : []);
        const offset =
          former !== undefined ? pathOffset(route, former, index, size) : null;
        const animate =
          this.immersive &&
          !this.motionPreference.matches &&
          consecutive &&
          former !== index &&
          !!offset;
        batch.offsets.push(animate ? offset! : { dx: 0, dz: 0 });
        if (animate && p.unitId)
          this.marchingUnits.set(
            p.unitId,
            batch.offsets[batch.offsets.length - 1]!,
          );
        if (p.unitId) nextUnitPositions.set(p.unitId, index);
        placements.set(key, batch);
      }
      if (place.owner) {
        const key = place.owner;
        const segments = lines.get(key) ?? [];
        const col = index % size,
          row = Math.floor(index / size);
        const owns = (c: number, r: number) =>
          c >= 0 &&
          r >= 0 &&
          c < size &&
          r < size &&
          parcels[r * size + c]?.place.owner === place.owner;
        const y = 0.18;
        if (!owns(col - 1, row))
          segments.push(x - 0.5, y, z - 0.5, x - 0.5, y, z + 0.5);
        if (!owns(col + 1, row))
          segments.push(x + 0.5, y, z - 0.5, x + 0.5, y, z + 0.5);
        if (!owns(col, row - 1))
          segments.push(x - 0.5, y, z - 0.5, x + 0.5, y, z - 0.5);
        if (!owns(col, row + 1))
          segments.push(x - 0.5, y, z + 0.5, x + 0.5, y, z + 0.5);
        lines.set(key, segments);
      }
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.landscape.add(this.tiles);
    const poles = new THREE.InstancedMesh(
      this.poleGeometry,
      this.poleMaterial,
      seats.length,
    );
    seats.forEach((parcel, index) => {
      matrix.makeTranslation(parcel.x + 0.32, 0.59, parcel.z - 0.3);
      poles.setMatrixAt(index, matrix);
      const faction = parcel.place.owner!;
      let material = this.flagMaterials.get(faction);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: CIV_COLORS[faction],
          side: THREE.DoubleSide,
          roughness: 0.8,
        });
        this.flagMaterials.set(faction, material);
      }
      const flag = new THREE.InstancedMesh(this.flagGeometry, material, 1);
      matrix.makeTranslation(parcel.x + 0.445, 0.91, parcel.z - 0.3);
      flag.setMatrixAt(0, matrix);
      this.landscape.add(flag);
    });
    this.landscape.add(poles);
    for (const { asset, faction, transforms, offsets } of placements.values()) {
      for (const part of this.models.get(asset) ?? []) {
        const tint = (material: THREE.Material) => {
          if (
            !faction ||
            material.name !== "Faction cloth" ||
            !(material instanceof THREE.MeshStandardMaterial)
          )
            return material;
          const key = `${material.uuid}:${faction}`;
          let uniform = this.uniformMaterials.get(key);
          if (!uniform) {
            uniform = material.clone();
            (uniform as THREE.MeshStandardMaterial).color.set(
              CIV_COLORS[faction],
            );
            this.uniformMaterials.set(key, uniform);
          }
          return uniform;
        };
        const material = Array.isArray(part.material)
          ? part.material.map(tint)
          : tint(part.material);
        const mesh = new THREE.InstancedMesh(
          part.geometry,
          material,
          transforms.length,
        );
        transforms.forEach((transform, i) => {
          const offset = offsets[i]!;
          mesh.setMatrixAt(i, transform);
          if (offset.dx || offset.dz)
            this.marches.push({ mesh, index: i, target: transform, ...offset });
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.landscape.add(mesh);
      }
    }
    this.unitPositions = nextUnitPositions;
    this.marchStarted = performance.now();
    for (const [faction, positions] of lines) {
      let material = this.borderMaterials.get(faction);
      if (!material) {
        material = new THREE.LineBasicMaterial({
          color: CIV_COLORS[faction as FactionId],
          transparent: true,
          opacity: 0.9,
        });
        this.borderMaterials.set(faction, material);
      }
      const geometry = new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      this.landscape.add(new THREE.LineSegments(geometry, material));
    }
    this.mark(this.activeParcel);
    this.invalidate();
  }

  private buildFoundation() {
    this.foundation.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material !== this.baseMaterial)
          (o.material as THREE.Material).dispose();
      }
    });
    this.foundation.clear();
    if (this.immersive) {
      // A continuous valley, not a ring of independent rocks. The playable surface
      // stays level: cosmetic elevation must never change route or unit coordinates.
      const extent = this.size * 5;
      const terrain = new THREE.PlaneGeometry(extent, extent, 144, 144);
      terrain.rotateX(-Math.PI / 2);
      const positions = terrain.getAttribute("position");
      const colors: number[] = [];
      const heightAt = (x: number, z: number) => {
        const edge = Math.max(Math.abs(x), Math.abs(z)) - this.size / 2;
        const ramp = THREE.MathUtils.smoothstep(edge, 0.6, this.size * 0.7);
        const ridge =
          1.8 + Math.sin(x * 0.43 + z * 0.2) * 0.9 + Math.cos(z * 0.65) * 0.6;
        const channel = Math.exp(
          -Math.pow((x - Math.sin(z * 0.23) * this.size * 0.35) / 2.1, 2),
        );
        return -0.14 + ramp * (ridge * 2.2 - channel * 5);
      };
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          z = positions.getZ(i),
          h = heightAt(x, z);
        positions.setY(i, h);
        const c = new THREE.Color("#65765a").lerp(
          new THREE.Color("#435454"),
          THREE.MathUtils.clamp(h / 5, 0, 1),
        );
        c.multiplyScalar(0.92 + Math.sin(x * 2.3 + z * 1.7) * 0.08);
        colors.push(c.r, c.g, c.b);
      }
      terrain.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      terrain.computeVertexNormals();
      const ground = new THREE.Mesh(
        terrain,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          flatShading: true,
        }),
      );
      ground.receiveShadow = true;
      this.foundation.add(ground);
      const waterMaterial = new THREE.MeshStandardMaterial({
        color: "#568a87",
        roughness: 0.28,
        metalness: 0.25,
        transparent: true,
        opacity: 0.78,
      });
      waterMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.aevumTime = this.waterTime;
        shader.vertexShader =
          "varying vec3 waterPoint;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nwaterPoint = position;",
          );
        shader.fragmentShader =
          "uniform float aevumTime; varying vec3 waterPoint;\n" +
          shader.fragmentShader.replace(
            "#include <color_fragment>",
            "#include <color_fragment>\nfloat ripple = sin(waterPoint.x * 8.0 + waterPoint.z * 3.0 + aevumTime * .7) * sin(waterPoint.z * 11.0 - aevumTime * .4); diffuseColor.rgb += .025 * ripple;",
          );
      };
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(extent, extent).rotateX(-Math.PI / 2),
        waterMaterial,
      );
      water.position.y = -0.3;
      this.foundation.add(water);
      const trees = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.38, 1.7, 5),
        new THREE.MeshStandardMaterial({
          color: "#284a3d",
          roughness: 1,
          flatShading: true,
        }),
        340,
      );
      const dummy = new THREE.Object3D();
      let count = 0;
      for (let i = 0; i < 500; i++) {
        const angle = i * 2.399963;
        const radius = this.size * 0.65 + Math.sqrt(i / 500) * this.size * 1.5;
        const x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius,
          h = heightAt(x, z);
        if (
          Math.max(Math.abs(x), Math.abs(z)) < this.size / 2 + 0.7 ||
          h < 0.2 ||
          count >= 340
        )
          continue;
        const scale = 0.55 + (Math.sin(i * 17.3) + 1) * 0.45;
        dummy.position.set(x, h + 0.85 * scale, z);
        dummy.scale.setScalar(scale);
        dummy.rotation.y = angle;
        dummy.updateMatrix();
        trees.setMatrixAt(count++, dummy.matrix);
      }
      trees.count = count;
      trees.castShadow = true;
      trees.receiveShadow = true;
      this.foundation.add(trees);
      return;
    }
    const base = new THREE.Mesh(
      new RoundedBoxGeometry(this.size + 0.08, 0.65, this.size + 0.08, 2, 0.1),
      this.baseMaterial,
    );
    base.position.y = -0.38;
    base.receiveShadow = true;
    base.castShadow = true;
    this.foundation.add(base);
    const strata = new THREE.Mesh(
      new RoundedBoxGeometry(this.size - 0.15, 0.19, this.size - 0.15, 2, 0.07),
      new THREE.MeshStandardMaterial({ color: "#394b4d", roughness: 1 }),
    );
    strata.position.y = -0.78;
    this.foundation.add(strata);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(this.size * 0.78, this.size * 0.79, 0.08, 96),
      new THREE.MeshStandardMaterial({ color: "#172e38", roughness: 0.95 }),
    );
    pedestal.position.y = -1.1;
    pedestal.receiveShadow = true;
    this.foundation.add(pedestal);
    for (const radius of [this.size * 0.7, this.size * 0.765]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.012, 128),
        new THREE.MeshBasicMaterial({
          color: "#547079",
          transparent: true,
          opacity: 0.36,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.05;
      this.foundation.add(ring);
    }
  }

  reset() {
    this.cancelFocus();
    this.camera.position.set(
      this.size * 1.1,
      this.size * 1.25,
      this.size * 1.45,
    );
    this.camera.zoom = this.immersive ? 1.25 : 1;
    this.controls.target.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate();
  }
  zoom(amount: number) {
    this.cancelFocus();
    this.camera.zoom = THREE.MathUtils.clamp(
      this.camera.zoom * amount,
      0.7,
      2.7,
    );
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }
  /** Follow an explicit event location, preserving the viewer's angle and zoom. */
  focusTile(index: number) {
    if (
      !this.immersive ||
      this.disposed ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.size * this.size
    )
      return;
    const parcel = this.parcels[index];
    if (!parcel) return;
    const limit = (this.size - 1) / 2;
    const to = new THREE.Vector3(
      THREE.MathUtils.clamp(parcel.x, -limit, limit),
      0,
      THREE.MathUtils.clamp(parcel.z, -limit, limit),
    );
    if (this.motionPreference.matches) {
      this.camera.position.add(to.clone().sub(this.controls.target));
      this.controls.target.copy(to);
      this.cameraFlight = null;
      this.controls.update();
    } else
      this.cameraFlight = {
        from: this.controls.target.clone(),
        to,
        started: performance.now(),
      };
    this.invalidate();
  }
  cancelFocus = () => {
    this.cameraFlight = null;
  };
  private resize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth),
      height = Math.max(1, this.host.clientHeight);
    const aspect = width / height;
    const half = this.size * (aspect < 1 ? 0.82 / aspect : 0.65);
    Object.assign(this.camera, {
      left: -half * aspect,
      right: half * aspect,
      top: half,
      bottom: -half,
    });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.invalidate();
  };
  private invalidate = () => {
    if (this.disposed || this.frame || !this.visible || document.hidden) return;
    this.frame = requestAnimationFrame((time) => {
      this.frame = 0;
      if (!this.disposed && this.visible && !document.hidden) {
        if (this.cameraFlight) {
          const flight = this.cameraFlight;
          const t = this.motionPreference.matches
            ? 1
            : THREE.MathUtils.clamp((time - flight.started) / 1200, 0, 1);
          const next = flight.from.clone().lerp(flight.to, t * t * (3 - 2 * t));
          this.camera.position.add(next.clone().sub(this.controls.target));
          this.controls.target.copy(next);
          if (t === 1) this.cameraFlight = null;
        }
        this.controls.update();
        const progress = this.motionPreference.matches
          ? 1
          : THREE.MathUtils.clamp((time - this.marchStarted) / 950, 0, 1);
        const remaining = 1 - progress * progress * (3 - 2 * progress);
        const matrix = new THREE.Matrix4();
        for (const march of this.marches) {
          matrix.copy(march.target);
          const offset = sampleOffset(march, 1 - remaining);
          matrix.elements[12]! += offset.dx;
          matrix.elements[14]! += offset.dz;
          march.mesh.setMatrixAt(march.index, matrix);
          march.mesh.instanceMatrix.needsUpdate = true;
        }
        if (progress === 1) this.marches = [];
        if (!this.motionPreference.matches) this.waterTime.value = time / 1000;
        this.renderer.render(this.scene, this.camera);
        if (this.immersive && !this.motionPreference.matches) this.invalidate();
      }
    });
  };
  private motionChanged = () => {
    this.controls.enableDamping =
      this.immersive && !this.motionPreference.matches;
    this.invalidate();
  };
  private hit(event: PointerEvent): number | null {
    if (!this.tiles) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.tiles)[0]?.instanceId ?? null;
  }
  private mark(index: number | null) {
    const parcel = index === null ? null : this.parcels[index];
    this.selection.visible = !!parcel;
    if (parcel) this.selection.position.set(parcel.x, 0.2, parcel.z);
  }
  private pointerDown = (e: PointerEvent) => {
    this.cancelFocus();
    this.down = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5)
      return;
    const index = this.hit(e);
    if (index !== null) {
      this.activeParcel = index;
      this.mark(index);
      this.onPick(index);
      this.invalidate();
    }
  };
  private pointerMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const index = this.hit(e);
    this.onHover(index);
    this.renderer.domElement.style.cursor = index === null ? "grab" : "pointer";
  };
  private pointerLeave = () => this.onHover(null);
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.onFailure();
  };

  /** CSS-pixel anchor shared with the accessible DOM order labels. */
  projectUnit(
    position: number,
    slot: number,
    unitId?: string,
  ): { x: number; y: number; visible: boolean } {
    const parcel = this.parcels[position];
    if (!parcel) return { x: 0, y: 0, visible: false };
    const progress = this.motionPreference.matches
      ? 1
      : THREE.MathUtils.clamp(
          (performance.now() - this.marchStarted) / 950,
          0,
          1,
        );
    const remaining = 1 - progress * progress * (3 - 2 * progress);
    const offset = sampleOffset(
      unitId ? this.marchingUnits.get(unitId) : undefined,
      1 - remaining,
    );
    const point = new THREE.Vector3(
      parcel.x - 0.34 + (slot % 3) * 0.25 + offset.dx,
      (parcel.place.kind === "river" ? 0.045 : 0.16) + 0.65,
      parcel.z + 0.36 - Math.floor(slot / 3) * 0.22 + offset.dz,
    ).project(this.camera);
    return {
      x: ((point.x + 1) * this.host.clientWidth) / 2,
      y: ((1 - point.y) * this.host.clientHeight) / 2,
      visible:
        point.z >= -1 &&
        point.z <= 1 &&
        Math.abs(point.x) <= 1 &&
        Math.abs(point.y) <= 1,
    };
  }

  showRoute(route: readonly number[]) {
    for (const marker of this.routeMarkers.children) {
      if (marker instanceof THREE.Mesh) {
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
      }
    }
    this.routeMarkers.clear();
    this.scene.remove(this.routeMarkers);
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      (this.routeLine.material as THREE.Material).dispose();
      this.routeLine = null;
    }
    const points = route
      .filter((i) => this.parcels[i])
      .map(
        (i) =>
          new THREE.Vector3(
            (i % this.size) - (this.size - 1) / 2,
            0.5,
            Math.floor(i / this.size) - (this.size - 1) / 2,
          ),
      );
    if (points.length > 1) {
      this.routeLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({
          color: 0xffe4a1,
          dashSize: 0.18,
          gapSize: 0.12,
          depthTest: false,
        }),
      );
      this.routeLine.computeLineDistances();
      this.routeLine.renderOrder = 10;
      this.scene.add(this.routeLine);
      if (this.immersive) {
        const destination = points[points.length - 1]!;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.19, 0.25, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffe4a1,
            side: THREE.DoubleSide,
            depthTest: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(destination);
        ring.renderOrder = 11;
        this.routeMarkers.add(ring);
        // Direction markers distinguish the journey from a political border.
        for (let i = 1; i < points.length; i++) {
          const from = points[i - 1]!,
            to = points[i]!;
          if (from.distanceToSquared(to) === 0) continue;
          const arrow = new THREE.Mesh(
            new THREE.ConeGeometry(0.055, 0.17, 3),
            new THREE.MeshBasicMaterial({ color: 0xffe4a1, depthTest: false }),
          );
          arrow.position.copy(from).lerp(to, 0.65);
          arrow.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            to.clone().sub(from).normalize(),
          );
          arrow.renderOrder = 11;
          this.routeMarkers.add(arrow);
        }
        this.scene.add(this.routeMarkers);
      }
    }
    this.invalidate();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.showRoute([]);
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.intersection.disconnect();
    document.removeEventListener("visibilitychange", this.invalidate);
    this.motionPreference.removeEventListener("change", this.motionChanged);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.removeEventListener("start", this.cancelFocus);
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown);
    canvas.removeEventListener("pointerup", this.pointerUp);
    canvas.removeEventListener("pointermove", this.pointerMove);
    canvas.removeEventListener("pointerleave", this.pointerLeave);
    canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.clearLandscape();
    this.models.forEach((parts) => this.disposeParts(parts));
    this.models.clear();
    this.foundation.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.tileGeometry.dispose();
    this.tileMaterial.dispose();
    this.flagGeometry.dispose();
    this.poleGeometry.dispose();
    this.poleMaterial.dispose();
    this.flagMaterials.forEach((material) => material.dispose());
    this.uniformMaterials.forEach((material) => material.dispose());
    this.selection.geometry.dispose();
    (this.selection.material as THREE.Material).dispose();
    this.borderMaterials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
