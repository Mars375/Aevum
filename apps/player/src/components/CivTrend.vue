<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import type { Year } from "@abs/world";

/**
 * A century at a glance.
 *
 * The civilisation cards give you one year; this gives you the shape of all of
 * them. Watching a civilisation evolve is mostly watching lines diverge, and
 * no table of numbers shows a divergence the way a line does.
 *
 * Drawn as plain SVG: four polylines, the same four faction colours the grid
 * and the 3D view use, so a reader who learned one has learned this.
 */
const props = defineProps<{
  years: Year[];
  metric: "population" | "territory" | "soldiers" | "wealth";
  /** The year currently being read, marked on the axis. */
  at: number;
}>();
const emit = defineEmits<{ seek: [number] }>();

const COLOURS: Record<string, string> = {
  crimson: "var(--crimson)",
  azure: "var(--azure)",
  verdant: "var(--verdant)",
  amber: "var(--amber)",
};
const DASH: Record<string, string | undefined> = {
  crimson: undefined,
  azure: "8 3",
  verdant: "2 3",
  amber: "10 3 2 3",
};

/**
 * A narrow screen gets a squarer drawing, not a squashed one.
 *
 * Stretching the same viewBox to fit a phone flattened a century of growth
 * into a 70-pixel smear and made the axis labels unreadable. Changing the
 * drawing's proportions keeps every slope honest, which a non-uniform scale
 * would not.
 */
const narrow = ref(false);
const query = typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)") : null;
if (query) {
  narrow.value = query.matches;
  const onChange = (e: MediaQueryListEvent) => (narrow.value = e.matches);
  query.addEventListener("change", onChange);
  onUnmounted(() => query.removeEventListener("change", onChange));
}

const W = computed(() => (narrow.value ? 340 : 720));
const H = computed(() => (narrow.value ? 200 : 150));
const PAD = computed(() => ({ top: 8, right: 8, bottom: 18, left: narrow.value ? 34 : 40 }));

const valueOf = (civ: Record<string, any>): number =>
  props.metric === "wealth" ? civ.stock.wealth : civ[props.metric];

const series = computed(() => {
  const ids = props.years[0]?.world.civs.map((c) => c.id) ?? [];
  return ids.map((id) => ({
    id,
    // A fallen civilisation stops having a line rather than dropping to zero
    // and lying flat across the rest of the era.
    points: props.years
      .map((y) => ({ tick: y.tick, civ: y.world.civs.find((c) => c.id === id)! }))
      .filter((p) => p.civ && p.civ.fellOnTick === null)
      .map((p) => ({ x: p.tick, y: valueOf(p.civ) })),
    fellOn: props.years.at(-1)?.world.civs.find((c) => c.id === id)?.fellOnTick ?? null,
  }));
});

const bounds = computed(() => {
  const all = series.value.flatMap((s) => s.points.map((p) => p.y));
  const lastTick = props.years.at(-1)?.tick ?? 1;
  return { max: Math.max(1, ...all), lastTick: Math.max(1, lastTick) };
});

const px = (tick: number) => PAD.value.left + (tick / bounds.value.lastTick) * (W.value - PAD.value.left - PAD.value.right);
const py = (value: number) => H.value - PAD.value.bottom - (value / bounds.value.max) * (H.value - PAD.value.top - PAD.value.bottom);

const path = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");

const LABEL: Record<string, string> = {
  population: "population",
  territory: "terres",
  soldiers: "soldats",
  wealth: "richesse",
};

/** Clicking the chart is the fastest way to reach a year worth reading. */
function onClick(e: MouseEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const x = ratio * W.value;
  const tick = Math.round(((x - PAD.value.left) / (W.value - PAD.value.left - PAD.value.right)) * bounds.value.lastTick);
  emit("seek", Math.max(0, Math.min(bounds.value.lastTick, tick)));
}

function onKey(e: KeyboardEvent) {
  const current = Math.max(0, props.years.findIndex((year) => year.tick === props.at));
  const target = e.key === "Home" ? 0 : e.key === "End" ? props.years.length - 1 : e.key === "ArrowLeft" ? current - 1 : e.key === "ArrowRight" ? current + 1 : null;
  if (target === null) return;
  e.preventDefault();
  emit("seek", props.years[Math.max(0, Math.min(props.years.length - 1, target))]!.tick);
}

const summary = computed(() =>
  series.value
    .map((s) => {
      const last = s.points.at(-1);
      return `${s.id} ${last ? Math.round(last.y) : 0}${s.fellOn !== null ? `, éteinte an ${s.fellOn}` : ""}`;
    })
    .join(" ; "),
);
</script>

<template>
  <figure class="trend">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      tabindex="0"
      :aria-label="`Évolution de ${LABEL[metric]} sur ${bounds.lastTick} ans. ${summary}`"
      @click="onClick"
      @keydown="onKey"
    >
      <line :x1="PAD.left" :y1="H - PAD.bottom" :x2="W - PAD.right" :y2="H - PAD.bottom" class="axis" />
      <line :x1="PAD.left" :y1="PAD.top" :x2="PAD.left" :y2="H - PAD.bottom" class="axis" />

      <text :x="PAD.left - 6" :y="PAD.top + 9" class="tick-label" text-anchor="end">{{ Math.round(bounds.max) }}</text>
      <text :x="PAD.left - 6" :y="H - PAD.bottom" class="tick-label" text-anchor="end">0</text>
      <text :x="W - PAD.right" :y="H - 5" class="tick-label" text-anchor="end">an {{ bounds.lastTick }}</text>

      <!-- The year being read, so the chart and the cards always agree. -->
      <line :x1="px(at)" :y1="PAD.top" :x2="px(at)" :y2="H - PAD.bottom" class="cursor" />

      <path v-for="s in series" :key="s.id" :d="path(s.points)" :stroke="COLOURS[s.id]" :stroke-dasharray="DASH[s.id]" class="line" />
      <circle
        v-for="s in series.filter((x) => x.fellOn !== null)"
        :key="`${s.id}-fell`"
        :cx="px(s.fellOn!)"
        :cy="H - PAD.bottom"
        r="3.5"
        :fill="COLOURS[s.id]"
        class="fell"
      />
    </svg>
    <figcaption class="mono">{{ LABEL[metric] }} — cliquer pour aller à une année</figcaption>
    <ul class="series-key mono" aria-label="Civilisations distinguées par initiale et motif de trait">
      <li v-for="s in series" :key="`${s.id}-key`"><strong>{{ s.id.slice(0, 1).toUpperCase() }}</strong> {{ s.id }} · {{ s.id === "crimson" ? "trait plein" : s.id === "azure" ? "tirets longs" : s.id === "verdant" ? "pointillés" : "tiret-point" }}</li>
    </ul>
  </figure>
</template>

<style scoped>
.trend {
  margin: 0;
}

svg {
  width: 100%;
  height: auto;
  display: block;
  cursor: crosshair;
}

.axis {
  stroke: var(--border-soft);
  stroke-width: 1;
}

.line {
  fill: none;
  stroke-width: 1.8;
  stroke-linejoin: round;
}

/* A fallen civilisation is marked on the axis at the year it fell. */
.fell {
  stroke: var(--bg);
  stroke-width: 1.5;
}

.cursor {
  stroke: var(--fg);
  stroke-width: 1;
  opacity: 0.35;
}

.tick-label {
  fill: var(--muted);
  font-size: 9px;
  font-family: var(--mono);
}

figcaption {
  font-size: 11px;
  color: var(--muted);
  margin-top: var(--s1);
}

.series-key { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); margin: var(--s2) 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 10px; }
.series-key strong { color: var(--fg); }
</style>
