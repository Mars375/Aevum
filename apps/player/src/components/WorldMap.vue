<script setup lang="ts">
import { computed } from "vue";
import type { Year } from "@abs/world";

/**
 * The world, as a board.
 *
 * This is now an honest map. Until w4 a civilisation simply *had* seven plains,
 * with no elsewhere for them to come from, and drawing a landscape would have
 * invented a geography the engine did not hold. Places exist in their own right
 * now: each one is somewhere, starts unowned, and has neighbours — so a
 * frontier on this picture is the frontier the engine reasons about.
 *
 * Terrain is the fill, the owner is the border. Neutral ground keeps its
 * terrain and has no border, which is what makes an empire's edge visible at a
 * glance and unclaimed land read as still open.
 */
const props = defineProps<{ year: Year }>();

const TERRAIN: Record<string, string> = {
  plain: "#3f5f27",
  forest: "#1f4d3a",
  hill: "#54514c",
  river: "#1b4f6b",
};

const OWNER: Record<string, string> = {
  crimson: "var(--crimson)",
  azure: "var(--azure)",
  verdant: "var(--verdant)",
  amber: "var(--amber)",
};

const LABEL: Record<string, string> = { plain: "plaine", forest: "forêt", hill: "colline", river: "fleuve" };

const size = computed(() => props.year.world.size);

/** Which places changed hands or were struck this year, for a brief mark. */
const marked = computed(() => {
  const civs = new Set<string>();
  for (const e of props.year.events) {
    if (e.kind === "SEIZED" || e.kind === "EXPANDED" || e.kind === "DISASTER") civs.add(e.civ);
  }
  return civs;
});

const cells = computed(() =>
  props.year.world.board.map((place, i) => ({
    i,
    x: i % size.value,
    y: Math.floor(i / size.value),
    kind: place.kind,
    owner: place.owner,
    label: place.owner ? `${LABEL[place.kind]} — ${place.owner}` : `${LABEL[place.kind]} — libre`,
  })),
);

const held = computed(() => props.year.world.civs.map((c) => ({ id: c.id, n: c.territory, fallen: c.fellOnTick !== null })));
const neutral = computed(() => props.year.world.board.filter((p) => p.owner === null).length);
</script>

<template>
  <figure class="map">
    <svg
      :viewBox="`0 0 ${size * 10} ${size * 10}`"
      role="img"
      :aria-label="`Carte de ${size} sur ${size} lieux. ${held.map((h) => `${h.id} en tient ${h.n}`).join(', ')}. ${neutral} encore libres.`"
    >
      <g v-for="c in cells" :key="c.i">
        <rect
          :x="c.x * 10 + 0.4"
          :y="c.y * 10 + 0.4"
          width="9.2"
          height="9.2"
          rx="1"
          :fill="TERRAIN[c.kind]"
          :stroke="c.owner ? OWNER[c.owner] : 'transparent'"
          :stroke-width="c.owner ? 1.4 : 0"
          :class="{ struck: c.owner && marked.has(c.owner) }"
        >
          <title>{{ c.label }}</title>
        </rect>
        <!-- A held place carries a dot in its owner's colour: the border alone
             would be hard to tell apart where two empires meet. -->
        <circle v-if="c.owner" :cx="c.x * 10 + 5" :cy="c.y * 10 + 5" r="1.6" :fill="OWNER[c.owner]" />
      </g>
    </svg>

    <figcaption>
      <ul class="legend mono">
        <li v-for="h in held" :key="h.id" :class="[h.id, { fallen: h.fallen }]">
          <span class="swatch"></span>{{ h.id }} <b>{{ h.n }}</b>
        </li>
        <li class="free"><span class="swatch"></span>libres <b>{{ neutral }}</b></li>
      </ul>
    </figcaption>
  </figure>
</template>

<style scoped>
.map {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

svg {
  width: 100%;
  max-width: 460px;
  height: auto;
  display: block;
  background: #070b16;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
}

.struck {
  animation: flash 700ms ease-out;
}

@keyframes flash {
  from { stroke-width: 3; }
  to { stroke-width: 1.4; }
}

@media (prefers-reduced-motion: reduce) {
  .struck { animation: none; }
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
  border: 1.5px solid var(--border);
}

.legend .crimson .swatch { border-color: var(--crimson); }
.legend .azure .swatch { border-color: var(--azure); }
.legend .verdant .swatch { border-color: var(--verdant); }
.legend .amber .swatch { border-color: var(--amber); }
.legend .free .swatch { border-color: transparent; background: #3f5f27; }
</style>
