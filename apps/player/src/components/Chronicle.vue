<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { chronicle, JournalSchema, type Journal, type Year } from "@abs/world";
import CivTrend from "./CivTrend.vue";

/**
 * A world, read year by year.
 *
 * The journal holds only an origin and a handful of decisions, so everything
 * shown here is recomputed in the browser by the same engine that lived it.
 * Nothing is trusted from a rendering: if the chart and the cards disagree with
 * the world, the engine is what is wrong, and that is the point.
 */
const props = defineProps<{ journal: Journal }>();

const years = computed<Year[]>(() => chronicle(props.journal));
const index = ref(0);
watch(years, () => (index.value = years.value.length - 1), { immediate: true });

const year = computed(() => years.value[Math.min(index.value, years.value.length - 1)]!);
const metric = ref<"population" | "territory" | "soldiers" | "wealth">("population");

const METRICS = [
  { key: "population", label: "Population" },
  { key: "territory", label: "Terres" },
  { key: "soldiers", label: "Soldats" },
  { key: "wealth", label: "Richesse" },
] as const;

const POSTURE: Record<string, string> = {
  TRADE: "commerce",
  GUARD: "garde",
  PRESSURE: "pression",
};

/** Plain words, because a reader should not have to learn the engine's enum. */
const EVENT_LABEL: Record<string, string> = {
  GREW: "croissance",
  STARVED: "famine",
  EXPANDED: "expansion",
  LOST_LAND: "terre abandonnée",
  ADVANCE: "progrès",
  COLLAPSED: "extinction",
  SURPLUS: "abondance",
  SHORTAGE: "solde impayée",
  HARD_YEAR: "mauvaise récolte",
  LAND_FULL: "monde plein",
  SEIZED: "conquête",
  CEDED: "terre perdue",
  TRADED: "commerce",
  RAIDED: "pillage",
  REPELLED: "bandits repoussés",
};

/** The events worth a line in a chronicle. Growth every year is not history. */
const NOTABLE = new Set(["STARVED", "ADVANCE", "COLLAPSED", "SEIZED", "CEDED", "RAIDED", "LAND_FULL", "SHORTAGE"]);
const notable = computed(() => year.value.events.filter((e) => NOTABLE.has(e.kind)));

/** Everything a ruler has ever said, newest first — the era's real narrative. */
const rulings = computed(() => [...props.journal.rulings].sort((a, b) => b.tick - a.tick));

const round = (n: number) => Math.round(n);
</script>

<template>
  <div class="chronicle">
    <header class="card head">
      <div>
        <h2>Ère {{ journal.era }}</h2>
        <p class="mono muted">
          {{ journal.livedTo }} années vécues · {{ journal.rulings.length }} décisions ·
          {{ year.world.civs.filter((c) => c.fellOnTick === null).length }} civilisations vivantes
        </p>
      </div>
      <div class="metrics">
        <button
          v-for="m in METRICS"
          :key="m.key"
          :aria-pressed="metric === m.key"
          @click="metric = m.key"
        >
          {{ m.label }}
        </button>
      </div>
    </header>

    <section class="card">
      <CivTrend :years="years" :metric="metric" :at="year.tick" @seek="(t) => (index = t)" />
      <label class="scrub">
        <span class="visually-hidden">Année</span>
        <input
          type="range"
          min="0"
          :max="years.length - 1"
          v-model.number="index"
          :aria-valuetext="`an ${year.tick}`"
        />
        <output class="mono">an {{ year.tick }}</output>
      </label>
    </section>

    <section class="civs">
      <article v-for="civ in year.world.civs" :key="civ.id" class="card civ" :class="[civ.id, { fallen: civ.fellOnTick !== null }]">
        <h3>
          {{ civ.id }}
          <span v-if="civ.fellOnTick !== null" class="mono dead">éteinte an {{ civ.fellOnTick }}</span>
          <span v-else class="mono posture">{{ POSTURE[civ.doctrine.posture] }}</span>
        </h3>
        <dl class="mono">
          <div><dt>population</dt><dd>{{ round(civ.population) }}</dd></div>
          <div><dt>terres</dt><dd>{{ civ.territory }}</dd></div>
          <div><dt>soldats</dt><dd>{{ civ.soldiers }}</dd></div>
          <div><dt>vivres</dt><dd>{{ round(civ.stock.food) }}</dd></div>
          <div><dt>richesse</dt><dd>{{ round(civ.stock.wealth) }}</dd></div>
          <div><dt>progrès</dt><dd>{{ civ.advances.length }}</dd></div>
        </dl>
        <p v-if="civ.doctrine.creed" class="creed">« {{ civ.doctrine.creed }} »</p>
        <p v-else class="creed muted">Aucun dirigeant n'a encore écrit de credo.</p>
      </article>
    </section>

    <section class="card">
      <h3>Année {{ year.tick }}</h3>
      <ul v-if="notable.length > 0" class="events mono">
        <li v-for="(e, i) in notable" :key="i" :class="e.civ">
          <span class="kind">{{ EVENT_LABEL[e.kind] ?? e.kind }}</span>
          <span class="who">{{ e.civ }}</span>
          <span class="what">{{ e.detail }}</span>
        </li>
      </ul>
      <p v-else class="muted">Une année sans histoire.</p>

      <div v-if="year.rulings.length > 0" class="decisions">
        <h4>Décisions de cette année</h4>
        <article v-for="(r, i) in year.rulings" :key="i" class="ruling" :class="r.civ">
          <p class="mono meta">
            {{ r.civ }} · {{ r.kind }} · {{ r.model ?? "doctrine en place" }}
            <span v-if="r.deferredBy > 0" class="late">gouvernée {{ r.deferredBy }} ans trop tard</span>
          </p>
          <p v-if="r.reason">{{ r.reason }}</p>
        </article>
      </div>
    </section>

    <section class="card">
      <h3>Ce que les dirigeants ont dit</h3>
      <p v-if="rulings.length === 0" class="muted">Aucune décision : ce monde a vécu sans être gouverné.</p>
      <ol v-else class="log">
        <li v-for="(r, i) in rulings" :key="i" :class="r.civ">
          <button class="jump mono" @click="index = Math.min(r.tick, years.length - 1)">an {{ r.tick }}</button>
          <span class="mono who">{{ r.civ }}</span>
          <span class="said">{{ r.reason || "— sans explication —" }}</span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.chronicle {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  align-items: center;
  justify-content: space-between;
}

.head p {
  margin: var(--s1) 0 0;
  font-size: 12px;
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.muted {
  color: var(--muted);
}

.scrub {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-top: var(--s3);
}

.scrub input {
  flex: 1;
  min-height: 44px;
}

.scrub output {
  min-width: 6ch;
  text-align: right;
}

.civs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--s3);
}

.civ {
  border-left: 3px solid var(--border);
}

/* Faction identity is the same colour it is on the grid and in the 3D view. */
.civ.crimson { border-left-color: var(--crimson); }
.civ.azure { border-left-color: var(--azure); }
.civ.verdant { border-left-color: var(--verdant); }
.civ.amber { border-left-color: var(--amber); }

.civ.fallen {
  opacity: 0.55;
}

.civ h3 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
  font-size: 15px;
  text-transform: capitalize;
}

.posture,
.dead {
  font-size: 11px;
  color: var(--muted);
  text-transform: none;
}

dl {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--s1) var(--s3);
  margin: var(--s3) 0 0;
  font-size: 12px;
}

dl > div {
  display: flex;
  justify-content: space-between;
  gap: var(--s2);
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 2px;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
}

.creed {
  margin: var(--s3) 0 0;
  font-size: 12px;
  line-height: 1.45;
  font-style: italic;
}

.events {
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: 12px;
}

.events li {
  display: grid;
  grid-template-columns: 10rem 6rem 1fr;
  gap: var(--s2);
  align-items: baseline;
}

/* Meaning is carried by the word, never by the colour alone. */
.kind {
  color: var(--accent);
}

.who {
  color: var(--muted);
  text-transform: capitalize;
}

.decisions {
  margin-top: var(--s4);
}

.decisions h4 {
  margin: 0 0 var(--s2);
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ruling {
  border-left: 2px solid var(--border);
  padding-left: var(--s3);
  margin-bottom: var(--s3);
}

.ruling.crimson { border-left-color: var(--crimson); }
.ruling.azure { border-left-color: var(--azure); }
.ruling.verdant { border-left-color: var(--verdant); }
.ruling.amber { border-left-color: var(--amber); }

.ruling p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.meta {
  font-size: 11px;
  color: var(--muted);
  text-transform: capitalize;
}

.late {
  color: var(--accent);
  text-transform: none;
}

.log {
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  max-height: 22rem;
  overflow-y: auto;
}

.log li {
  display: grid;
  grid-template-columns: 6rem 6rem 1fr;
  gap: var(--s2);
  align-items: baseline;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: var(--s2);
}

.jump {
  min-height: 0;
  min-width: 0;
  padding: 2px var(--s2);
  font-size: 11px;
  background: transparent;
}

.said {
  line-height: 1.45;
}

@media (max-width: 640px) {
  .events li,
  .log li {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
