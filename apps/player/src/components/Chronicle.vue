<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FACTION_IDS, type FactionId } from "@abs/contracts";
import { chronicle, turningPoints, type Journal, type Year } from "@abs/world";
import CivilisationProfile from "./CivilisationProfile.vue";
import CivTrend from "./CivTrend.vue";
import EmpireShare from "./EmpireShare.vue";
import type { PublishedLearningCurve } from "./LearningCurve.vue";
import TurningPoint from "./TurningPoint.vue";
import WorldStage from "./WorldStage.vue";

/**
 * A world, read year by year.
 *
 * The journal holds only an origin and a handful of decisions, so everything
 * shown here is recomputed in the browser by the same engine that lived it.
 * Nothing is trusted from a rendering: if the chart and the cards disagree with
 * the world, the engine is what is wrong, and that is the point.
 */
const props = defineProps<{ journal: Journal; status?: TendStatus | null; learningCurves?: PublishedLearningCurve[] }>();

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

const year = computed(() => years.value[Math.min(index.value, years.value.length - 1)]!);
const turns = computed(() => turningPoints(years.value));
const latestTurn = computed(() => turns.value.at(-1)?.tick ?? null);
const seekTick = (tick: number) => {
  const at = years.value.findIndex((item) => item.tick === tick);
  if (at >= 0) index.value = at;
};
const metric = ref<"population" | "territory" | "soldiers" | "wealth">("population");

const askedCiv = new URLSearchParams(location.search).get("civ");
const selectedCiv = ref<FactionId | null>(askedCiv && (FACTION_IDS as readonly string[]).includes(askedCiv) ? askedCiv as FactionId : null);
watch(selectedCiv, (civ) => {
  const url = new URL(location.href);
  if (civ) url.searchParams.set("civ", civ);
  else url.searchParams.delete("civ");
  history.replaceState(null, "", url);
});
const profileCiv = computed(() => selectedCiv.value ? year.value.world.civs.find((civ) => civ.id === selectedCiv.value) ?? null : null);
const profileHistory = computed(() => ({
  turnings: selectedCiv.value ? turns.value.filter((turn) => turn.civ === null || turn.civ === selectedCiv.value) : [],
}));
const profileCurve = computed(() => {
  if (!selectedCiv.value) return null;
  const models = new Set(
    props.journal.rulings
      .filter((ruling) => ruling.civ === selectedCiv.value && ruling.service)
      .map((ruling) => ruling.service!.requestedModel),
  );
  if (models.size !== 1) return null;
  const model = [...models][0];
  const modelCivs = new Set(
    props.journal.rulings
      .filter((ruling) => ruling.service?.requestedModel === model)
      .map((ruling) => ruling.civ),
  );
  if (modelCivs.size !== 1 || !modelCivs.has(selectedCiv.value)) return null;
  return props.learningCurves?.find((curve) => curve.modelId === model) ?? null;
});

function showProfile(civ: FactionId) {
  selectedCiv.value = civ;
  requestAnimationFrame(() => document.querySelector(".profile-shell")?.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  }));
}

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

const register = computed(() =>
  years.value
    .flatMap((item) => [
      ...item.events.map((event) => ({ tick: item.tick, civ: event.civ, kind: EVENT_LABEL[event.kind] ?? event.kind, detail: event.detail, ruling: false })),
      ...item.rulings.map((ruling) => ({
        tick: item.tick,
        civ: ruling.civ,
        kind: `décision · ${ruling.kind.toLowerCase()}`,
        detail: ruling.reason || "sans explication",
        ruling: true,
      })),
    ])
    .sort((a, b) => b.tick - a.tick),
);

const round = (n: number) => Math.round(n);
</script>

<template>
  <main class="chronicle">
    <p v-if="tended" class="tended mono" :class="tended.tone" :role="tended.tone === 'ok' ? undefined : 'status'">
      <span class="state-word">{{ tended.tone === "ok" ? "ÉTAT" : tended.tone === "warn" ? "RETARD" : "ARRÊT" }}</span>
      {{ tended.text }}
    </p>

    <WorldStage :years="years" :index="index" :turning-tick="latestTurn" @seek="(i) => (index = i)" />

    <p class="live" role="status" aria-live="polite">An {{ year.tick }}, ère {{ journal.era }}.</p>

    <TurningPoint :journal="journal" :years="years" :at="year.tick" @seek="seekTick" />

    <section class="civilizations" aria-labelledby="civs-title">
      <header class="section-heading">
        <p class="eyebrow mono">État comparé · an {{ year.tick }}</p>
        <h2 id="civs-title">Les quatre civilisations</h2>
      </header>
      <div class="civs">
        <article v-for="civ in year.world.civs" :key="civ.id" class="civ" :class="[civ.id, { fallen: civ.fellOnTick !== null }]">
          <h3>
            <!-- Deux lettres, pas une : Amber et Azure portaient toutes deux
                 un « A », donc le sigle ne distinguait pas ce qu'il nommait. -->
            <span class="sigil mono" aria-hidden="true">{{ civ.id.slice(0, 2).toUpperCase() }}</span>
            {{ civ.id }}
            <span v-if="civ.fellOnTick !== null" class="mono dead">éteinte · an {{ civ.fellOnTick }}</span>
            <span v-else class="mono posture">posture · {{ POSTURE[civ.doctrine.posture] }}</span>
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
          <p class="claims mono">convoite · {{ LAND_LABEL[civ.doctrine.claim] }}</p>
          <p v-if="civ.doctrine.vow" class="vow mono" :class="{ broken: civ.vowBrokenOn !== null }">
            serment · {{ VOW_LABEL[civ.doctrine.vow.metric] }} ≥ {{ civ.doctrine.vow.floor }} ·
            <span v-if="civ.vowBrokenOn !== null">rompu an {{ civ.vowBrokenOn }}</span><span v-else>tenu</span>
          </p>
          <blockquote v-if="civ.doctrine.creed" class="creed">« {{ civ.doctrine.creed }} »</blockquote>
          <p v-else class="creed muted">Aucun dirigeant n'a encore écrit de credo.</p>
          <button type="button" class="profile-link mono" :aria-pressed="selectedCiv === civ.id" @click="showProfile(civ.id)">
            {{ selectedCiv === civ.id ? "Profil affiché" : "Voir le profil" }}
          </button>
        </article>
      </div>
    </section>

    <section v-if="profileCiv" class="profile-shell" :class="profileCiv.id" aria-label="Profil sélectionné">
      <button type="button" class="close-profile mono" @click="selectedCiv = null">Fermer le profil</button>
      <CivilisationProfile
        :identity="profileCiv.identity"
        :doctrine="profileCiv.doctrine"
        :history="profileHistory"
        :curve="profileCurve"
        @seek="seekTick"
      />
    </section>

    <section class="trajectories" aria-labelledby="trajectories-title">
      <header class="section-heading trajectory-heading">
        <div>
          <p class="eyebrow mono">Trajectoires · ère {{ journal.era }}</p>
          <h2 id="trajectories-title">Ce que le temps déplace</h2>
        </div>
        <div class="metrics" role="group" aria-label="Métrique de trajectoire">
          <button v-for="m in METRICS" :key="m.key" :aria-pressed="metric === m.key" @click="metric = m.key">{{ m.label }}</button>
        </div>
      </header>
      <div class="charts">
        <div class="chart share-chart"><EmpireShare :years="years" :at="year.tick" @seek="seekTick" /></div>
        <div class="chart"><CivTrend :years="years" :metric="metric" :at="year.tick" @seek="seekTick" /></div>
      </div>
    </section>

    <section class="register" aria-labelledby="register-title">
      <details>
        <summary>
          <span><span class="eyebrow mono">Journal exhaustif</span><strong id="register-title">Registre des événements et décisions</strong></span>
          <span class="mono count">{{ register.length }} inscriptions · ouvrir</span>
        </summary>
        <p v-if="register.length === 0" class="muted">Aucun événement ni décision n'est enregistré pour cette ère.</p>
        <ol v-else class="log">
          <li v-for="(row, i) in register" :key="`${row.tick}-${row.kind}-${i}`" :class="[row.civ, { ruling: row.ruling }]">
            <button class="jump mono" @click="seekTick(row.tick)">an {{ row.tick }}</button>
            <span class="mono who">{{ row.civ }}</span>
            <span class="mono kind">{{ row.kind }}</span>
            <q v-if="row.ruling" class="said">{{ row.detail }}</q>
            <span v-else class="said">{{ row.detail }}</span>
          </li>
        </ol>
      </details>
    </section>
  </main>
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

/* R1 editorial composition. Earlier selectors above remain useful for the
   metric details; these rules remove the equal-card rhythm around them. */
.chronicle {
  gap: 0;
}

.tended {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin: 0;
  padding: var(--s2) 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--muted);
  font-size: 10px;
}

.state-word {
  color: var(--fg);
  letter-spacing: 0.1em;
}

.tended.warn,
.tended.fail {
  color: var(--accent);
}

.live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.civilizations,
.trajectories,
.register {
  padding: clamp(var(--s6), 7vw, 88px) 0;
  border-bottom: 1px solid var(--border);
}

.section-heading {
  margin-bottom: var(--s6);
}

.section-heading .eyebrow,
.register .eyebrow {
  display: block;
  margin: 0 0 var(--s2);
  color: var(--accent);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-heading h2 {
  font-family: var(--display);
  font-size: clamp(32px, 5vw, 62px);
  font-weight: 400;
  line-height: 1;
}

.civs {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid var(--border-soft);
}

.civ {
  min-width: 0;
  padding: var(--s5);
  border-left: 1px solid var(--border-soft);
  border-bottom: 2px solid var(--faction, var(--border));
}

.civ:first-child {
  border-left: 0;
}

.civ.crimson { --faction: var(--crimson); border-left-color: var(--border-soft); }
.civ.azure { --faction: var(--azure); border-left-color: var(--border-soft); }
.civ.verdant { --faction: var(--verdant); border-left-color: var(--border-soft); }
.civ.amber { --faction: var(--amber); border-left-color: var(--border-soft); }

.civ.fallen {
  opacity: 0.62;
  background-image: repeating-linear-gradient(-45deg, transparent 0 7px, var(--border-soft) 7px 8px);
}

.civ h3 {
  justify-content: flex-start;
  flex-wrap: wrap;
  font-family: var(--display);
  font-size: 22px;
  font-weight: 400;
}

.sigil {
  min-width: 28px;
  height: 26px;
  padding: 0 var(--s1);
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--faction);
  border-radius: var(--radius);
  color: var(--faction);
  font-size: var(--t-micro);
  letter-spacing: 0.06em;
}

.posture,
.dead {
  width: 100%;
  padding-left: 34px;
}

.civ dl {
  grid-template-columns: 1fr;
  margin-top: var(--s5);
}

.civ .creed {
  margin: var(--s4) 0 0;
  padding: var(--s3) 0 0;
  border-top: 1px solid var(--border-soft);
  font-family: var(--display);
  font-size: 15px;
  font-style: normal;
}

.profile-link {
  width: 100%;
  margin-top: var(--s4);
  font-size: 11px;
}

.profile-shell {
  position: relative;
  scroll-margin-top: 104px;
  border-top: 2px solid var(--faction, var(--accent));
}

.profile-shell.crimson { --faction: var(--crimson); }
.profile-shell.azure { --faction: var(--azure); }
.profile-shell.verdant { --faction: var(--verdant); }
.profile-shell.amber { --faction: var(--amber); }

.close-profile {
  position: absolute;
  z-index: 2;
  top: var(--s4);
  right: 0;
  font-size: 10px;
}

.trajectory-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--s5);
}

.charts {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: var(--s6);
}

.chart {
  min-width: 0;
  padding-top: var(--s4);
  border-top: 1px solid var(--border-soft);
}

.register details {
  border-top: 1px solid var(--accent-dim);
}

.register summary {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  cursor: pointer;
}

.register summary strong {
  display: block;
  font-family: var(--display);
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 400;
}

.register .count {
  color: var(--muted);
  font-size: 10px;
}

.log {
  max-height: 38rem;
  margin-top: var(--s4);
}

.log li {
  grid-template-columns: 6rem 6rem 10rem minmax(0, 1fr);
  min-height: 44px;
  align-items: center;
}

.log li.ruling {
  border-left: 2px solid var(--accent);
  padding-left: var(--s3);
}

.log .kind {
  font-size: 10px;
  text-transform: uppercase;
}

.log .said {
  font-family: var(--sans);
  font-size: 13px;
  text-decoration: none;
}

.jump {
  min-height: 44px;
}

@media (max-width: 1000px) {
  .civs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .civ:nth-child(3) {
    border-left: 0;
  }

  .charts {
    grid-template-columns: 1fr;
  }

  .log li {
    grid-template-columns: 6rem 6rem minmax(8rem, 0.5fr) minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .section-heading,
  .trajectory-heading {
    display: block;
    margin-bottom: var(--s5);
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    margin-top: var(--s4);
  }

  .civs {
    grid-template-columns: 1fr;
  }

  .civ,
  .civ:nth-child(3) {
    padding: var(--s4) 0;
    border-left: 0;
  }

  .register summary {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
  }

  .log li {
    grid-template-columns: 1fr;
    gap: var(--s1);
    padding: var(--s3) 0;
  }
}
</style>
