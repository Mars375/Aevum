<script setup lang="ts">
import { FACTION_IDS, type FactionId } from "@abs/contracts";
import type { Knowledge } from "../fog";

defineProps<{ knowledge: Knowledge | null; allies: FactionId[]; hidden: number; turnIndex: number }>();
const model = defineModel<FactionId | null>({ default: null });
</script>

<template>
  <div class="fog">
    <div class="row" role="group" aria-label="Point de vue">
      <span class="label mono">Point de vue</span>
      <button type="button" class="mono" :aria-pressed="model === null" @click="model = null">Omniscient</button>
      <button
        v-for="f in FACTION_IDS"
        :key="f"
        type="button"
        class="mono faction"
        :style="{ '--faction': `var(--${f})` }"
        :aria-pressed="model === f"
        @click="model = f"
      >
        {{ f }}
      </button>
    </div>

    <p v-if="model" class="note mono" role="status">
      Ce que {{ model }} sait au tour {{ turnIndex }}<template v-if="allies.length">, vision partagée avec
      {{ allies.join(", ") }}</template>. {{ hidden }} escouade(s) hors de vue<template
        v-if="knowledge?.remembered.size"
      >, dont {{ knowledge.remembered.size }} en dernière position connue</template>.
    </p>
    <p v-else class="note mono">
      Vue omnisciente — vous en voyez plus qu'aucun général. Choisissez une faction pour lire la bataille
      telle qu'elle l'a vécue.
    </p>
  </div>
</template>

<style scoped>
.fog {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.row button {
  font-size: 12px;
}

.faction[aria-pressed="true"] {
  border-color: var(--faction);
  color: var(--faction);
}

.note {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  max-width: 70ch;
}
</style>
