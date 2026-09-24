<script setup lang="ts">
import { computed } from "vue";
import type { RelationsProjection } from "../three/relations-projection";
import type { Year } from "@abs/world";

/**
 * Le monde, dessiné comme une carte.
 *
 * C'est devenu honnête avec w4 : les lieux existent en propre, chacun est
 * quelque part, et chacun a des voisins. Une frontière tracée ici est celle que
 * le moteur raisonne, pas une décoration.
 *
 * Tout est procédural — pas un fichier importé, pas une texture, comme les vues
 * de bataille. Le terrain est le fond, la frontière est le contour de l'union
 * des lieux d'un empire (c'est ce tracé, et non des cases bordées une à une,
 * qui fait lire un pays), et les villes marquent où vivent les gens.
 */
const props = defineProps<{
  year: Year;
  /** Les mêmes relations que la vue 3D : la 2D reste complète. */
  relations?: RelationsProjection;
}>();

const TERRAIN: Record<string, string> = {
  plain: "#46612c",
  forest: "#1f4a37",
  hill: "#5b564e",
  river: "#1d5673",
};

const OWNER: Record<string, string> = {
  crimson: "var(--crimson)",
  azure: "var(--azure)",
  verdant: "var(--verdant)",
  amber: "var(--amber)",
};

const LABEL: Record<string, string> = { plain: "plaine", forest: "forêt", hill: "colline", river: "fleuve" };

const S = 20; // côté d'un lieu, en unités de dessin
const size = computed(() => props.year.world.size);
const board = computed(() => props.year.world.board);
const xy = (i: number) => ({ x: (i % size.value) * S, y: Math.floor(i / size.value) * S });

/** Des coordonnées de la projection (centrées) vers celles du dessin. */
const toMap = (x: number, z: number) => ({
  x: (x + (size.value - 1) / 2) * S + S / 2,
  y: (z + (size.value - 1) / 2) * S + S / 2,
});
const RELATION_NAMES = { pact: "Pacte", trade: "Commerce", war: "Guerre" } as const;
const links = computed(() =>
  (props.relations?.links ?? []).map((link) => {
    const a = toMap(link.from[0], link.from[1]);
    const b = toMap(link.to[0], link.to[1]);
    // Une courbe, comme en 3D : deux relations entre les mêmes capitales ne
    // se confondent pas avec une frontière droite.
    // Courbée perpendiculairement au segment : vers le haut seulement, deux
    // capitales d'une même colonne restaient reliées par un trait droit.
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / length,
      ny = (b.x - a.x) / length;
    if (ny > 0 || (ny === 0 && nx > 0)) (nx = -nx), (ny = -ny);
    const bend = length * 0.22;
    const mx = (a.x + b.x) / 2 + nx * bend,
      my = (a.y + b.y) / 2 + ny * bend;
    return {
      key: `${link.kind}-${link.a}-${link.b}`,
      kind: link.kind,
      d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`,
      title: `${RELATION_NAMES[link.kind]} : ${link.a} et ${link.b}`,
    };
  }),
);
const fronts = computed(() =>
  (props.relations?.fronts ?? []).map((f, i) => {
    const a = toMap(f.x1, f.z1),
      b = toMap(f.x2, f.z2);
    return { key: i, x1: a.x - S / 2, y1: a.y - S / 2, x2: b.x - S / 2, y2: b.y - S / 2 };
  }),
);
const conquests = computed(() =>
  (props.relations?.conquests ?? []).map((c) => ({ ...c, ...toMap(c.x, c.z) })),
);

/**
 * Un nom de siège centré sur son lieu déborde de la viewBox quand le siège
 * borde la carte : « Mormar-les-Champs » se retrouvait tronqué à gauche du
 * cadre. L'ancrage suit donc la position — le texte s'écarte du bord au lieu
 * de le franchir.
 */
const anchorFor = (x: number) => {
  const w = size.value * S;
  if (x < w * 0.22) return "start";
  if (x > w * 0.78) return "end";
  return "middle";
};

/** Déterministe : le même lieu porte le même relief à chaque relecture. */
const jitter = (i: number, salt: number) => {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h >>> 0) % 1000) / 1000;
};

const cells = computed(() =>
  board.value.map((place, i) => {
    const { x, y } = xy(i);
    return { i, x, y, place, label: `${place.name} — ${LABEL[place.kind]}${place.owner ? ` — ${place.owner}` : " — libre"}` };
  }),
);

/** Les fleuves se rejoignent : un cours d'eau qui traverse, pas des flaques. */
const rivers = computed(() => {
  const out: string[] = [];
  board.value.forEach((place, i) => {
    if (place.kind !== "river") return;
    const { x, y } = xy(i);
    const cx = x + S / 2;
    const cy = y + S / 2;
    const right = i % size.value < size.value - 1 ? i + 1 : -1;
    const down = i + size.value < board.value.length ? i + size.value : -1;
    if (right >= 0 && board.value[right]!.kind === "river") out.push(`M${cx},${cy} L${cx + S},${cy}`);
    if (down >= 0 && board.value[down]!.kind === "river") out.push(`M${cx},${cy} L${cx},${cy + S}`);
    if (out.length === 0 || true) out.push(`M${cx - 4},${cy} q4,-3 8,0`);
  });
  return out.join(" ");
});

/**
 * La frontière d'un empire : les arêtes de ses lieux qui donnent sur autre chose.
 *
 * Bien plus lisible qu'un contour par case — c'est ce qui distingue un pays
 * d'une collection de carrés.
 */
const frontiers = computed(() =>
  props.year.world.civs
    .filter((c) => c.territory > 0)
    .map((civ) => {
      const seg: string[] = [];
      board.value.forEach((place, i) => {
        if (place.owner !== civ.id) return;
        const { x, y } = xy(i);
        const col = i % size.value;
        const row = Math.floor(i / size.value);
        const owns = (c: number, r: number) =>
          c >= 0 && r >= 0 && c < size.value && r < size.value && board.value[r * size.value + c]!.owner === civ.id;
        if (!owns(col, row - 1)) seg.push(`M${x},${y} L${x + S},${y}`);
        if (!owns(col, row + 1)) seg.push(`M${x},${y + S} L${x + S},${y + S}`);
        if (!owns(col - 1, row)) seg.push(`M${x},${y} L${x},${y + S}`);
        if (!owns(col + 1, row)) seg.push(`M${x + S},${y} L${x + S},${y + S}`);
      });
      return { id: civ.id, d: seg.join(" ") };
    }),
);

/** Une ville par lieu tenu, dimensionnée par la population que porte ce lieu. */
const towns = computed(() => {
  const out: Array<{ i: number; x: number; y: number; owner: string; r: number; seat: boolean; name: string }> = [];
  for (const civ of props.year.world.civs) {
    if (civ.territory === 0) continue;
    const perPlace = civ.population / civ.territory;
    const r = Math.max(1.6, Math.min(4.6, Math.sqrt(perPlace) / 3.2));
    board.value.forEach((place, i) => {
      if (place.owner !== civ.id) return;
      const { x, y } = xy(i);
      out.push({ i, x: x + S / 2, y: y + S / 2, owner: civ.id, r, seat: civ.capital === i, name: place.name });
    });
  }
  return out;
});

const neutral = computed(() => board.value.filter((p) => p.owner === null).length);
const held = computed(() => props.year.world.civs.map((c) => ({ id: c.id, n: c.territory, fallen: c.fellOnTick !== null })));
</script>

<template>
  <figure class="map">
    <svg
      :viewBox="`-2 -2 ${size * S + 4} ${size * S + 4}`"
      role="img"
      :aria-label="`Carte de ${size} sur ${size} lieux. ${held.map((h) => `${h.id} en tient ${h.n}`).join(', ')}. ${neutral} libres.`"
    >
      <defs>
        <!-- Reliefs procéduraux : rien n'est importé, comme dans les vues de bataille. -->
        <pattern id="forest" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M3,1 L4.6,4.4 L1.4,4.4 Z" fill="#2f6b4f" opacity="0.85" />
        </pattern>
        <pattern id="hill" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0.6,5 q2.6,-3.2 5.4,0" fill="none" stroke="#7b7568" stroke-width="0.9" />
        </pattern>
        <pattern id="plain" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0,4.6 L6,4.6" stroke="#5d7c3c" stroke-width="0.7" opacity="0.75" />
        </pattern>
      </defs>

      <g v-for="c in cells" :key="c.i">
        <rect :x="c.x" :y="c.y" :width="S" :height="S" :fill="TERRAIN[c.place.kind]">
          <title>{{ c.label }}</title>
        </rect>
        <rect
          v-if="c.place.kind !== 'river'"
          :x="c.x"
          :y="c.y"
          :width="S"
          :height="S"
          :fill="`url(#${c.place.kind})`"
          :opacity="0.5 + jitter(c.i, 1) * 0.35"
          pointer-events="none"
        />
      </g>

      <path :d="rivers" class="water" />

      <!-- Chaque empire d'un seul trait : c'est ce contour qui fait un pays. -->
      <path v-for="f in frontiers" :key="f.id" :d="f.d" :stroke="OWNER[f.id]" class="frontier" />

      <!-- Fronts, pactes, commerces : dessinés sous les villes, qu'ils relient. -->
      <g class="fronts">
        <line v-for="f in fronts" :key="f.key" :x1="f.x1" :y1="f.y1" :x2="f.x2" :y2="f.y2" />
      </g>
      <path v-for="l in links" :key="l.key" :d="l.d" :class="['relation', l.kind]">
        <title>{{ l.title }}</title>
      </path>

      <g v-for="t in towns" :key="`${t.owner}-${t.i}`">
        <circle :cx="t.x" :cy="t.y" :r="t.r + 1.1" fill="#05070f" opacity="0.55" />
        <circle :cx="t.x" :cy="t.y" :r="t.r" :fill="OWNER[t.owner]" />
        <circle v-if="t.seat" :cx="t.x" :cy="t.y" :r="t.r + 2.6" fill="none" :stroke="OWNER[t.owner]" stroke-width="0.9" />
        <text v-if="t.seat" :x="t.x" :y="t.y - t.r - 4" class="seat-name" :text-anchor="anchorFor(t.x)">{{ t.name }}</text>
      </g>
      <g v-for="c in conquests" :key="`${c.x}-${c.y}`" class="conquest">
        <title>Conquête : {{ c.by }} prend une case à {{ c.from }}</title>
        <line :x1="c.x - 5" :y1="c.y + 6" :x2="c.x - 5" :y2="c.y - 7" />
        <path :d="`M${c.x - 5},${c.y - 7} l7,2.5 l-7,2.5 Z`" :fill="OWNER[c.by]" />
      </g>
    </svg>

    <figcaption>
      <ul class="legend mono">
        <li v-for="h in held" :key="h.id" :class="[h.id, { fallen: h.fallen }]">
          <span class="swatch"></span>{{ h.id }} <b>{{ h.n }}</b>
        </li>
        <li class="free"><span class="swatch"></span>libres <b>{{ neutral }}</b></li>
        <li class="seat"><span class="ring"></span>siège</li>
      </ul>
    </figcaption>
  </figure>
</template>

<style scoped>
/* Les couleurs des relations sont celles du calque 3D. */
.relation { fill: none; stroke-linecap: round; }
.relation.pact { stroke: #ffd978; stroke-width: 1.8; }
.relation.trade { stroke: #7fe0d2; stroke-width: 1.1; stroke-dasharray: 3 2; }
.relation.war { stroke: #ff5f45; stroke-width: 1.4; stroke-dasharray: 4 3; }
.fronts line { stroke: #ff5f45; stroke-width: 2.2; stroke-linecap: round; }
.conquest line { stroke: #2b241f; stroke-width: 1; }
.map {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

svg {
  width: 100%;
  max-width: 480px;
  height: auto;
  display: block;
  background: #0a1020;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
}

.water {
  fill: none;
  stroke: #5fbdea;
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: 0.75;
}

.frontier {
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.seat-name {
  fill: var(--fg);
  font-size: 4.4px;
  font-family: var(--mono);
  paint-order: stroke;
  stroke: #05070f;
  stroke-width: 1.4;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: var(--muted);
}

.legend li {
  display: flex;
  align-items: center;
  gap: var(--s2);
  text-transform: capitalize;
}

.legend b {
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}

.legend .fallen {
  opacity: 0.45;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  border: 2px solid var(--border);
}

.legend .crimson .swatch { border-color: var(--crimson); }
.legend .azure .swatch { border-color: var(--azure); }
.legend .verdant .swatch { border-color: var(--verdant); }
.legend .amber .swatch { border-color: var(--amber); }
.legend .free .swatch { border-color: transparent; background: #46612c; }

.ring {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--muted);
}
</style>
