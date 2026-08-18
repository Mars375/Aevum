<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { WorldState } from "@abs/contracts";
import { BattleScene } from "../three/scene";

const props = defineProps<{ state: WorldState; gridSize: number; alliancePairs?: string[] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const failed = ref(false);
let scene: BattleScene | null = null;
let observer: ResizeObserver | null = null;

const allied = () => {
  const set = new Set<string>();
  for (const pair of props.alliancePairs ?? []) for (const f of pair.split("|")) set.add(f);
  return set;
};

/** Drag to orbit. Pointer events cover mouse, pen and touch in one path. */
let dragging = false;
let lastX = 0;
const onDown = (e: PointerEvent) => {
  dragging = true;
  lastX = e.clientX;
  (e.target as Element).setPointerCapture?.(e.pointerId);
};
const onMove = (e: PointerEvent) => {
  if (!dragging) return;
  scene?.orbit(e.clientX - lastX);
  lastX = e.clientX;
};
const onUp = () => (dragging = false);

/** Keyboard equivalent, because a view you can only reach by dragging is a view some readers cannot reach. */
const onKey = (e: KeyboardEvent) => {
  if (e.key === "ArrowLeft" || e.key === "q") scene?.orbit(-24);
  else if (e.key === "ArrowRight" || e.key === "d") scene?.orbit(24);
  else return;
  e.preventDefault();
};

onMounted(() => {
  if (!canvas.value) return;
  try {
    scene = new BattleScene(canvas.value, props.gridSize);
    scene.render(props.state, allied());
  } catch {
    // No WebGL, or a driver that refuses. The 2D grid is still there and still
    // complete, so this is a downgrade rather than a failure.
    failed.value = true;
    return;
  }
  observer = new ResizeObserver(() => scene?.resize());
  if (canvas.value.parentElement) observer.observe(canvas.value.parentElement);
});

watch(
  () => props.state,
  (state) => scene?.render(state, allied()),
);

onBeforeUnmount(() => {
  observer?.disconnect();
  scene?.dispose();
  scene = null;
});
</script>

<template>
  <div class="wrap">
    <p v-if="failed" class="card fallback">
      Cette machine ne fournit pas de WebGL utilisable. La vue 2D reste complète et affiche exactement
      les mêmes informations.
    </p>
    <canvas
      v-else
      ref="canvas"
      tabindex="0"
      role="img"
      :aria-label="`Champ de bataille en trois dimensions, ${state.squads.length} escouades en vie. Flèches gauche et droite pour faire pivoter.`"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @keydown="onKey"
    />
    <p v-if="!failed" class="hint mono">Glisser ou ← → pour faire pivoter le plateau.</p>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

canvas {
  width: 100%;
  display: block;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  touch-action: none;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.fallback {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}
</style>
