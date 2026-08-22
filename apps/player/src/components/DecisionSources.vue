<script lang="ts">
export function emitSourceSeek(emit: (event: "seek", tick: number) => void, tick: number) {
  emit("seek", tick);
}
</script>

<script setup lang="ts">
import type { ObservationEvent } from "./LearningCurve.vue";

defineProps<{ observations: ObservationEvent[] }>();
const emit = defineEmits<{ seek: [tick: number] }>();
const seek = (tick: number) => emitSourceSeek(emit, tick);
</script>

<template>
  <section class="sources" aria-labelledby="sources-title">
    <p class="eyebrow mono">Sources auditables</p>
    <h4 id="sources-title">Décisions et faits sources</h4>
    <p v-if="observations.length === 0" class="empty">Aucune observation source n'est publiée pour cette courbe.</p>
    <ol v-else>
      <li v-for="source in observations" :key="source.id">
        <button type="button" class="mono" :data-tick="source.tick" @click="seek(source.tick)">an {{ source.tick }}</button>
        <span class="kind mono">{{ source.kind }}</span>
        <span>{{ source.detail }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.sources { min-width: 0; }
.eyebrow { margin: 0 0 var(--s1); color: var(--accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
h4 { margin: 0; font-family: var(--display); font-size: clamp(24px, 3vw, 38px); font-weight: 400; }
.empty { color: var(--muted); }
ol { display: flex; flex-direction: column; gap: var(--s2); margin: var(--s4) 0 0; padding: 0; list-style: none; }
li { display: grid; grid-template-columns: 6rem minmax(8rem, 0.35fr) minmax(0, 1fr); align-items: center; gap: var(--s3); padding-bottom: var(--s2); border-bottom: 1px solid var(--border-soft); font-size: 12px; }
button { min-width: 0; }
.kind { color: var(--accent); font-size: 10px; }
@media (max-width: 640px) { li { grid-template-columns: 1fr; gap: var(--s1); } button { justify-self: start; } }
</style>
