<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { Year } from "@abs/world";
import WorldMap from "./WorldMap.vue";

/**
 * Watching a civilisation change, year by year.
 *
 * The map beside it shows where those places are; this side shows what a
 * civilisation is made of — its holdings by kind, its garrison, and whatever
 * struck it this year. Every square and every mark is a value the engine
 * actually produced.
 */
const props = defineProps<{ years: Year[]; index: number }>();
const emit = defineEmits<{ seek: [number] }>();

const LAND_KINDS = ["plain", "forest", "hill", "river"] as const;
const LAND_LABEL: Record<string, string> = { plain: "plaine", forest: "forêt", hill: "colline", river: "fleuve" };

const year = computed(() => props.years[Math.min(props.index, props.years.length - 1)]!);

/** Events worth a flash on the civilisation they happened to. */
const FLASH: Record<string, string> = {
  DISASTER: "catastrophe",
  RAIDED: "pillage",
  SEIZED: "conquête",
  CEDED: "terre perdue",
  STARVED: "famine",
  VOW_BROKEN: "serment rompu",
  ADVANCE: "progrès",
};

const flashes = computed(() => {
  const map = new Map<string, string[]>();
  for (const e of year.value.events) {
    const label = FLASH[e.kind];
    if (!label) continue;
    map.set(e.civ, [...(map.get(e.civ) ?? []), label]);
  }
  return map;
});

/** The largest holding in the era, so the boxes keep one scale across years. */
const widest = computed(() =>
  Math.max(4, ...props.years.flatMap((y) => y.world.civs.map((c) => c.territory))),
);

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

const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
</script>

<template>
  <section class="stage card">
    <header>
      <h3>L'an {{ year.tick }}</h3>
      <div class="controls">
        <button class="mono" :aria-pressed="playing" @click="playing = !playing">
          {{ playing ? "Pause" : "Dérouler les années" }}
        </button>
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
    </header>

    <div class="split">
      <WorldMap :year="year" />

      <div class="civs">
      <article v-for="civ in year.world.civs" :key="civ.id" class="civ" :class="[civ.id, { fallen: civ.fellOnTick !== null }]">
        <div class="name">
          <span class="mono id">{{ civ.id }}</span>
          <span v-if="civ.fellOnTick !== null" class="mono gone">éteinte</span>
          <span v-else class="mono pop">{{ Math.round(civ.population) }} habitants</span>
        </div>

        <!-- One square per parcel. Grouped by kind, and nothing more is claimed. -->
        <div
          class="holding"
          :style="{ '--widest': widest }"
          role="img"
          :aria-label="LAND_KINDS.map((k) => `${civ.lands[k]} ${LAND_LABEL[k]}`).join(', ')"
        >
          <template v-for="k in LAND_KINDS" :key="k">
            <span
              v-for="n in civ.lands[k]"
              :key="`${k}-${n}`"
              class="parcel"
              :class="k"
              :title="LAND_LABEL[k]"
            />
          </template>
        </div>

        <!-- Soldiers as marks rather than a number: a garrison you can see grow. -->
        <div class="army" :aria-label="`${civ.soldiers} soldats`">
          <span v-for="n in Math.min(40, Math.round(civ.soldiers / 5))" :key="n" class="pike" />
          <span class="mono count">{{ civ.soldiers }}</span>
        </div>

        <ul v-if="flashes.get(civ.id)" class="flash mono" :class="{ still: reduced }">
          <li v-for="(f, i) in flashes.get(civ.id)" :key="i">{{ f }}</li>
        </ul>
      </article>
      </div>
    </div>

    <p class="mono caveat">
      La carte est le monde : chaque lieu existe, commence libre, et ne peut être pris que
      depuis une frontière qui le touche.
    </p>
  </section>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  align-items: center;
  justify-content: space-between;
}

h3 {
  font-size: 17px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.speed {
  min-width: 0;
  padding: var(--s2);
  font-size: 11px;
}

.split {
  display: grid;
  gap: var(--s5);
  justify-items: center;
}

/* The map is the world; the strips beside it are what each civilisation is
   made of. Side by side at width, stacked when there is none. */
@media (min-width: 860px) {
  .split {
    grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
    align-items: start;
    justify-items: stretch;
  }
}

.civs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: var(--s4);
  width: 100%;
}

.civ {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-left: var(--s3);
  border-left: 3px solid var(--border);
}

.civ.crimson { border-left-color: var(--crimson); }
.civ.azure { border-left-color: var(--azure); }
.civ.verdant { border-left-color: var(--verdant); }
.civ.amber { border-left-color: var(--amber); }
.civ.fallen { opacity: 0.4; }

.name {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
  font-size: 12px;
}

.id {
  text-transform: capitalize;
  font-size: 13px;
}

.pop,
.gone {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.holding {
  display: grid;
  /* One scale for the whole era, so a holding growing is a holding growing and
     not a box being re-fitted. */
  grid-template-columns: repeat(min(var(--widest), 14), 1fr);
  gap: 2px;
  min-height: 14px;
}

.parcel {
  aspect-ratio: 1;
  border-radius: 1px;
  transition: background 240ms linear;
}

.parcel.plain { background: #a3e635; }
.parcel.forest { background: #34d399; }
.parcel.hill { background: #a8a29e; }
.parcel.river { background: #38bdf8; }

.army {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  min-height: 12px;
}

.pike {
  width: 2px;
  height: 10px;
  background: var(--muted);
}

.count {
  margin-left: var(--s2);
  font-size: 10px;
  color: var(--muted);
}

.flash {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s2);
  margin: 0;
  padding: 0;
  font-size: 10.5px;
}

.flash li {
  color: var(--accent);
  border: 1px solid #6b4f14;
  border-radius: 3px;
  padding: 0 5px;
  animation: pulse 600ms ease-out;
}

.flash.still li {
  animation: none;
}

@keyframes pulse {
  from {
    background: var(--accent);
    color: #05070f;
  }
  to {
    background: transparent;
    color: var(--accent);
  }
}

.caveat {
  margin: 0;
  font-size: 10.5px;
  color: var(--muted);
}
</style>
