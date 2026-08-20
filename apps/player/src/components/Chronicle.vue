<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { chronicle, JournalSchema, type Journal, type Year } from "@abs/world";
import CivTrend from "./CivTrend.vue";
import EmpireShare from "./EmpireShare.vue";
import Intro from "./Intro.vue";
import WorldStage from "./WorldStage.vue";

/**
 * A world, read year by year.
 *
 * The journal holds only an origin and a handful of decisions, so everything
 * shown here is recomputed in the browser by the same engine that lived it.
 * Nothing is trusted from a rendering: if the chart and the cards disagree with
 * the world, the engine is what is wrong, and that is the point.
 */
const props = defineProps<{ journal: Journal; status?: TendStatus | null }>();

/**
 * What the machine tending this world last did.
 *
 * A world that advances on a timer can stop advancing without anything saying
 * so: the page would keep showing a perfectly good chronicle that happens to be
 * three weeks old. This makes the silence visible, which is the only reason the
 * timer is safe to run unattended.
 */
export interface TendStatus {
  ranAt: string;
  world: string;
  ok: boolean;
  years: number;
  error: string | null;
}

const DAY = 86_400_000;
const staleness = computed(() => {
  if (!props.status) return null;
  const ran = Date.parse(props.status.ranAt);
  if (Number.isNaN(ran)) return null;
  const days = Math.floor((Date.now() - ran) / DAY);
  return { days, when: new Date(ran).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) };
});

/** Two days: one missed pass is a hiccup, two is something to look at. */
const tended = computed<{ tone: "ok" | "warn" | "fail"; text: string } | null>(() => {
  const s = props.status;
  const age = staleness.value;
  if (!s || !age) return null;
  if (!s.ok) return { tone: "fail", text: `La dernière passe a échoué le ${age.when}. Le monde ci-dessous s'arrête là.` };
  if (age.days >= 2) return { tone: "warn", text: `Aucune avancée depuis ${age.days} jours — dernière passe le ${age.when}.` };
  return { tone: "ok", text: `${s.years} années vécues le ${age.when}.` };
});

const years = computed<Year[]>(() => chronicle(props.journal));
const index = ref(0);

/**
 * The year lives in the URL.
 *
 * "Look at year 142" was an instruction one person had to give another out
 * loud. A world worth reading is worth linking into, and a scrubber position
 * that survives a reload is the cheapest way to make a moment shareable.
 */
const wantedYear = Number(new URLSearchParams(location.search).get("annee"));
watch(
  years,
  (list) => {
    const asked = Number.isInteger(wantedYear) && wantedYear > 0 ? list.findIndex((y) => y.tick === wantedYear) : -1;
    index.value = asked >= 0 ? asked : list.length - 1;
  },
  { immediate: true },
);

watch(index, () => {
  const url = new URL(location.href);
  // Only when it is not simply the latest year: a bare link should keep meaning
  // "the world as it stands", not freeze on whatever year it stood at.
  if (index.value < years.value.length - 1) url.searchParams.set("annee", String(year.value.tick));
  else url.searchParams.delete("annee");
  history.replaceState(null, "", url);
});

const copied = ref(false);
async function copyLink() {
  const url = new URL(location.href);
  url.searchParams.set("annee", String(year.value.tick));
  try {
    await navigator.clipboard.writeText(url.toString());
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    // Clipboard refused (no permission, insecure context). The URL bar already
    // carries the year, so nothing is lost — we just say nothing.
  }
}

const year = computed(() => years.value[Math.min(index.value, years.value.length - 1)]!);
const metric = ref<"population" | "territory" | "soldiers" | "wealth">("population");

const METRICS = [
  { key: "population", label: "Population" },
  { key: "territory", label: "Terres" },
  { key: "soldiers", label: "Soldats" },
  { key: "wealth", label: "Richesse" },
] as const;

/**
 * Land is shown as a small stacked bar rather than four more numbers.
 *
 * A civilisation's ground is now what decides what its doctrine can do, so it
 * has to be readable at a glance — and "3 plaines 1 fleuve" read as a row of
 * digits tells you nothing about the shape of a country.
 */
const LAND_KINDS = ["plain", "forest", "hill", "river"] as const;
const LAND_LABEL: Record<string, string> = {
  plain: "plaine",
  forest: "forêt",
  hill: "colline",
  river: "fleuve",
};

const VOW_LABEL: Record<string, string> = {
  food: "vivres",
  soldiers: "soldats",
  territory: "terres",
  population: "population",
};

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
  DISASTER: "catastrophe",
  VOW_BROKEN: "serment rompu",
};

/** The events worth a line in a chronicle. Growth every year is not history. */
const NOTABLE = new Set([
  "STARVED", "ADVANCE", "COLLAPSED", "SEIZED", "CEDED", "RAIDED", "LAND_FULL", "SHORTAGE", "DISASTER", "VOW_BROKEN",
]);
const notable = computed(() => year.value.events.filter((e) => NOTABLE.has(e.kind)));

/** Everything a ruler has ever said, newest first — the era's real narrative. */
const rulings = computed(() => [...props.journal.rulings].sort((a, b) => b.tick - a.tick));

const round = (n: number) => Math.round(n);
</script>

<template>
  <div class="chronicle">
    <p v-if="tended" class="card tended" :class="tended.tone" :role="tended.tone === 'ok' ? undefined : 'status'">
      <span class="dot" aria-hidden="true"></span>{{ tended.text }}
    </p>

    <Intro
      :era="journal.era"
      :years="journal.livedTo"
      :rulings="journal.rulings.length"
      :alive="year.world.civs.filter((c) => c.fellOnTick === null).length"
    />

    <header class="card head">
      <div>
        <h2>Ère {{ journal.era }}</h2>
        <p class="mono muted">année {{ year.tick }} sur {{ journal.livedTo }}</p>
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
      <EmpireShare :years="years" :at="year.tick" @seek="(t) => (index = t)" />
    </section>

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
        <button class="link mono" @click="copyLink">{{ copied ? "copié" : "lien vers cette année" }}</button>
      </label>
    </section>

    <WorldStage :years="years" :index="index" @seek="(i) => (index = i)" />

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
        <ul class="lands mono" :aria-label="`Terres : ${LAND_KINDS.map((k) => `${civ.lands[k]} ${LAND_LABEL[k]}`).join(', ')}`">
          <li v-for="k in LAND_KINDS" :key="k" :class="k" :style="{ flexGrow: civ.lands[k] }" :title="`${civ.lands[k]} ${LAND_LABEL[k]}`">
            <span v-if="civ.lands[k] > 0">{{ civ.lands[k] }}</span>
          </li>
        </ul>
        <p class="claims mono">convoite : {{ LAND_LABEL[civ.doctrine.claim] }}</p>
        <p v-if="civ.doctrine.vow" class="vow mono" :class="{ broken: civ.vowBrokenOn !== null }">
          serment (an {{ civ.doctrine.vow.sworn }}) : {{ VOW_LABEL[civ.doctrine.vow.metric] }} ≥ {{ civ.doctrine.vow.floor }}
          <span v-if="civ.vowBrokenOn !== null">— rompu an {{ civ.vowBrokenOn }}</span>
          <span v-else>— tenu</span>
        </p>

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

.tended {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: 13px;
  color: var(--muted);
  padding: var(--s3) var(--s4);
}

/* State reads from the word first; the dot only confirms it. */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--muted);
}

.tended.ok .dot { background: var(--verdant); }
.tended.warn { color: var(--amber); }
.tended.warn .dot { background: var(--amber); }
.tended.fail { color: var(--crimson); border-color: var(--crimson); }
.tended.fail .dot { background: var(--crimson); }

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

/* Land kinds are told apart by hue AND by their number, never by hue alone. */
.lands {
  display: flex;
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0;
  height: 18px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--border-soft);
}

.lands li {
  display: grid;
  place-items: center;
  font-size: 10px;
  color: #05070f;
  min-width: 0;
  overflow: hidden;
}

.lands li.plain { background: #a3e635; }
.lands li.forest { background: #34d399; }
.lands li.hill { background: #a8a29e; }
.lands li.river { background: #38bdf8; }

.claims {
  margin: var(--s1) 0 0;
  font-size: 11px;
  color: var(--muted);
}

/* A vow reads as kept or broken from the words; the colour only confirms it. */
.vow {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--verdant);
}

.vow.broken {
  color: var(--crimson);
}

.link {
  min-height: 0;
  min-width: 0;
  padding: 3px var(--s2);
  font-size: 11px;
  background: transparent;
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
