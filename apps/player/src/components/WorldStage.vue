<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { Year } from "@abs/world";
import WorldMap from "./WorldMap.vue";

const props = defineProps<{ years: Year[]; index: number; turningTick?: number | null }>();
const emit = defineEmits<{ seek: [number] }>();

const year = computed(() => props.years[Math.min(props.index, props.years.length - 1)]!);

/* A world down to its last civilisation is the interesting case, and it was
   the one the sentence got wrong: "1 civilisations vivantes". */
const living = computed(() => year.value.world.civs.filter((civ) => civ.fellOnTick === null).length);

/** Épreuves subies : ce que le monde inflige, sans qu'un dirigeant l'ait voulu. */
const HARDSHIP = new Set(["COLLAPSED", "SHORTAGE", "HARD_YEAR", "RAIDED", "DISASTER"]);
/** Prises : ce qu'un dirigeant a décidé d'aller chercher. */
const SEIZURE = new Set(["SEIZED", "CAPITAL_LOST"]);

/**
 * Le décompte s'arrête à l'année affichée, pas à la fin de l'ère : ces chiffres
 * accompagnent la carte, et la carte montre une année. Compter jusqu'au bout
 * donnerait un total qui ne correspond à rien de ce qui est à l'écran.
 */
const tally = computed(() => {
  let rulings = 0;
  let hardship = 0;
  let seizures = 0;
  for (let i = 0; i <= Math.min(props.index, props.years.length - 1); i += 1) {
    const y = props.years[i]!;
    rulings += y.rulings.length;
    for (const event of y.events) {
      if (HARDSHIP.has(event.kind)) hardship += 1;
      else if (SEIZURE.has(event.kind)) seizures += 1;
    }
  }
  const fallen = year.value.world.civs.filter((civ) => civ.fellOnTick !== null).length;
  return { rulings, hardship, seizures, fallen };
});

const playing = ref(false);
const speed = ref(4);
const SPEEDS = [1, 4, 12, 40] as const;
let timer: number | undefined;

const step = () => {
  if (props.index >= props.years.length - 1) {
    playing.value = false;
    return;
  }
  emit("seek", props.index + 1);
};

watch([playing, speed], () => {
  clearInterval(timer);
  if (!playing.value) return;
  timer = window.setInterval(step, 1000 / speed.value);
});

onUnmounted(() => clearInterval(timer));

</script>

<template>
  <section class="stage" aria-labelledby="world-year">
    <div class="scene">
      <WorldMap :year="year" />
      <header class="inscription">
        <p class="mono eyebrow">Monde recomposé · année active</p>
        <h2 id="world-year"><span>L'an</span> {{ year.tick }}</h2>
        <p>
          {{ living }} {{ living === 1 ? "civilisation vivante" : "civilisations vivantes" }} sur
          {{ year.world.board.length }} lieux.
        </p>
        <p class="principle">Les modèles décident aux points d'arbitrage. Le moteur résout le reste, année après année.</p>
      </header>

      <!-- Ce que l'ère a coûté et produit jusqu'à l'année affichée. La colonne
           de droite était vide sur un large écran ; la remplir de chiffres
           dérivés du journal vaut mieux que de l'étirer. -->
      <dl class="tally" aria-label="Depuis le début de l'ère">
        <div>
          <dt class="label">Décisions</dt>
          <dd>{{ tally.rulings }}</dd>
        </div>
        <div>
          <dt class="label">Épreuves</dt>
          <dd>{{ tally.hardship }}</dd>
        </div>
        <div>
          <dt class="label">Prises</dt>
          <dd>{{ tally.seizures }}</dd>
        </div>
        <div :class="{ 'tally--loss': tally.fallen > 0 }">
          <dt class="label">Éteintes</dt>
          <dd>{{ tally.fallen }}</dd>
        </div>
      </dl>
    </div>

    <div class="timeline">
      <div class="controls">
        <button class="play" :aria-pressed="playing" @click="playing = !playing">
          {{ playing ? "Mettre en pause" : "Dérouler les années" }}
        </button>
        <div class="speeds" role="group" aria-label="Vitesse de lecture">
          <button
            v-for="s in SPEEDS"
            :key="s"
            class="mono speed"
            :aria-pressed="speed === s"
            :aria-label="`${s} années par seconde`"
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

/* The map column is sized to the map, not to a fraction of the page. With
   fractional columns the square sat centred in a column half again its width,
   and the gap between board and year read as a mistake rather than as space. */
.scene {
  display: grid;
  grid-template-columns: min(56vh, 560px) minmax(260px, 1fr);
  gap: clamp(var(--s5), 4vw, 56px);
  align-items: center;
  padding: var(--s4) 0 var(--s5);
}

/* The board's viewBox is square. Capping its *height* therefore did nothing
   useful: the element stayed as wide as the column and `preserveAspectRatio`
   letterboxed the square inside it, leaving a bordered box with dead navy on
   either side. Capping the width is what actually sizes a square, and the
   legend below inherits the same measure so the two line up. */
.scene :deep(.map) {
  width: 100%;
  min-width: 0;
}

/* It used to carry `max-width: none`, so the board escaped its column
   entirely: it pushed the stage below the fold and clipped settlement labels
   against the left edge. It is a figure in a layout, not a backdrop. */
.scene :deep(.map svg) {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  border-color: var(--map-border);
  border-radius: var(--radius);
  box-shadow: 0 18px 60px #00000073;
}

.inscription {
  align-self: center;
}

/* ---- the tally ---------------------------------------------------------- */

.tally {
  margin: 0;
  align-self: center;
  display: grid;
  gap: 1px;
  background: var(--hairline);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tally > div {
  background: var(--card);
  padding: var(--s3) var(--s4);
  display: flex;
  flex-direction: column;
  gap: var(--s1);
}

.tally dd {
  margin: 0;
  font-family: var(--mono);
  font-size: var(--t-h3);
  font-variant-numeric: tabular-nums;
  color: var(--fg);
}

/* Red is reserved for a loss, and an extinction is the only loss here that
   cannot be undone. A zero stays neutral: nothing has been lost yet. */
.tally--loss dd {
  color: var(--crimson);
}

/* Wide enough for a third column: the tally stands beside the year instead of
   under it, and the empty right third disappears. */
@media (min-width: 1200px) {
  .scene {
    grid-template-columns: min(56vh, 560px) minmax(240px, 1fr) minmax(170px, 14rem);
  }
}

@media (max-width: 1199px) {
  .tally {
    grid-column: 1 / -1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.eyebrow {
  margin: 0 0 var(--s3);
  color: var(--accent);
  font-size: var(--t-label);
  letter-spacing: var(--track-label);
  text-transform: uppercase;
}

/* 148px of year was louder than the world it labelled, and on a short window
   it alone filled the column. The figure still leads the eye; it no longer
   shouts over the map. */
.inscription h2 {
  font-family: var(--display);
  font-size: var(--t-figure);
  font-weight: 400;
  line-height: 0.88;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.inscription h2 span {
  display: block;
  margin: 0 0 var(--s2) 0.06em;
  color: var(--faint);
  font-family: var(--mono);
  font-size: var(--t-label);
  letter-spacing: var(--track-label);
  text-transform: uppercase;
}

.inscription > p:not(.eyebrow) {
  max-width: 34ch;
  margin: var(--s4) 0 0;
  color: var(--muted);
  font-size: var(--t-small);
}

.principle {
  padding-top: var(--s4);
  border-top: 1px solid var(--hairline);
  color: var(--fg) !important;
  font-family: var(--display);
  font-size: var(--t-lead) !important;
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
