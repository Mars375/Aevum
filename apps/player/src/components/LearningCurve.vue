<script lang="ts">
export type LearningSignal = "ADAPTATION_OBSERVED" | "NO_EVIDENCE" | "INSUFFICIENT_DATA" | "UNRANKED";

export interface ObservationEvent {
  id: string;
  tick: number;
  kind: string;
  detail: string;
}

export interface MetricSeries {
  metric: string;
  window: { startTick: number; endTick: number };
  numerator: number;
  denominator: number;
  value: number | null;
  sampleCount: number;
  serviceRate: number | null;
  fallbackRate: number | null;
  unknownServiceCount: number;
  uncertainty: {
    method: "WILSON_95";
    lower: number | null;
    upper: number | null;
    seedCount: number;
    runCount: number;
  };
  eventSourceIds: string[];
}

export interface LearningSeries {
  consequenceRecognition: MetricSeries[];
  errorCorrection: MetricSeries[];
  doctrineCoherence: MetricSeries[];
  narrativeFidelity: MetricSeries[];
}

export interface PublishedLearningCurve {
  modelId: string | null;
  runIds: string[];
  seeds: number[];
  pairedRunKey: string | null;
  options: Record<string, number>;
  sampleCount: number;
  serviceRate: number | null;
  fallbackRate: number | null;
  unknownServiceCount: number;
  eventSources: ObservationEvent[];
  series: LearningSeries;
  unrankedReasons: string[];
  classification: LearningSignal;
}

</script>

<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  series: LearningSeries;
  eventMarkers: ObservationEvent[];
  classification: LearningSignal;
  serviceRate: number | null;
  sampleCount: number;
  unrankedReasons: string[];
}>();

const emit = defineEmits<{ selectObservation: [tick: number] }>();

const METRICS = [
  { key: "consequenceRecognition", label: "Conséquences reconnues" },
  { key: "errorCorrection", label: "Erreurs corrigées" },
  { key: "doctrineCoherence", label: "Doctrine cohérente" },
  { key: "narrativeFidelity", label: "Récit fidèle" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const selected = ref<MetricKey>("consequenceRecognition");
const observations = computed(() => props.series[selected.value]);
const measurable = computed(() => observations.value.filter((point) => point.value !== null));
const hasMeasurableData = computed(() => measurable.value.length > 0);
const label = computed(() => METRICS.find((metric) => metric.key === selected.value)!.label);
const visibleMarkers = computed(() => {
  const ids = new Set(observations.value.flatMap((point) => point.eventSourceIds));
  return props.eventMarkers.filter((event) => ids.has(event.id));
});

const status = computed(() => {
  if (observations.value.length > 0 && !hasMeasurableData.value) return "données insuffisantes";
  if (props.classification === "UNRANKED") return "non classable";
  if (!hasMeasurableData.value || props.classification === "INSUFFICIENT_DATA") return "données insuffisantes";
  return props.classification === "ADAPTATION_OBSERVED" ? "adaptation observée" : "aucune preuve d'adaptation";
});

const W = 720;
const H = 210;
const PAD = { top: 20, right: 18, bottom: 30, left: 42 };
const ticks = computed(() => [
  ...observations.value.flatMap((point) => [point.window.startTick, point.window.endTick]),
  ...visibleMarkers.value.map((event) => event.tick),
]);
const bounds = computed(() => ({
  first: Math.min(...ticks.value, 0),
  last: Math.max(...ticks.value, 1),
}));
const px = (tick: number) => PAD.left + ((tick - bounds.value.first) / Math.max(1, bounds.value.last - bounds.value.first)) * (W - PAD.left - PAD.right);
const py = (value: number) => H - PAD.bottom - value * (H - PAD.top - PAD.bottom);
const path = computed(() => {
  let startsSegment = true;
  return observations.value.flatMap((point) => {
    if (point.value === null) {
      startsSegment = true;
      return [];
    }
    const command = startsSegment ? "M" : "L";
    startsSegment = false;
    return `${command}${px(point.window.endTick).toFixed(1)},${py(point.value).toFixed(1)}`;
  }).join(" ");
});

const percent = (value: number | null, digits = 0) => value === null ? "inconnu" : `${(value * 100).toFixed(digits)} %`;
const interval = (point: MetricSeries) => point.uncertainty.lower === null || point.uncertainty.upper === null
  ? "incertitude inconnue"
  : `IC 95 % ${percent(point.uncertainty.lower)} à ${percent(point.uncertainty.upper)}`;

function onMarkerKey(event: KeyboardEvent, tick: number) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  emit("selectObservation", tick);
}

const selectObservation = (tick: number) => emit("selectObservation", tick);
</script>

<template>
  <section class="learning" aria-labelledby="learning-title">
    <header>
      <div>
        <p class="eyebrow mono">Adaptation observable</p>
        <h4 id="learning-title">Courbe d'apprentissage</h4>
      </div>
      <p class="data-state mono" :class="classification.toLowerCase()">{{ status }}</p>
    </header>

    <p class="evidence mono">
      service propre · {{ percent(serviceRate) }} · échantillon · {{ sampleCount }}
      <span v-if="unrankedReasons.length"> · motifs · {{ unrankedReasons.join(", ") }}</span>
    </p>

    <div class="metric-picker" role="group" aria-label="Métrique d'adaptation">
      <button
        v-for="metric in METRICS"
        :key="metric.key"
        type="button"
        :aria-pressed="selected === metric.key"
        @click="selected = metric.key"
      >
        {{ metric.label }}
      </button>
    </div>

    <p v-if="!hasMeasurableData" class="empty">Aucune ligne n'est tracée sans observation mesurée.</p>

    <figure v-else>
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${label}. ${status}. ${measurable.length} fenêtres mesurables.`">
        <line :x1="PAD.left" :y1="H - PAD.bottom" :x2="W - PAD.right" :y2="H - PAD.bottom" class="axis" />
        <line :x1="PAD.left" :y1="PAD.top" :x2="PAD.left" :y2="H - PAD.bottom" class="axis" />
        <text :x="PAD.left - 7" :y="PAD.top + 4" class="tick-label" text-anchor="end">100 %</text>
        <text :x="PAD.left - 7" :y="H - PAD.bottom" class="tick-label" text-anchor="end">0 %</text>
        <text :x="PAD.left" :y="H - 8" class="tick-label">an {{ bounds.first }}</text>
        <text :x="W - PAD.right" :y="H - 8" class="tick-label" text-anchor="end">an {{ bounds.last }}</text>

        <path v-if="path" :d="path" class="metric-line" />
        <circle
          v-for="point in measurable"
          :key="`${point.window.startTick}-${point.window.endTick}`"
          :cx="px(point.window.endTick)"
          :cy="py(point.value!)"
          r="4"
          class="metric-point"
        >
          <title>ans {{ point.window.startTick }} à {{ point.window.endTick }}, {{ percent(point.value) }}</title>
        </circle>

        <g
          v-for="marker in visibleMarkers"
          :key="marker.id"
          class="event-marker"
          role="button"
          tabindex="0"
          :data-tick="marker.tick"
          :aria-label="`Voir l'observation an ${marker.tick}, ${marker.kind} : ${marker.detail}`"
          @click="selectObservation(marker.tick)"
          @keydown="onMarkerKey($event, marker.tick)"
        >
          <rect :x="px(marker.tick) - 44" :y="PAD.top - 10" width="88" height="88" class="marker-target" />
          <line :x1="px(marker.tick)" :y1="PAD.top" :x2="px(marker.tick)" :y2="H - PAD.bottom" />
          <path :d="`M${px(marker.tick) - 5},${PAD.top + 5} L${px(marker.tick)},${PAD.top} L${px(marker.tick) + 5},${PAD.top + 5} L${px(marker.tick)},${PAD.top + 10} Z`" />
        </g>
      </svg>
      <figcaption class="mono">Trait plein · série mesurée. Losange + trait pointillé · fait moteur source.</figcaption>
    </figure>

    <div v-if="observations.length" class="metric-table-wrap">
      <table>
        <caption class="visually-hidden">Détail textuel de {{ label }}</caption>
        <thead><tr><th>Fenêtre</th><th>Résultat</th><th>Valeur</th><th>Incertitude</th><th>Échantillon</th></tr></thead>
        <tbody>
          <tr v-for="point in observations" :key="`${point.window.startTick}-${point.window.endTick}`">
            <th scope="row" class="mono">ans {{ point.window.startTick }}–{{ point.window.endTick }}</th>
            <td class="mono">{{ point.numerator }} / {{ point.denominator }}</td>
            <td>{{ point.value === null ? "non mesurable" : percent(point.value) }}</td>
            <td>{{ interval(point) }}</td>
            <td class="mono">n = {{ point.sampleCount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.learning { min-width: 0; }
header { display: flex; align-items: end; justify-content: space-between; gap: var(--s4); }
.eyebrow { margin: 0 0 var(--s1); color: var(--accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
h4 { margin: 0; font-family: var(--display); font-size: clamp(24px, 3vw, 38px); font-weight: 400; }
.data-state { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
.evidence { margin: var(--s2) 0 var(--s4); color: var(--muted); font-size: 11px; }
.metric-picker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; }
.metric-picker button { min-width: 0; padding-inline: var(--s2); font-size: 11px; }
.empty { margin: var(--s4) 0 0; color: var(--muted); }
figure { margin: var(--s4) 0 0; }
svg { display: block; width: 100%; height: auto; }
.axis { stroke: var(--border-soft); stroke-width: 1; }
.tick-label { fill: var(--muted); font-family: var(--mono); font-size: 9px; }
.metric-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; }
.metric-point { fill: var(--bg); stroke: var(--accent); stroke-width: 2; }
.event-marker { cursor: pointer; }
.marker-target { fill: transparent; pointer-events: all; }
.event-marker line { stroke: var(--fg); stroke-width: 1; stroke-dasharray: 3 4; opacity: 0.45; }
.event-marker path { fill: var(--fg); }
figcaption { margin-top: var(--s1); color: var(--muted); font-size: 10px; }
.metric-table-wrap { margin-top: var(--s4); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
th, td { padding: var(--s2); border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
thead th { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
tbody th { font-weight: 400; }
@media (max-width: 640px) {
  header { align-items: flex-start; flex-direction: column; gap: var(--s2); }
  .metric-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
