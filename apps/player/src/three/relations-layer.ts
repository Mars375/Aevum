import * as THREE from "three";
import type { FactionId } from "@abs/contracts";
import type { RelationsProjection } from "./relations-projection";

/**
 * Les relations dessinées sur le monde : un calque au-dessus du paysage.
 *
 * - **Pacte** : un arc d'or pâle entre les capitales, deux anneaux entrelacés
 *   aux couleurs des alliés à son sommet, une lueur qui le parcourt.
 * - **Commerce** : un arc fin, vert d'eau, que des caravanes remontent.
 * - **Guerre** : un front rouge qui bat le long des frontières communes, ou un
 *   arc rompu entre capitales lointaines, deux lames croisées à son sommet.
 * - **Conquête** : le drapeau du vainqueur planté sur la case, de la fumée qui
 *   monte ; des flammes si c'était une capitale.
 *
 * Les matériaux sont non éclairés : une relation est une information, pas un
 * objet du monde, et elle doit se lire sous n'importe quel angle. Sans
 * mouvement demandé (\`prefers-reduced-motion\`), tout reste immobile.
 */

const ARC_BASE = 0.95;
const COLORS = {
  pact: "#ffd978",
  trade: "#7fe0d2",
  war: "#ff5f45",
  smoke: "#b9b3a8",
  flame: "#ff9a3c",
} as const;

interface Moving {
  mesh: THREE.Object3D;
  curve?: THREE.Curve<THREE.Vector3>;
  speed: number;
  phase: number;
  kind: "bead" | "spin" | "pulse" | "smoke" | "flame";
  base?: THREE.Vector3;
  material?: THREE.Material & { opacity: number };
}

export class RelationsLayer {
  readonly group = new THREE.Group();
  private moving: Moving[] = [];
  private owned: { dispose(): void }[] = [];

  constructor(private civColors: Record<FactionId, string>) {
    this.group.name = "relations";
  }

  private material<T extends THREE.Material>(material: T): T {
    this.owned.push(material);
    return material;
  }
  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.owned.push(geometry);
    return geometry;
  }
  private basic(color: string, opacity = 1) {
    return this.material(
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      }),
    );
  }

  clear() {
    for (const child of [...this.group.children]) this.group.remove(child);
    for (const item of this.owned) item.dispose();
    this.owned = [];
    this.moving = [];
  }

  update(projection: RelationsProjection) {
    this.clear();
    for (const link of projection.links)
      this.arc(link.kind, link.a, link.b, link.from, link.to);
    for (const front of projection.fronts) this.front(front);
    for (const conquest of projection.conquests) this.conquest(conquest);
  }

  private arc(
    kind: "pact" | "trade" | "war",
    a: FactionId,
    b: FactionId,
    from: readonly [number, number],
    to: readonly [number, number],
  ) {
    const start = new THREE.Vector3(from[0], ARC_BASE, from[1]);
    const end = new THREE.Vector3(to[0], ARC_BASE, to[1]);
    const distance = start.distanceTo(end);
    const middle = start.clone().lerp(end, 0.5);
    middle.y += 0.45 + distance * 0.2;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    // Réglé sur une vraie carte de 13 × 13, vue de loin : sur le plateau de
    // 5 × 5 de l'atelier, des arcs deux fois plus fins semblaient suffire.
    const radius = kind === "pact" ? 0.04 : kind === "trade" ? 0.024 : 0.032;
    const opacity = kind === "trade" ? 0.8 : 0.95;
    if (kind === "war") {
      // Un arc rompu : des tronçons, jamais une ligne continue.
      for (let n = 0; n < 12; n += 2) {
        const piece = new THREE.CatmullRomCurve3(
          [0, 0.5, 1].map((k) => curve.getPoint((n + k) / 12)),
        );
        this.group.add(
          new THREE.Mesh(
            this.geometry(new THREE.TubeGeometry(piece, 6, radius, 6)),
            this.basic(COLORS.war, opacity),
          ),
        );
      }
    } else
      this.group.add(
        new THREE.Mesh(
          this.geometry(new THREE.TubeGeometry(curve, 48, radius, 6)),
          this.basic(COLORS[kind], opacity),
        ),
      );
    const top = curve.getPoint(0.5);
    if (kind === "pact") this.rings(top, a, b);
    if (kind === "war") this.blades(top);
    // Ce qui circule : une lueur pour un pacte, trois caravanes pour un commerce.
    const beads = kind === "pact" ? 1 : kind === "trade" ? 3 : 0;
    for (let n = 0; n < beads; n++) {
      const bead = new THREE.Mesh(
        this.geometry(
          new THREE.SphereGeometry(kind === "pact" ? 0.08 : 0.055, 12, 8),
        ),
        this.basic(kind === "pact" ? "#fff6d8" : "#d9fff8"),
      );
      bead.position.copy(curve.getPoint(n / Math.max(1, beads)));
      this.group.add(bead);
      this.moving.push({
        mesh: bead,
        curve,
        speed: (kind === "pact" ? 0.18 : 0.12) / Math.max(1, distance / 4),
        phase: n / beads,
        kind: "bead",
      });
    }
  }

  /** Deux anneaux entrelacés, un par allié. */
  private rings(at: THREE.Vector3, a: FactionId, b: FactionId) {
    const emblem = new THREE.Group();
    [a, b].forEach((civ, n) => {
      const ring = new THREE.Mesh(
        this.geometry(new THREE.TorusGeometry(0.1, 0.02, 8, 28)),
        this.basic(this.civColors[civ]),
      );
      ring.position.x = n ? 0.06 : -0.06;
      ring.rotation.y = n ? Math.PI / 2 : 0;
      emblem.add(ring);
    });
    emblem.position.copy(at);
    emblem.scale.setScalar(1.8);
    this.group.add(emblem);
    this.moving.push({ mesh: emblem, speed: 0.35, phase: 0, kind: "spin" });
  }

  /** Deux lames croisées, pour une guerre qui ne se touche pas. */
  private blades(at: THREE.Vector3) {
    const emblem = new THREE.Group();
    for (const tilt of [-0.7, 0.7]) {
      const blade = new THREE.Mesh(
        this.geometry(new THREE.BoxGeometry(0.03, 0.36, 0.018)),
        this.basic("#f1d9d2"),
      );
      blade.rotation.z = tilt;
      const guard = new THREE.Mesh(
        this.geometry(new THREE.BoxGeometry(0.11, 0.022, 0.022)),
        this.basic(COLORS.war),
      );
      guard.position.set(Math.sin(tilt) * 0.11, -0.1, 0);
      guard.rotation.z = tilt;
      emblem.add(blade, guard);
    }
    emblem.position.copy(at);
    emblem.scale.setScalar(1.8);
    this.group.add(emblem);
    this.moving.push({ mesh: emblem, speed: 0.5, phase: 0, kind: "spin" });
  }

  private front(segment: { x1: number; z1: number; x2: number; z2: number }) {
    const length = Math.hypot(segment.x2 - segment.x1, segment.z2 - segment.z1);
    const material = this.basic(COLORS.war, 0.85);
    const bar = new THREE.Mesh(
      this.geometry(new THREE.BoxGeometry(length, 0.07, 0.07)),
      material,
    );
    // Un halo plus large et plus pâle : le front se voit de loin, pas
    // seulement quand on est dessus.
    const halo = new THREE.Mesh(
      this.geometry(new THREE.BoxGeometry(length, 0.03, 0.3)),
      this.basic(COLORS.war, 0.22),
    );
    halo.position.y = -0.02;
    bar.add(halo);
    bar.position.set(
      (segment.x1 + segment.x2) / 2,
      0.24,
      (segment.z1 + segment.z2) / 2,
    );
    bar.rotation.y = -Math.atan2(
      segment.z2 - segment.z1,
      segment.x2 - segment.x1,
    );
    this.group.add(bar);
    this.moving.push({
      mesh: bar,
      speed: 1.4,
      phase: (segment.x1 + segment.z1) * 0.37,
      kind: "pulse",
      material,
    });
  }

  private conquest(conquest: {
    x: number;
    z: number;
    by: FactionId;
    capital: boolean;
  }) {
    const { x, z } = conquest;
    const pole = new THREE.Mesh(
      this.geometry(new THREE.CylinderGeometry(0.012, 0.014, 0.55, 6)),
      this.basic("#3b332c"),
    );
    pole.position.set(x - 0.28, 0.16 + 0.275, z + 0.26);
    const flag = new THREE.Mesh(
      this.geometry(new THREE.PlaneGeometry(0.2, 0.12)),
      this.material(
        new THREE.MeshBasicMaterial({
          color: this.civColors[conquest.by],
          side: THREE.DoubleSide,
        }),
      ),
    );
    flag.position.set(x - 0.28 + 0.1, 0.16 + 0.49, z + 0.26);
    this.group.add(pole, flag);
    for (let n = 0; n < 5; n++) {
      const material = this.basic(COLORS.smoke, 0.4);
      const puff = new THREE.Mesh(
        this.geometry(new THREE.SphereGeometry(0.07, 10, 8)),
        material,
      );
      const base = new THREE.Vector3(
        x + 0.05 * Math.sin(n * 2.1),
        0.3,
        z + 0.05 * Math.cos(n * 1.7),
      );
      puff.position.copy(base);
      this.group.add(puff);
      this.moving.push({
        mesh: puff,
        speed: 0.28,
        phase: n / 5,
        kind: "smoke",
        base,
        material,
      });
    }
    if (conquest.capital)
      for (let n = 0; n < 3; n++) {
        const material = this.basic(COLORS.flame, 0.9);
        const flame = new THREE.Mesh(
          this.geometry(new THREE.ConeGeometry(0.07, 0.22, 6)),
          material,
        );
        const base = new THREE.Vector3(x + (n - 1) * 0.12, 0.72, z - 0.05);
        flame.position.copy(base);
        this.group.add(flame);
        this.moving.push({
          mesh: flame,
          speed: 3.1,
          phase: n * 0.33,
          kind: "flame",
          base,
          material,
        });
      }
  }

  /** Avancer les animations ; immobile quand le mouvement est réduit. */
  tick(seconds: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : seconds;
    for (const item of this.moving) {
      const u = (t * item.speed + item.phase) % 1;
      switch (item.kind) {
        case "bead":
          item.mesh.position.copy(
            item.curve!.getPoint(reducedMotion ? item.phase || 0.5 : u),
          );
          break;
        case "spin":
          item.mesh.rotation.y = t * item.speed;
          break;
        case "pulse":
          item.material!.opacity = reducedMotion
            ? 0.85
            : 0.55 +
              0.4 *
                (0.5 +
                  0.5 * Math.sin(t * item.speed * Math.PI * 2 + item.phase));
          break;
        case "smoke": {
          const rise = reducedMotion ? 0.3 + item.phase * 0.8 : u;
          item.mesh.position.set(
            item.base!.x + 0.06 * Math.sin(rise * 5),
            item.base!.y + rise * 0.9,
            item.base!.z,
          );
          item.mesh.scale.setScalar(0.7 + rise * 1.4);
          item.material!.opacity = reducedMotion ? 0.3 : 0.45 * (1 - rise);
          break;
        }
        case "flame":
          item.mesh.scale.y = reducedMotion
            ? 1
            : 0.75 + 0.45 * Math.abs(Math.sin(t * item.speed + item.phase * 6));
          break;
      }
    }
  }

  dispose() {
    this.clear();
  }
}
