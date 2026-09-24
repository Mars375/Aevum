<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { FactionId } from "@abs/contracts";
import type { Year } from "@abs/world";
import {
  CIV_COLORS,
  LAND_NAMES,
  UNIT_NAMES,
  type WorldParcel,
} from "../three/world-projection";
import type { Mission } from "../../../../packages/world/src/commands";
import type { WorldScene } from "../three/world-scene";
import type { RelationsProjection } from "../three/relations-projection";
import type { ClimateKind } from "../three/climate";
import WorldMap from "./WorldMap.vue";
const props = defineProps<{
  year: Year;
  parcels: WorldParcel[];
  selected: FactionId | null;
  route?: number[];
  immersive?: boolean;
  missions?: Mission[];
  selectedUnit?: string | null;
  ordersVisible?: boolean;
  focusTile?: number | null;
  focusEventKey?: string | number;
  /** Pactes, commerces, guerres et conquêtes à dessiner sur le monde. */
  relations?: RelationsProjection;
  /** L'épisode climatique en cours, qui teinte le monde et anime le ciel. */
  climate?: ClimateKind | null;
}>();
const emit = defineEmits<{
  select: [FactionId | null];
  selectUnit: [string];
}>();
const host = ref<HTMLElement | null>(null);
const ready = ref(false),
  failed = ref(false),
  flat = ref(false);
const hover = ref<number | null>(null);
const pointed = computed(() =>
  hover.value === null ? null : props.parcels[hover.value],
);
let scene: WorldScene | null = null;
/**
 * La légende des relations : seulement ce qui est sur la carte. Un arc d'or ne
 * dit rien à qui ne sait pas qu'il est un pacte.
 */
const legend = computed(() => {
  const r = props.relations;
  if (!r) return [];
  const kinds = new Set(r.links.map((l) => l.kind));
  return [
    ...(kinds.has("pact") ? [{ kind: "pact", label: "Pacte" }] : []),
    ...(kinds.has("trade") ? [{ kind: "trade", label: "Commerce" }] : []),
    ...(kinds.has("war") || r.fronts.length
      ? [{ kind: "war", label: "Guerre" }]
      : []),
    ...(r.conquests.length ? [{ kind: "conquest", label: "Conquête" }] : []),
    ...(r.moments?.some((m) => m.kind === "age")
      ? [{ kind: "age", label: "Nouvel âge" }]
      : []),
    ...(r.moments?.some((m) => m.kind === "founded")
      ? [{ kind: "founded", label: "Fondation" }]
      : []),
  ];
});
let lastFocusKey: string | number | undefined;
function followEvent() {
  if (props.focusTile == null) {
    scene?.cancelFocus();
    return;
  }
  if (
    !ready.value ||
    !props.immersive ||
    props.focusEventKey === undefined ||
    props.focusEventKey === lastFocusKey
  )
    return;
  lastFocusKey = props.focusEventKey;
  scene?.focusTile(props.focusTile);
}
let generation = 0,
  mounted = false;
const ordersEnabled = ref(true);
const labels = ref<
  {
    id: string;
    owner: FactionId;
    x: number;
    y: number;
    text: string;
    description: string;
    selected: boolean;
    blocked: boolean;
  }[]
>([]);
let overlayFrame = 0,
  lastProjection = 0;
const actions: Record<Mission["action"], string> = {
  move: "MARCHE",
  defend: "GARDE",
  attack: "ATTAQUE",
  settle: "FONDATION",
  explore: "EXPLORATION",
  retreat: "REPLI",
  escort: "ESCORTE",
};
const factionNames: Record<FactionId, string> = {
  amber: "Ambre",
  azure: "Azur",
  crimson: "Pourpre",
  verdant: "Sylve",
};
const labelUnits = computed(() => {
  const slots = new Map<number, number>();
  const missions = new Map(
    (props.missions ?? []).map((mission) => [mission.unit, mission]),
  );
  return (props.year.world.simulation?.units ?? [])
    .map((unit) => {
      const slot = slots.get(unit.position) ?? 0;
      slots.set(unit.position, slot + 1);
      const mission = missions.get(unit.id);
      const role = unit.role === "settler" ? "Colons" : UNIT_NAMES[unit.role];
      const text =
        mission?.status === "blocked"
          ? "BLOQUÉ"
          : mission?.status === "active"
            ? actions[mission.action]
            : unit.task === "work"
              ? "TRAVAIL"
              : unit.task === "guard"
                ? "GARDE"
                : "ATTENTE";
      return {
        unit,
        slot,
        text,
        description: `${role} · ${factionNames[unit.owner]} · ${text.toLowerCase()}${mission?.reason ? ` — ${mission.reason}` : ""}`,
        blocked: mission?.status === "blocked",
      };
    })
    .sort(
      (a, b) =>
        Number(b.unit.id === props.selectedUnit) -
          Number(a.unit.id === props.selectedUnit) ||
        Number(b.unit.owner === props.selected) -
          Number(a.unit.owner === props.selected),
    );
});
function updateLabels(time: number) {
  overlayFrame = requestAnimationFrame(updateLabels);
  if (document.hidden || time - lastProjection < 65) return;
  lastProjection = time;
  if (
    !scene ||
    !ready.value ||
    flat.value ||
    !props.immersive ||
    props.ordersVisible === false ||
    !ordersEnabled.value
  ) {
    if (labels.value.length) labels.value = [];
    return;
  }
  const visible: typeof labels.value = [];
  for (const item of labelUnits.value) {
    const point = scene.projectUnit(
      item.unit.position,
      item.slot,
      item.unit.id,
    );
    if (!point.visible) continue;
    // Keep labels legible as the camera pulls out; selected units win overlaps.
    if (
      visible.some(
        (other) =>
          Math.abs(other.x - point.x) < 90 && Math.abs(other.y - point.y) < 33,
      )
    )
      continue;
    visible.push({
      id: item.unit.id,
      owner: item.unit.owner,
      x: Math.round(point.x),
      y: Math.round(point.y),
      text: item.text,
      description: item.description,
      selected: item.unit.id === props.selectedUnit,
      blocked: item.blocked,
    });
    if (visible.length >= 32) break;
  }
  if (
    visible.length !== labels.value.length ||
    visible.some((label, index) => {
      const previous = labels.value[index];
      return (
        !previous ||
        label.id !== previous.id ||
        label.x !== previous.x ||
        label.y !== previous.y ||
        label.text !== previous.text ||
        label.description !== previous.description ||
        label.selected !== previous.selected ||
        label.blocked !== previous.blocked ||
        label.owner !== previous.owner
      );
    })
  )
    labels.value = visible;
}
function selectLabel(id: string, owner: FactionId) {
  emit("select", owner);
  emit("selectUnit", id);
}
const zoom = (amount: number) => scene?.zoom(amount);
const resetCamera = () => scene?.reset();
const selectedFigure = computed(() =>
  props.year.world.simulation?.units.find(
    (unit) => unit.id === props.selectedUnit,
  ),
);
const focusSelectedFigure = () => {
  if (selectedFigure.value) scene?.focusTile(selectedFigure.value.position);
};
function stop() {
  generation++;
  scene?.dispose();
  scene = null;
  ready.value = false;
}
async function start() {
  stop();
  if (!host.value || flat.value || !mounted) return;
  const request = generation;
  failed.value = false;
  try {
    const { WorldScene } = await import("../three/world-scene");
    if (request !== generation || !host.value) return;
    const current = new WorldScene(
      host.value,
      (index) => emit("select", props.parcels[index]?.place.owner ?? null),
      (index) => {
        hover.value = index;
      },
      () => {
        failed.value = true;
        stop();
      },
      props.immersive ?? false,
    );
    scene = current;
    await current.load();
    if (request !== generation) return;
    current.update(
      props.parcels,
      props.year.world.size,
      props.selected,
      props.year.tick,
      props.climate ?? null,
    );
    current.showRoute(props.route ?? []);
    if (props.relations) current.setRelations(props.relations);
    ready.value = true;
    followEvent();
  } catch {
    if (request !== generation) return;
    failed.value = true;
    stop();
  }
}
watch(
  () => [props.parcels, props.selected, props.route, props.climate] as const,
  () => {
    if (ready.value) {
      scene?.update(
        props.parcels,
        props.year.world.size,
        props.selected,
        props.year.tick,
        props.climate ?? null,
      );
      scene?.showRoute(props.route ?? []);
    }
  },
);
watch(
  () => props.relations,
  (relations) => {
    if (ready.value && relations) scene?.setRelations(relations);
  },
);
watch(flat, () => (flat.value ? stop() : void start()));
watch(() => [props.focusEventKey, props.focusTile] as const, followEvent, {
  flush: "post",
});
onMounted(() => {
  mounted = true;
  void start();
  overlayFrame = requestAnimationFrame(updateLabels);
});
onUnmounted(() => {
  mounted = false;
  cancelAnimationFrame(overlayFrame);
  stop();
});
</script>
<template>
  <div
    class="diorama"
    :class="{ 'is-flat': flat || failed }"
    :aria-busy="!ready && !flat && !failed"
  >
    <div ref="host" class="world-canvas" v-show="!flat && !failed"></div>
    <div
      v-if="
        immersive &&
        ready &&
        !flat &&
        !failed &&
        ordersVisible !== false &&
        ordersEnabled
      "
      class="unit-orders"
      role="group"
      aria-label="Ordres des unités visibles"
    >
      <button
        v-for="label in labels"
        :key="label.id"
        class="unit-order"
        :class="{ 'is-selected': label.selected, 'is-blocked': label.blocked }"
        :style="{
          left: `${label.x}px`,
          top: `${label.y}px`,
          '--faction': CIV_COLORS[label.owner],
        }"
        :aria-label="label.description"
        :aria-pressed="label.selected"
        :title="label.description"
        @click.stop="selectLabel(label.id, label.owner)"
      >
        <i></i>{{ label.text }}
      </button>
    </div>
    <div v-if="flat || failed" class="flat-map">
      <WorldMap :year="year" :relations="relations" />
    </div>
    <div v-if="!ready && !flat && !failed" class="map-loading" role="status">
      <span></span>Le paysage prend forme…
    </div>
    <p v-if="failed" class="map-failure" role="status">
      La vue 3D est indisponible. La carte reste accessible en 2D.
      <button @click="start">Réessayer</button>
    </p>
    <div class="map-tools" role="group" aria-label="Affichage de la carte">
      <button :aria-pressed="!flat" @click="flat = !flat">
        {{ flat ? "Vue 3D" : "Carte 2D" }}
      </button>
      <button
        v-if="immersive && !flat && !failed"
        :aria-pressed="ordersEnabled"
        @click="ordersEnabled = !ordersEnabled"
      >
        Ordres
      </button>
      <button
        v-if="immersive && selectedFigure && !flat && !failed"
        :disabled="!ready"
        @click="focusSelectedFigure"
        aria-label="Centrer la caméra sur l’unité sélectionnée"
      >
        Voir l’unité
      </button>
      <template v-if="!flat && !failed"
        ><span class="tool-divider"></span
        ><button
          aria-label="Agrandir la carte"
          :disabled="!ready"
          @click="zoom(1.2)"
        >
          +</button
        ><button
          aria-label="Réduire la carte"
          :disabled="!ready"
          @click="zoom(1 / 1.2)"
        >
          −</button
        ><button
          aria-label="Recentrer la carte"
          :disabled="!ready"
          @click="resetCamera"
        >
          ↺
        </button></template
      >
    </div>
    <p v-if="pointed && ready && !flat" class="place-hint" role="status">
      <strong>{{ pointed.place.name }}</strong
      ><span
        >{{ LAND_NAMES[pointed.place.kind] }} ·
        {{ pointed.place.owner ?? "Terres libres"
        }}{{ pointed.capital ? " · Capitale" : "" }}</span
      ><span v-if="pointed.unitDetails.length">{{
        pointed.unitDetails.join(" / ")
      }}</span
      ><span v-else-if="pointed.units.length">{{
        [...new Set(pointed.units)].map((role) => UNIT_NAMES[role]).join(" · ")
      }}</span
      ><span v-if="pointed.city?.queue"
        >Construction : {{ pointed.city.queue.building }} ·
        {{ pointed.city.queue.remaining }} ans</span
      >
    </p>
    <p v-else-if="ready && !flat" class="map-instructions">
      <template v-if="immersive && route && route.length > 1"
        >Flèches : itinéraire prévu <span>·</span> Anneau :
        destination</template
      >
      <template v-else-if="legend.length"
        >Glissez pour explorer<template v-for="item in legend" :key="item.kind"
          ><span>·</span
          ><i :class="['relations-key', item.kind]" aria-hidden="true"></i
          >{{ item.label }}</template
        ></template
      >
      <template v-else
        >Glissez pour explorer <span>·</span> Sélectionnez un
        territoire</template
      >
    </p>
  </div>
</template>
<style scoped>
.diorama {
  position: relative;
  min-width: 0;
  height: clamp(430px, 54vw, 640px);
  background: radial-gradient(
    ellipse at 50% 42%,
    #2c4650 0%,
    #162c37 45%,
    #0d1b25 78%
  );
  overflow: hidden;
}
.world-canvas {
  width: 100%;
  height: 100%;
}
.unit-orders {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.unit-order {
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 4px 7px;
  border: 1px solid #ddd8bd70;
  border-bottom-color: var(--faction);
  border-radius: 1px;
  background: #101b18dc;
  color: #f2f0df;
  font:
    600 9px/1.2 ui-monospace,
    monospace;
  letter-spacing: 0.07em;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 2px 7px #0004;
}
.unit-order::after {
  content: "";
  position: absolute;
  width: 1px;
  height: 9px;
  background: var(--faction);
  left: 50%;
  top: 100%;
  opacity: 0.8;
}
.unit-order i {
  width: 4px;
  height: 4px;
  background: var(--faction);
}
.unit-order:hover,
.unit-order:focus-visible,
.unit-order.is-selected {
  outline: 1px solid var(--faction);
  outline-offset: 2px;
  background: #172d27;
  z-index: 2;
}
.unit-order.is-blocked {
  border-top-color: #e9a66d;
}
.world-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.map-tools {
  position: absolute;
  top: 22px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 1px solid #79909b40;
  background: #0d1a25e8;
  border-radius: 7px;
}
.map-tools button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: #dce5e4;
  padding: 6px 12px;
  font-size: 15px;
}
.map-tools button:first-child {
  font-size: 12px;
}
.map-tools button:hover {
  background: #304954;
}
/*
 * La légende des relations, dans la ligne d'instructions : placée dans la
 * barre d'outils, elle l'élargissait jusqu'à chevaucher le bulletin de crise
 * de 1 101 à 1 440 px (qa:observatory). Couleurs du calque 3D.
 */
.relations-key {
  display: inline-block;
  width: 16px;
  height: 3px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 2px;
  background: #ffd978;
}
.relations-key.trade {
  height: 2px;
  background: #7fe0d2;
}
.relations-key.war {
  background: repeating-linear-gradient(
    90deg,
    #ff5f45 0 4px,
    transparent 4px 7px
  );
}
.relations-key.age,
.relations-key.founded {
  width: 9px;
  height: 9px;
  border: 2px solid #ffd978;
  background: transparent;
  border-radius: 50%;
}
.relations-key.founded {
  border-color: #dce5e4;
}
.relations-key.conquest {
  width: 8px;
  height: 8px;
  background: #b9b3a8;
  border-radius: 50%;
}
.tool-divider {
  height: 20px;
  width: 1px;
  background: #79909b40;
}
.map-compass {
  position: absolute;
  left: 27px;
  bottom: 24px;
  width: 54px;
  text-align: center;
  color: #adc0c5;
  opacity: 0.8;
  font: 11px var(--display);
}
.map-compass svg {
  display: block;
}
.map-instructions {
  white-space: nowrap;
}
.place-hint,
.map-instructions {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: #bccbcc;
  font-size: 12px;
  text-align: center;
  width: max-content;
  max-width: 65%;
  pointer-events: none;
}
.place-hint {
  padding: 10px 20px;
  background: #0c1822e8;
  border: 1px solid #9ab1b040;
  border-radius: 6px;
}
.place-hint strong,
.place-hint span {
  display: block;
}
.place-hint strong {
  color: #f1e5cd;
  font: 18px var(--display);
}
.place-hint span {
  margin-top: 4px;
  font-size: 11px;
}
.map-instructions span {
  margin: 0 8px;
  opacity: 0.4;
}
.map-scale {
  position: absolute;
  right: 32px;
  bottom: 31px;
  color: #98b0b6;
  font-size: 10px;
  text-align: center;
}
.map-scale i {
  display: block;
  width: 44px;
  height: 6px;
  border: 1px solid #98b0b6;
  border-top: 0;
  margin-bottom: 6px;
}
.map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #c9d8d5;
  font: 20px var(--display);
}
.map-loading span {
  width: 12px;
  height: 12px;
  border: 1px solid #d5a66f;
  transform: rotate(45deg);
}
.flat-map {
  height: 100%;
  padding: 60px 20px 20px;
  display: grid;
  place-items: center;
  overflow: auto;
}
.flat-map :deep(.map) {
  width: min(100%, 480px);
}
.map-failure {
  position: absolute;
  top: 5px;
  left: 16px;
  max-width: 60%;
  color: var(--muted);
  font-size: 12px;
}
.map-failure button {
  font: inherit;
  padding: 3px 8px;
}
@media (max-width: 650px) {
  .diorama {
    height: 450px;
  }
  .map-tools {
    top: 14px;
    right: 14px;
  }
  .map-tools button {
    min-width: 44px;
    padding-inline: 10px;
  }
  .map-compass {
    width: 35px;
    left: 14px;
    bottom: 15px;
  }
  .map-scale {
    display: none;
  }
  .map-instructions {
    font-size: 10px;
    bottom: 23px;
    left: 58%;
    max-width: 72%;
  }
  .map-instructions span {
    margin: 0 3px;
  }
}
</style>
