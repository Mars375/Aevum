<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { Year } from "@abs/world";
import WorldMap from "./WorldMap.vue";

const props = defineProps<{ years: Year[]; index: number; turningTick?: number | null }>();
const emit = defineEmits<{ seek: [number] }>();

const year = computed(() => props.years[Math.min(props.index, props.years.length - 1)]!);

const playing = ref(false);
const direction = ref<1 | -1>(1);
const speed = ref(4);
const SPEEDS = [1, 4, 12, 40] as const;
let timer: number | undefined;

const step = () => {
  const next = props.index + direction.value;
  if (next < 0 || next >= props.years.length) {
    playing.value = false;
    return;
  }
  emit("seek", next);
};

function playIn(nextDirection: 1 | -1): void {
  direction.value = nextDirection;
  playing.value = true;
}

watch([playing, direction, speed], () => {
  clearInterval(timer);
  if (!playing.value) return;
  timer = window.setInterval(step, 1000 / speed.value);
});

onUnmounted(() => clearInterval(timer));

</script>

<template>
  <section class="stage" aria-labelledby="world-year">
    <div class="scene">
      <WorldMap :year="year" :years="years" :index="index" @seek="(tick) => {
        const at = years.findIndex((item) => item.tick === tick);
        if (at >= 0) emit('seek', at);
      }" />
      <header class="inscription">
        <p class="mono eyebrow">Monde recomposé · année active</p>
        <h2 id="world-year"><span>L'an</span> {{ year.tick }}</h2>
        <p>
          {{ year.world.civs.filter((civ) => civ.fellOnTick === null).length }} civilisations vivantes sur
          {{ year.world.board.length }} lieux.
        </p>
        <p class="principle">Les modèles décident aux points d'arbitrage. Le moteur résout le reste, année après année.</p>
      </header>
    </div>

    <div class="timeline">
      <div class="controls">
        <button class="play" :aria-pressed="playing" @click="playing ? (playing = false) : playIn(1)">
          {{ playing && direction === 1 ? "Mettre en pause" : "Dérouler les années" }}
        </button>
        <button class="quiet" :aria-pressed="playing && direction === -1" @click="playing && direction === -1 ? (playing = false) : playIn(-1)">
          {{ playing && direction === -1 ? "Pause arrière" : "Lire en arrière" }}
        </button>
        <div class="speeds" role="group" aria-label="Vitesse de lecture">
          <button
            v-for="s in SPEEDS"
            :key="s"
            class="mono speed"
            :aria-pressed="speed === s"
            @click="speed = s"
          >
            ×{{ s }}
          </button>
        </div>
        <button v-if="turningTick !== null && turningTick !== undefined" class="quiet" @click="emit('seek', turningTick)">Dernier tournant</button>
        <button class="quiet" :disabled="index === years.length - 1" @click="emit('seek', years.length - 1)">Dernière année</button>
      </div>

      <label class="scrub">
        <span class="visually-hidden">Parcourir les années de l'ère</span>
        <input
          type="range"
          min="0"
          :max="years.length - 1"
          :value="index"
          :aria-valuetext="`an ${year.tick}`"
          @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
        />
        <output class="mono">an {{ year.tick }} / {{ years.at(-1)?.tick }}</output>
      </label>
      <p class="mono caveat">Chaque lieu et chaque frontière ci-dessus existent dans le moteur ; aucun relief décoratif n'est ajouté.</p>
    </div>
  </section>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border);
  animation: reveal 560ms var(--ease-out) both;
}

.scene {
  min-height: min(68vh, 680px);
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 0.9fr);
  gap: clamp(var(--s5), 5vw, 72px);
  align-items: center;
  padding: var(--s3) 0 var(--s5);
}

.scene :deep(.map) {
  width: 100%;
}

.scene :deep(.map svg) {
  max-width: none;
  border-color: var(--map-border);
  box-shadow: 0 24px 80px #0007;
}

.inscription {
  align-self: center;
}

.eyebrow {
  margin: 0 0 var(--s3);
  color: var(--accent);
  font-size: 10px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.inscription h2 {
  font-family: var(--display);
  font-size: clamp(72px, 10vw, 148px);
  font-weight: 400;
  line-height: 0.8;
  letter-spacing: -0.065em;
}

.inscription h2 span {
  display: block;
  margin: 0 0 var(--s2) 0.08em;
  color: var(--muted);
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.inscription > p:not(.eyebrow) {
  max-width: 34ch;
  margin: var(--s4) 0 0;
  color: var(--muted);
}

.principle {
  padding-top: var(--s4);
  border-top: 1px solid var(--border-soft);
  color: var(--fg) !important;
  font-family: var(--display);
  font-size: 18px;
  line-height: 1.5;
}

.timeline {
  display: grid;
  gap: var(--s3);
  padding: var(--s4) 0 var(--s5);
  border-top: 1px solid var(--border-soft);
}

.controls,
.speeds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.play {
  min-width: 180px;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 650;
}

.quiet {
  background: transparent;
}

.speed {
  min-width: 44px;
  padding-inline: var(--s2);
  font-size: 11px;
}

.scrub {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.scrub input {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  accent-color: var(--accent);
}

.scrub output {
  min-width: 14ch;
  text-align: right;
  color: var(--muted);
  font-size: 11px;
}

.caveat {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (max-width: 1099px) {
  .scene {
    min-height: auto;
    grid-template-columns: 1fr;
    gap: var(--s5);
  }

  .inscription {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0 var(--s5);
    align-items: end;
  }

  .inscription .eyebrow {
    grid-column: 1 / -1;
  }

  .inscription h2 {
    font-size: clamp(64px, 18vw, 118px);
  }
}

@media (max-width: 699px) {
  .scene {
    padding-top: 0;
  }

  .inscription {
    grid-template-columns: 1fr;
  }

  .inscription h2 {
    font-size: clamp(62px, 25vw, 100px);
  }

  .controls > button,
  .speeds {
    flex: 1 1 auto;
  }

  .speeds .speed {
    flex: 1;
  }

  .scrub {
    align-items: stretch;
    flex-direction: column;
    gap: 0;
  }

  .scrub output {
    text-align: left;
  }
}
</style>
