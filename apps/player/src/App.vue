<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { FACTION_IDS, ReplaySchema, type FactionId, type Replay } from "@abs/contracts";
import BattleGrid from "./components/BattleGrid.vue";
import EventLog from "./components/EventLog.vue";
import GeneralPanel from "./components/GeneralPanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
import FogView from "./components/FogView.vue";
import { JournalSchema, WORLD_VERSION, worldVersionOf, type Journal } from "@abs/world";
import { alliesOfAt, knowledgeOf } from "./fog";
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

/**
 * Whose eyes we are reading through. Null is the omniscient view, which shows
 * more than any general ever saw — useful, but not what the battle was like.
 */
const fogFaction = ref<FactionId | null>(null);
const fogAllies = computed(() =>
  fogFaction.value && replay.value ? alliesOfAt(replay.value, fogFaction.value, index.value) : [],
);
const fogKnowledge = computed(() =>
  fogFaction.value && replay.value ? knowledgeOf(replay.value, fogFaction.value, index.value) : null,
);
const fogHidden = computed(() => {
  const k = fogKnowledge.value;
  return k && current.value ? current.value.squads.filter((s) => !k.visible.has(s.id)).length : 0;
});

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

/**
 * Battles and worlds are two ways of watching the same models, not two apps.
 * A battle is a match with an end; a world is a place that keeps going. The
 * chronicle only appears when a deployment actually serves a world.
 */
type Mode = "battle" | "world" | "reports" | "rules";
const mode = ref<Mode>("world");

interface WorldEntry {
  path: string;
  world: string;
  era: number;
  livedTo: number;
  rulings: number;
  alive: number;
  over: boolean;
  survivor: string | null;
}
const worlds = ref<WorldEntry[]>([]);
/**
 * Worlds and battles keep their own error.
 *
 * They used to share one, so a missing replay file shouted over a perfectly
 * clear message about an archived world — a reader following a permalink was
 * told about a battle they had not asked for. Two independent things deserve
 * two independent failures.
 */
const worldError = ref<string | null>(null);
/** How the machine tending these worlds last fared. Absent when nobody tends them. */
const tendStatus = ref<{ ranAt: string; world: string; ok: boolean; years: number; error: string | null } | null>(null);
const worldPath = ref<string>("");
const journal = ref<Journal | null>(null);
// Three.js is lazy for weight; the chronicle is lazy for the same reason —
// a reader who only watches battles never loads the world engine.
const Chronicle = defineAsyncComponent(() => import("./components/Chronicle.vue"));
const Reports = defineAsyncComponent(() => import("./components/Reports.vue"));
const Rules = defineAsyncComponent(() => import("./components/Rules.vue"));

async function loadWorlds() {
  try {
    const res = await fetch("worlds/index.json");
    if (res.ok) worlds.value = await res.json();
  } catch {
    // No worlds served here. The chronicle tab simply does not appear.
  }
  try {
    const res = await fetch("worlds/status.json");
    if (res.ok) tendStatus.value = await res.json();
  } catch {
    // Nobody tends these worlds automatically; the chronicle says nothing.
  }
}

async function openWorld(path: string) {
  worldPath.value = path;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // An archived world is not a broken file, and saying "Invalid literal
    // value, expected w3" to a reader who followed a permalink is telling them
    // about zod instead of about the world. The rules a world lived under are
    // part of what it was.
    const version = worldVersionOf(raw);
    if (version !== WORLD_VERSION) {
      journal.value = null;
      worldError.value =
        `Ce monde a vécu sous les règles ${version ?? "inconnues"}, et le moteur tourne aujourd'hui en ${WORLD_VERSION}. ` +
        `Il est conservé comme archive : le rejouer sous les règles d'aujourd'hui montrerait des années qu'il n'a jamais vécues.`;
      return;
    }

    const parsed = JournalSchema.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "journal invalide");
    journal.value = parsed.data;
    worldError.value = null;
  } catch (err) {
    journal.value = null;
    worldError.value = `Impossible de charger ${path} — ${(err as Error).message}`;
  }
}
const currentPath = ref<string>("");
/** A turn requested by URL, applied once the replay's length is known. */
let pendingTurn = 0;
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
  // A turn asked for in the URL is honoured once the replay is known to be
  // long enough; otherwise we open at the deployment.
  index.value = pendingTurn > 0 ? Math.min(pendingTurn, parsed.data.turns.length) : 0;
  pendingTurn = 0;
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
  if (e.target instanceof HTMLInputElement || mode.value !== "battle") return;
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

// The point of view belongs in the URL too: "look at turn 7 through amber's
// eyes" is exactly the kind of thing one person sends another.
watch([fogFaction, index, view3d], ([faction, turn, is3d]) => {
  const url = new URL(location.href);
  if (faction) url.searchParams.set("view", faction as string);
  else url.searchParams.delete("view");
  if ((turn as number) > 0) url.searchParams.set("turn", String(turn));
  else url.searchParams.delete("turn");
  if (is3d) url.searchParams.set("mode", "3d");
  else url.searchParams.delete("mode");
  history.replaceState(null, "", url);
});

watch([mode, worldPath], ([m, path]) => {
  const url = new URL(location.href);
  if (m === "world" && path) url.searchParams.set("world", path as string);
  else url.searchParams.delete("world");
  if (m === "reports") url.searchParams.set("mode", "rapports");
  else if (m === "rules") url.searchParams.set("mode", "regles");
  else if (["rapports", "regles"].includes(url.searchParams.get("mode") ?? "")) url.searchParams.delete("mode");
  history.replaceState(null, "", url);
});

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  await Promise.all([loadCatalogue(), loadWorlds()]);

  const wanted = new URLSearchParams(location.search).get("world");
  if (wanted || worlds.value.length > 0) {
    const first = wanted ?? worlds.value[0]!.path;
    await openWorld(first);
    if (wanted) mode.value = "world";
  }

  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "3d") view3d.value = true;
  if (params.get("mode") === "regles") mode.value = "rules";
  else if (params.get("mode") === "rapports" || params.get("rapport")) mode.value = "reports";
  else if (params.get("replay") || params.get("turn")) mode.value = "battle";
  const view = params.get("view");
  if (view && (FACTION_IDS as readonly string[]).includes(view)) fogFaction.value = view as FactionId;
  const turn = Number(params.get("turn"));
  if (Number.isInteger(turn) && turn > 0) pendingTurn = turn;

  const requested = params.get("replay");
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
        <p class="recorded mono">
          {{
            mode === "battle"
              ? "ARCHIVES — les batailles tactiques, un chapitre antérieur, gelé"
              : mode === "world"
                ? "MONDE CONTINU — recomposé année par année dans votre navigateur"
                : mode === "rules"
                  ? "RÈGLES — ce qu'un dirigeant décide, et ce que le monde fait de son côté"
                  : "MESURES — ce que le projet a vérifié, y compris quand ça l'a contredit"
          }}
        </p>
      </div>

      <div v-if="worlds.length > 0" class="modeswitch" role="group" aria-label="Ce qu'on regarde">
        <button type="button" class="mono" :aria-pressed="mode === 'world'" @click="mode = 'world'">Chronique</button>
        <button type="button" class="mono" :aria-pressed="mode === 'battle'" @click="mode = 'battle'">Archives</button>
        <button type="button" class="mono" :aria-pressed="mode === 'rules'" @click="mode = 'rules'">Règles</button>
        <button type="button" class="mono" :aria-pressed="mode === 'reports'" @click="mode = 'reports'">Rapports</button>
      </div>
      <label v-if="mode === 'world' && worlds.length > 1" class="picker-inline mono">
        <span class="visually-hidden">Monde affiché</span>
        <select :value="worldPath" @change="openWorld(($event.target as HTMLSelectElement).value)">
          <option v-for="w in worlds" :key="w.path" :value="w.path">
            {{ w.world }} · ère {{ w.era }} · {{ w.livedTo }} ans ·
            {{ w.over ? (w.survivor ? `${w.survivor} seule` : "éteint") : `${w.alive} vivantes` }}
          </option>
        </select>
      </label>

      <label v-if="mode === 'battle' && catalogue.length > 1" class="picker-inline mono">
        <span class="visually-hidden">Bataille affichée</span>
        <select :value="currentPath" @change="pick(($event.target as HTMLSelectElement).value)">
          <option v-for="entry in catalogue" :key="entry.path" :value="entry.path">
            {{ entry.ruleset }} · {{ entry.turns }}t · {{ entry.outcome }}{{ entry.hasReports ? " · rapports" : "" }} —
            {{ entry.path }}
          </option>
        </select>
      </label>

      <dl v-if="mode === 'battle' && replay" class="summary mono">
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

    <p v-if="mode === 'battle' && error" class="card error" role="alert">{{ error }}</p>
    <p v-if="mode === 'world' && worldError" class="card error" role="alert">{{ worldError }}</p>

    <Chronicle v-if="mode === 'world' && journal" :journal="journal" :status="tendStatus" />

    <Reports v-if="mode === 'reports'" />

    <Rules v-if="mode === 'rules'" />

    <p v-if="mode === 'world' && !journal && !worldError" class="card picker">
      Aucun monde n'est servi par ce déploiement. Faites-en vivre un avec
      <code class="mono">npm run live</code>, puis <code class="mono">npm run index-worlds</code>.
    </p>

    <p v-if="mode === 'battle' && !replay" class="card picker">
      <label for="file">Charger un fichier de replay</label>
      <input id="file" type="file" accept="application/json" @change="onFile" />
    </p>

    <p v-if="mode === 'battle'" class="card archive-note">
      Les règles <strong>v1</strong> et <strong>v2</strong> sont gelées : quatre modèles commandaient
      des escouades sur une grille, et c'est de là que ce projet est parti. Le monde continu leur a
      succédé parce qu'il répond mieux à la même question, et pour bien moins d'appels — 98 % de
      service contre moins de 50 %. Ces batailles restent jouables et lisibles telles quelles.
    </p>

    <main v-if="mode === 'battle' && replay && current" class="layout">
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

        <FogView
          v-model="fogFaction"
          :knowledge="fogKnowledge"
          :allies="fogAllies"
          :hidden="fogHidden"
          :turn-index="index"
        />

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
          :visible="fogKnowledge?.visible ?? null"
          :remembered="fogKnowledge?.remembered ?? null"
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
  min-width: 0;
}

.top > * {
  min-width: 0;
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

/* A select sizes itself to its longest option, which pushed the header past
   the viewport at 375px — and this project's own rule is that the body never
   scrolls horizontally. Constrained on both the flex item and the control. */
.picker-inline {
  flex: 1 1 100%;
  min-width: 0;
  max-width: 100%;
}

.picker-inline select {
  width: 100%;
  font: inherit;
  font-size: 12px;
  color: var(--fg);
  background: var(--card-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--s2);
  min-height: 44px;
  max-width: 100%;
  cursor: pointer;
  text-overflow: ellipsis;
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

.viewswitch,
.modeswitch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.viewswitch button,
.modeswitch button {
  font-size: 12px;
}

.archive-note {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  max-width: 74ch;
  line-height: 1.6;
}

.archive-note strong {
  color: var(--fg);
  font-weight: 600;
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
