<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { ReplaySchema, type Replay } from "@abs/contracts";
import BattleGrid from "./components/BattleGrid.vue";
import EventLog from "./components/EventLog.vue";
import GeneralPanel from "./components/GeneralPanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
// Three.js is ~400 KB. The card requires the 2D mode to stay performant, so a
// reader who never opens the 3D view never downloads it.
const Battle3D = defineAsyncComponent(() => import("./components/Battle3D.vue"));
import { BattleAudio } from "./three/audio";

const replay = ref<Replay | null>(null);
const error = ref<string | null>(null);
/** 0 is the deployment; 1..n is the state after turn n. */
const index = ref(0);
const playing = ref(false);
const speed = ref(1);
const highlight = ref<string | null>(null);

const SPEEDS = [0.5, 1, 2, 4];
const BASE_MS = 1100;

/** 2D stays the default and stays complete; 3D is an alternative view. */
const view3d = ref(false);

/** Catalogue of replays this deployment serves, newest first. */
interface CatalogueEntry {
  path: string;
  battleId: string;
  ruleset: string;
  turns: number;
  outcome: string;
  winner: string | null;
  hasReports: boolean;
}
const catalogue = ref<CatalogueEntry[]>([]);
const currentPath = ref<string>("");
const audio = new BattleAudio();
const soundOn = ref(false);

const turnCount = computed(() => replay.value?.turns.length ?? 0);
const current = computed(() => {
  if (!replay.value) return null;
  return index.value === 0 ? replay.value.initialState : replay.value.turns[index.value - 1]!.stateAfter;
});
const currentTurn = computed(() => (index.value === 0 ? null : replay.value!.turns[index.value - 1]!));
const atEnd = computed(() => index.value >= turnCount.value);

function load(raw: unknown, source: string) {
  const parsed = ReplaySchema.safeParse(raw);
  if (!parsed.success) {
    error.value = `Replay invalide (${source}) : ${parsed.error.issues[0]?.path.join(".")} — ${parsed.error.issues[0]?.message}`;
    return;
  }
  replay.value = parsed.data;
  error.value = null;
  index.value = 0;
}

async function loadFromUrl(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    load(await res.json(), url);
  } catch (err) {
    error.value = `Impossible de charger ${url} — ${(err as Error).message}. Choisissez un fichier de replay ci-dessous.`;
  }
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    load(JSON.parse(await file.text()), file.name);
  } catch (err) {
    error.value = `Fichier illisible — ${(err as Error).message}`;
  }
}

const step = (delta: number) => {
  index.value = Math.min(turnCount.value, Math.max(0, index.value + delta));
  if (atEnd.value) playing.value = false;
};

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement) return;
  const actions: Record<string, () => void> = {
    ArrowRight: () => step(1),
    ArrowLeft: () => step(-1),
    Home: () => (index.value = 0),
    End: () => (index.value = turnCount.value),
    " ": () => (playing.value = !playing.value),
  };
  const action = actions[e.key];
  if (!action) return;
  e.preventDefault();
  action();
}

let timer: number | undefined;
watch([playing, speed], () => {
  clearInterval(timer);
  if (!playing.value) return;
  timer = window.setInterval(() => (atEnd.value ? (playing.value = false) : step(1)), BASE_MS / speed.value);
});

async function loadCatalogue() {
  try {
    const res = await fetch("replays/index.json");
    if (res.ok) catalogue.value = await res.json();
  } catch {
    // No catalogue is fine: the picker simply does not appear.
  }
}

function pick(path: string) {
  currentPath.value = path;
  // Keep the URL honest, so a chosen replay can be shared or reloaded.
  const url = new URL(location.href);
  url.searchParams.set("replay", `replays/${path}`);
  history.replaceState(null, "", url);
  loadFromUrl(`replays/${path}`);
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  await loadCatalogue();

  const requested = new URLSearchParams(location.search).get("replay");
  if (requested) {
    currentPath.value = requested.replace(/^replays\//, "");
    loadFromUrl(requested);
    return;
  }
  // Default to the newest battle rather than a hardcoded filename, so adding a
  // replay does not leave the landing page showing an old one.
  const first = catalogue.value[0]?.path ?? "reference.json";
  currentPath.value = first;
  loadFromUrl(`replays/${first}`);
});
// Sound follows the turn being displayed, so scrubbing backwards is silent
// rather than replaying old noise.
watch(index, (next, previous) => {
  if (!soundOn.value || next <= previous || !replay.value) return;
  audio.playTurn(replay.value.turns[next - 1]?.events ?? []);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  clearInterval(timer);
  audio.dispose();
});
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="title">
        <h1>AI Battle Simulator</h1>
        <!--
          The MVP is explicit that nobody watches a battle live: every call costs
          seconds of API latency. Saying so up front stops the scrubber from
          being read as a live feed.
        -->
        <p class="recorded mono">BATAILLE ENREGISTRÉE — lecture différée, pas un direct</p>
      </div>
      <label v-if="catalogue.length > 1" class="picker-inline mono">
        <span class="visually-hidden">Bataille affichée</span>
        <select :value="currentPath" @change="pick(($event.target as HTMLSelectElement).value)">
          <option v-for="entry in catalogue" :key="entry.path" :value="entry.path">
            {{ entry.ruleset }} · {{ entry.turns }} tours · {{ entry.outcome }}{{ entry.winner ? ` ${entry.winner}` : "" }}{{
              entry.hasReports ? " · rapports" : ""
            }} — {{ entry.path }}
          </option>
        </select>
      </label>

      <dl v-if="replay" class="summary mono">
        <div>
          <dt>issue</dt>
          <dd>
            {{ replay.outcome.kind }}{{
              replay.outcome.winner
                ? ` · ${replay.outcome.winner}`
                : replay.outcome.winners?.length
                  ? ` · ${replay.outcome.winners.join(" + ")}`
                  : ""
            }}
          </dd>
        </div>
        <div><dt>tours</dt><dd>{{ turnCount }}</dd></div>
        <div><dt>règles</dt><dd>{{ replay.manifest.rulesetVersion }}</dd></div>
        <div><dt>graine</dt><dd>{{ replay.manifest.config.seed }}</dd></div>
      </dl>
    </header>

    <p v-if="error" class="card error" role="alert">{{ error }}</p>

    <p v-if="!replay" class="card picker">
      <label for="file">Charger un fichier de replay</label>
      <input id="file" type="file" accept="application/json" @change="onFile" />
    </p>

    <main v-if="replay && current" class="layout">
      <section class="board">
        <div class="viewswitch" role="group" aria-label="Mode d'affichage">
          <button type="button" class="mono" :aria-pressed="!view3d" @click="view3d = false">Grille 2D</button>
          <button type="button" class="mono" :aria-pressed="view3d" @click="view3d = true">Vue 3D</button>
          <button
            type="button"
            class="mono"
            :aria-pressed="soundOn"
            :title="soundOn ? 'Couper le son' : 'Activer le son (synthétisé, aucun fichier)'"
            @click="soundOn = !soundOn; audio.enabled = soundOn"
          >
            {{ soundOn ? "Son activé" : "Son coupé" }}
          </button>
        </div>

        <Battle3D
          v-if="view3d"
          :state="current"
          :grid-size="replay.manifest.config.gridSize"
          :alliance-pairs="currentTurn?.alliances?.pairs ?? []"
        />
        <BattleGrid
          v-else
          :state="current"
          :grid-size="replay.manifest.config.gridSize"
          :highlight="highlight"
          :alliance-pairs="currentTurn?.alliances?.pairs ?? []"
        />

        <p v-if="currentTurn?.alliances?.pairs?.length" class="alliances mono">
          Alliances en vigueur :
          {{ currentTurn.alliances.pairs.map((p) => p.replace("|", " + ")).join(" · ") }}
        </p>
        <p v-if="currentTurn?.alliances?.surrendered?.length" class="alliances mono surrender">
          Ont capitulé : {{ currentTurn.alliances.surrendered.join(", ") }}
        </p>

        <div class="controls card">
          <div class="buttons">
            <!-- Text labels rather than transport glyphs: ▶ and ⏮ render as
                 colour emoji on some platforms, which the design system rules
                 out for icons. -->
            <button type="button" class="mono" :disabled="index === 0" aria-label="Revenir au déploiement" @click="index = 0">
              Début
            </button>
            <button type="button" class="mono" :disabled="index === 0" aria-label="Tour précédent" @click="step(-1)">
              Préc.
            </button>
            <button
              type="button"
              class="play"
              :aria-label="playing ? 'Mettre en pause' : 'Lancer la lecture'"
              :disabled="atEnd"
              @click="playing = !playing"
            >
              {{ playing ? "Pause" : "Lecture" }}
            </button>
            <button type="button" class="mono" :disabled="atEnd" aria-label="Tour suivant" @click="step(1)">Suiv.</button>
            <button type="button" class="mono" :disabled="atEnd" aria-label="Aller à la fin" @click="index = turnCount">
              Fin
            </button>
          </div>

          <label class="scrub">
            <span class="visually-hidden">Tour affiché</span>
            <input v-model.number="index" type="range" min="0" :max="turnCount" step="1" />
            <output class="mono">{{ index === 0 ? "déploiement" : `tour ${index} / ${turnCount}` }}</output>
          </label>

          <div class="speeds" role="group" aria-label="Vitesse de lecture">
            <button
              v-for="s in SPEEDS"
              :key="s"
              type="button"
              class="speed mono"
              :aria-pressed="speed === s"
              @click="speed = s"
            >
              {{ s }}×
            </button>
          </div>
        </div>

        <p class="hint mono">Clavier : ← → tour à tour · Espace lecture/pause · Début / Fin</p>
        <p class="live" role="status" aria-live="polite">
          {{ index === 0 ? "Déploiement initial" : `Tour ${index} sur ${turnCount}` }}, {{ current.squads.length }} escouades en vie.
        </p>
      </section>

      <aside class="side">
        <GeneralPanel v-if="currentTurn" :decisions="currentTurn.decisions" :state="current" />
        <p v-else class="card empty">
          Déploiement initial. Avancez d'un tour pour lire les ordres et la justification de chaque général.
        </p>
        <EventLog :events="currentTurn?.events ?? []" @focus-squad="highlight = $event" />
      </aside>
    </main>

    <ReportPanel
      v-if="replay?.reports?.length"
      :reports="replay.reports"
      :audits="replay.audits"
      @go-to-turn="index = Math.min(turnCount, Math.max(0, $event))"
    />

    <footer v-if="replay" class="foot mono">
      {{ replay.outcome.reason }} · replay {{ replay.manifest.battleId }} · contrats {{ replay.manifest.contractsVersion }}
    </footer>
  </div>
</template>

<style scoped>
.app {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--s5) var(--s4);
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.top {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s4);
  align-items: flex-start;
  justify-content: space-between;
}

h1 {
  font-size: clamp(20px, 3vw, 28px);
}

.recorded {
  margin: var(--s1) 0 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.summary,
.controls dl {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s4);
  margin: 0;
  font-size: 12px;
}

.summary dt {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10px;
}

.summary dd {
  margin: 0;
  font-size: 14px;
}

.error {
  color: var(--crimson);
  border-color: var(--crimson);
  margin: 0;
}

.picker-inline select {
  font: inherit;
  font-size: 12px;
  color: var(--fg);
  background: var(--card-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--s2);
  min-height: 44px;
  max-width: min(100%, 60ch);
  cursor: pointer;
}

.picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  margin: 0;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
  gap: var(--s4);
  align-items: start;
}

.board {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-width: 0;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-width: 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.play {
  min-width: 116px;
  font-weight: 600;
}

.scrub {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.scrub input {
  flex: 1;
  min-width: 0;
  height: 44px;
  accent-color: var(--accent);
  cursor: pointer;
}

.scrub output {
  flex: none;
  min-width: 116px;
  text-align: right;
  font-size: 12px;
  color: var(--muted);
}

.speeds {
  display: flex;
  gap: var(--s2);
}

.speed {
  flex: 1;
  font-size: 12px;
}

.viewswitch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.viewswitch button {
  font-size: 12px;
}

.alliances {
  margin: 0;
  font-size: 12px;
  color: var(--verdant);
}

.alliances.surrender {
  color: var(--amber);
}

.hint,
.live {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

.empty {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.foot {
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--border-soft);
  padding-top: var(--s3);
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
