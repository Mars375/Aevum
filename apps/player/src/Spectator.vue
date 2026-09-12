<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { FactionId } from "@abs/contracts";
import type { Year } from "@abs/world";
import WorldDiorama from "./components/WorldDiorama.vue";
import { projectWorld, CIV_COLORS } from "./three/world-projection";
import {
  incidentFor,
  newSpectator,
  type SpectatorState,
  type resolveCouncil,
} from "../../../packages/world/src/spectator";
import type { Campaign } from "../../../packages/world/src/campaign";

interface Loaded {
  campaign: Campaign;
  state: SpectatorState;
  history: SpectatorState[];
  outcomes: ReturnType<typeof resolveCouncil>[];
  busy: boolean;
  error: string | null;
}
interface Summary {
  id: string;
  seed: number;
  mode: string;
  turn: number;
}
const loaded = ref<Loaded | null>(null),
  catalogue = ref<Summary[]>([]),
  providers = ref<{ id: string; configured: boolean }[]>([]);
const hud = ref(true);
const rosterOpen = ref(false),
  journalOpen = ref(false);
function selectUnit(id: string) {
  const unit = world.value.simulation?.units.find((u) => u.id === id);
  if (unit) selected.value = unit.owner;
  unitId.value = id;
  panel.value = "orders";
  journalOpen.value = true;
  rosterOpen.value = false;
}
function rulerStatus(id: FactionId) {
  if (world.value.civs.find((c) => c.id === id)?.fellOnTick !== null)
    return "Éteinte";
  if (latest.value && busy.value) {
    const answer = loaded.value?.campaign.pending?.answers.find(
      (a) => a.civ === id,
    );
    return answer
      ? answer.error
        ? "Indisponible"
        : "Ordres reçus"
      : "Conseil en cours";
  }
  const answer = answers.value.find((a) => a.civ === id);
  return answer?.error
    ? "Indisponible"
    : answer?.source === "remote"
      ? "Décision IA"
      : answer
        ? "Stratégie locale"
        : "Premier conseil à venir";
}
const failure = ref(""),
  requesting = ref(false),
  setup = ref(false),
  seed = ref(42),
  mode = ref<"local" | "remote">("local");
const models = ref<Record<string, string>>({
  amber: "",
  azure: "",
  crimson: "",
  verdant: "",
});
const selected = ref<FactionId | null>("amber"),
  unitId = ref<string | null>(null),
  panel = ref("orders"),
  index = ref(0),
  playing = ref(false),
  autoAdvance = ref(false),
  speed = ref(1);
const ids = ["amber", "azure", "crimson", "verdant"] as const;
const names = {
  amber: "Ambre",
  azure: "Azur",
  crimson: "Pourpre",
  verdant: "Sylve",
};
const technologies: Record<string, string> = {
  irrigation: "Irrigation",
  masonry: "Maçonnerie",
  metallurgy: "Métallurgie",
  coinage: "Monnaie",
  engineering: "Ingénierie",
  scholarship: "Érudition",
};
const roles: Record<string, string> = {
  soldier: "Armée",
  settler: "Colons",
  farmer: "Paysans",
  lumberjack: "Bûcherons",
  miner: "Mineurs",
  merchant: "Marchands",
};
const actions: Record<string, string> = {
  move: "Déplacement",
  defend: "Défense",
  attack: "Attaque",
  settle: "Fondation",
  explore: "Exploration",
  retreat: "Retraite",
  escort: "Escorte",
};
const statuses: Record<string, string> = {
  active: "En cours",
  completed: "Terminé",
  blocked: "Bloqué",
  interrupted: "Interrompu",
};
const eventNames: Record<string, string> = {
  GREW: "Croissance",
  STARVED: "Famine",
  EXPANDED: "Expansion",
  LOST_LAND: "Territoire perdu",
  ADVANCE: "Découverte",
  COLLAPSED: "Effondrement",
  SURPLUS: "Excédent",
  SHORTAGE: "Pénurie",
  HARD_YEAR: "Année difficile",
  LAND_FULL: "Territoires occupés",
  SEIZED: "Conquête",
  CEDED: "Cession",
  TRADED: "Commerce",
  ROUTED: "Déroute",
  HELD: "Position défendue",
  RAIDED: "Pillage",
  REPELLED: "Raid repoussé",
  DISASTER: "Catastrophe",
  VOW_BROKEN: "Serment rompu",
  CAPITAL_LOST: "Capitale perdue",
  CAPITAL_MOVED: "Nouvelle capitale",
  BUILT: "Construction",
  FOUNDED: "Ville fondée",
  RECRUITED: "Recrutement",
  WAR: "Guerre",
  PEACE: "Paix",
};
const buildings: Record<string, string> = {
  granary: "Grenier",
  workshop: "Atelier",
  market: "Marché",
  walls: "Remparts",
  academy: "Académie",
};
const missionText = (text: string) =>
  (
    ({
      "Moving toward destination": "En route vers la destination",
      "Destination reached": "Destination atteinte",
      "Route no longer available": "L’itinéraire n’est plus accessible",
      "Terrain delay": "Progression ralentie par le terrain",
      "Opposing unit contests this tile":
        "Une unité adverse conteste cette case",
      "Unit no longer available": "L’unité n’est plus disponible",
      "No traversable route": "Aucun itinéraire accessible",
      "Movement cannot replace an attack order":
        "Un déplacement ne peut pas remplacer un ordre d’attaque",
    }) as Record<string, string>
  )[text] ?? text;
const preview = newSpectator(42, "spectator-3");
const state = computed(() => loaded.value?.history[index.value] ?? preview);
const world = computed(() => state.value.world);
const deliveries = computed(() =>
  (state.value.economy ?? []).flatMap((ledger) => ledger.deliveries),
);
function cityName(id: string) {
  const city = world.value.simulation?.cities.find((c) => c.id === id);
  return city ? world.value.board[city.position]!.name : id;
}
const year = computed<Year>(() => ({
  tick: world.value.tick,
  world: world.value,
  events: [],
  rulings: [],
}));
const parcels = computed(() => projectWorld(year.value, [year.value]));
const civ = computed(() =>
  world.value.civs.find((c) => c.id === selected.value),
);
const units = computed(() =>
  world.value.simulation!.units.filter(
    (u) => !selected.value || u.owner === selected.value,
  ),
);
const mission = computed(() =>
  state.value.missions.find((m) => m.unit === unitId.value),
);
const route = computed(() => mission.value?.route ?? []);
const strategicPlan = computed(() =>
  selected.value ? state.value.plans?.[selected.value] : undefined,
);
const planLabels = {
  settle: "Fonder une ville",
  build: "Développer une ville",
  research: "Faire une découverte",
  trade: "Acheminer une livraison",
};
const planStatuses = {
  active: "En cours",
  completed: "Accompli",
  blocked: "Bloqué",
  cancelled: "Abandonné",
};
const planTarget = computed(() => {
  const plan = strategicPlan.value;
  if (!plan) return "";
  if (plan.kind === "research")
    return technologies[plan.targetTech ?? ""] ?? "Recherche";
  const city = world.value.simulation?.cities.find(
    (c) => c.id === plan.targetCity,
  );
  const place = city
    ? world.value.board[city.position]?.name
    : plan.targetTile !== null
      ? world.value.board[plan.targetTile]?.name
      : undefined;
  if (plan.kind === "trade")
    return place ? `Livraison vers ${place}` : "Ville de destination";
  if (plan.kind === "build")
    return [buildings[plan.targetBuilding ?? ""], place]
      .filter(Boolean)
      .join(" · ");
  return place ?? "Territoire à coloniser";
});
const incident = computed(() =>
  incidentFor(world.value.seed, world.value.tick),
);
const outcome = computed(() => loaded.value?.outcomes[index.value - 1]);
const followEvents = ref(false);
const cameraEvent = computed(() => {
  if (!followEvents.value) return null;
  const event = outcome.value?.events.find((e) =>
    ["FOUNDED", "STARVED", "ADVANCE", "BUILT"].includes(e.kind),
  );
  if (!event) return null;
  const city =
    event.kind === "FOUNDED"
      ? world.value.simulation?.cities.find(
          (c) => c.owner === event.civ && c.founded === world.value.tick,
        )
      : null;
  const tile =
    city?.position ?? world.value.civs.find((c) => c.id === event.civ)?.capital;
  return tile == null
    ? null
    : {
        tile,
        key: [
          loaded.value?.campaign.id,
          world.value.tick,
          event.kind,
          event.civ,
          tile,
        ].join(":"),
      };
});
const answers = computed(
  () => loaded.value?.campaign.turns[index.value - 1]?.answers ?? [],
);
const latest = computed(
  () => index.value === (loaded.value?.history.length ?? 1) - 1,
);
const busy = computed(() => requesting.value || loaded.value?.busy);
const over = computed(
  () => world.value.civs.filter((c) => c.fellOnTick === null).length < 2,
);
let polling: ReturnType<typeof setInterval> | undefined,
  playTimer: ReturnType<typeof setInterval> | undefined;
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Service local indisponible. Lancez npm run spectator:server.",
    );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Service indisponible");
  return data;
}
async function list() {
  const data = await api<{
    campaigns: Summary[];
    providers: { id: string; configured: boolean }[];
  }>("/campaigns");
  catalogue.value = data.campaigns;
  providers.value = data.providers;
}
async function load(id: string, follow = true) {
  const value = await api<Loaded>(`/campaigns/${id}`);
  loaded.value = value;
  if (follow) index.value = value.history.length - 1;
  else index.value = Math.min(index.value, value.history.length - 1);
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("campaign", id);
  history.replaceState(null, "", url);
  if (value.error) {
    failure.value = value.error;
    autoAdvance.value = false;
  }
  if (
    value.campaign.turns.at(-1)?.answers.some((a) => a.source === "unavailable")
  )
    autoAdvance.value = false;
}
async function create() {
  requesting.value = true;
  failure.value = "";
  playing.value = autoAdvance.value = false;
  try {
    const { id } = await api<{ id: string }>("/campaigns", {
      seed: seed.value,
      mode: mode.value,
      models: models.value,
    });
    await load(id);
    setup.value = false;
    await list();
  } catch (e) {
    failure.value = e instanceof Error ? e.message : String(e);
  } finally {
    requesting.value = false;
  }
}
async function next() {
  if (!loaded.value || busy.value || over.value) return;
  requesting.value = true;
  failure.value = "";
  try {
    await api(`/campaigns/${loaded.value.campaign.id}/step`, {
      turn: loaded.value.campaign.turns.length,
    });
    await load(loaded.value.campaign.id);
  } catch (e) {
    failure.value = e instanceof Error ? e.message : String(e);
    autoAdvance.value = false;
  } finally {
    requesting.value = false;
  }
}
function select(id: FactionId | null) {
  selected.value = id;
  unitId.value = null;
}
function seek(value: number) {
  playing.value = false;
  autoAdvance.value = false;
  index.value = value;
}
onMounted(async () => {
  try {
    await list();
    const id =
      new URLSearchParams(location.search).get("campaign") ??
      catalogue.value.at(-1)?.id;
    if (id) await load(id);
    else setup.value = true;
  } catch (e) {
    failure.value = e instanceof Error ? e.message : String(e);
    setup.value = true;
  }
  polling = setInterval(async () => {
    if (!loaded.value || requesting.value) return;
    try {
      if (loaded.value.busy) await load(loaded.value.campaign.id, latest.value);
      else if (autoAdvance.value && latest.value && !over.value) await next();
    } catch {
      failure.value = "Connexion au service perdue";
      autoAdvance.value = false;
    }
  }, 1500);
  let elapsed = 0;
  playTimer = setInterval(() => {
    if (!playing.value) return;
    elapsed += 0.1 * speed.value;
    if (elapsed >= 1) {
      elapsed = 0;
      if (!latest.value) index.value++;
      else playing.value = false;
    }
  }, 100);
});
onUnmounted(() => {
  clearInterval(polling);
  clearInterval(playTimer);
});
</script>

<template>
  <main
    class="observatory"
    :class="{ 'is-configuring': setup, 'hud-hidden': !hud }"
  >
    <header class="observatory-head">
      <a class="observatory-brand" href="/" aria-label="Aevum, accueil"
        ><span class="brand-bracket">[</span>Aevum<span class="brand-bracket"
          >]</span
        ></a
      >
      <div class="session-title">
        <span class="signal" :class="{ thinking: busy }"></span
        >{{
          loaded
            ? `Monde ${loaded.campaign.seed}`
            : "Observatoire des civilisations"
        }}<small>{{
          loaded?.campaign.mode === "remote"
            ? "Dirigeants IA distants"
            : "Gouvernance locale · sans appel IA"
        }}</small>
      </div>
      <nav aria-label="Interface du monde">
        <button
          :aria-pressed="followEvents"
          @click="followEvents = !followEvents"
        >
          {{ followEvents ? "Caméra suivie" : "Caméra libre" }}
        </button>
        <button
          v-if="hud"
          :aria-expanded="rosterOpen"
          aria-controls="civilization-roster"
          @click="
            rosterOpen = !rosterOpen;
            journalOpen = false;
          "
        >
          Civilisations
        </button>
        <button
          v-if="hud"
          :aria-expanded="journalOpen"
          aria-controls="council-journal"
          @click="
            journalOpen = !journalOpen;
            rosterOpen = false;
          "
        >
          Journal
        </button>
        <button :aria-pressed="!hud" @click="hud = !hud">
          {{ hud ? "Masquer l’interface" : "Afficher l’interface" }}
        </button>
        <a href="/?archive=1&world=worlds%2Fcivilization-w10%2Fera-0001.json"
          >Les archives ↗</a
        ><button :aria-expanded="setup" @click="setup = !setup">
          {{ setup ? "Fermer" : "Nouveau monde"
          }}<span aria-hidden="true">{{ setup ? "−" : "+" }}</span>
        </button>
      </nav>
    </header>
    <div v-if="failure" class="notice error" role="alert">
      {{ failure }}<button @click="failure = ''">Fermer</button>
    </div>
    <section
      v-if="setup"
      class="setup-panel"
      aria-label="Configuration de la simulation"
    >
      <div class="setup-intro">
        <span>Une expérience de civilisation autonome</span>
        <h1>Le pouvoir change.<br />L’histoire reste.</h1>
        <p>
          Quatre dirigeants. Des ambitions divergentes. Aucune intervention
          humaine. Lancez le monde, puis observez ce qu’ils en font.
        </p>
      </div>
      <label
        >Graine du monde<input
          v-model.number="seed"
          type="number"
          min="0"
          max="2147483647"
      /></label>
      <label
        >Gouvernance<select v-model="mode">
          <option value="local">Locale — déterministe, gratuite</option>
          <option value="remote">Modèles IA — clés côté serveur</option>
        </select></label
      >
      <div v-if="mode === 'remote'" class="models">
        <p>
          Fournisseurs configurés :
          {{
            providers
              .filter((p) => p.configured)
              .map((p) => p.id)
              .join(", ") || "aucun"
          }}. Renseignez un identifiant par dirigeant. Les modèles Nous sont
          acceptés seulement si le catalogue confirme un tarif nul.
        </p>
        <label v-for="id in ids" :key="id"
          >{{ names[id]
          }}<input
            v-model="models[id]"
            placeholder="fournisseur:identifiant du modèle"
            autocomplete="off" /></label
        ><small
          >Les clés se configurent dans .env : OPENROUTER_API_KEY, GROQ_API_KEY
          ou NOUS_API_KEY. Aucune clé dans cette page.</small
        >
      </div>
      <button
        class="primary"
        :disabled="
          busy || !Number.isInteger(seed) || seed < 0 || seed > 2147483647
        "
        @click="create"
      >
        Créer le monde
      </button>
      <label v-if="catalogue.length"
        >Reprendre une partie<select
          @change="
            load(($event.target as HTMLSelectElement).value)
              .then(() => (setup = false))
              .catch((e) => (failure = e.message))
          "
        >
          <option value="" disabled selected>Choisir une sauvegarde</option>
          <option v-for="c in catalogue" :key="c.id" :value="c.id">
            Monde {{ c.seed }} · tour {{ c.turn }} · {{ c.mode }}
          </option>
        </select></label
      >
    </section>
    <div
      class="ruler-dock"
      v-if="hud && !setup && !rosterOpen"
      aria-label="Dirigeants"
    >
      <button
        v-for="c in world.civs"
        :key="c.id"
        :style="{ '--civ': CIV_COLORS[c.id] }"
        :class="{ chosen: selected === c.id }"
        @click="
          select(c.id);
          rosterOpen = true;
          journalOpen = false;
        "
      >
        <span class="ruler-dot" aria-hidden="true"></span
        ><span
          ><strong>{{ names[c.id] }}</strong
          ><small>{{ rulerStatus(c.id) }}</small></span
        >
      </button>
    </div>
    <div class="observatory-grid">
      <aside id="civilization-roster" class="civilizations" v-show="rosterOpen">
        <h2>
          Civilisations
          <button
            class="panel-close"
            aria-label="Fermer les civilisations"
            @click="rosterOpen = false"
          >
            ×
          </button>
        </h2>
        <button
          v-for="c in world.civs"
          :key="c.id"
          class="civ-row"
          :class="{ chosen: selected === c.id, fallen: c.fellOnTick !== null }"
          :style="{ '--civ': CIV_COLORS[c.id] }"
          @click="select(c.id)"
        >
          <svg class="civ-emblem" viewBox="0 0 40 48" aria-hidden="true">
            <path
              d="M3 3h34v25L20 45 3 28Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              v-if="c.id === 'amber'"
              d="M20 10 29 22 20 34 11 22Z M11 22h18M20 10v24"
            />
            <path
              v-else-if="c.id === 'azure'"
              d="m20 10 3 9 10 3-10 3-3 10-3-10-10-3 10-3Z"
            />
            <path
              v-else-if="c.id === 'crimson'"
              d="M15 31V18l5-8 5 8v13M10 31h20M10 25h20M20 10v27"
            />
            <path
              v-else
              d="M20 35V11M20 20l-8-6M20 26l9-7M20 31l-9-6M20 16l6-5"
            /></svg
          ><span
            ><strong>{{ names[c.id] }}</strong
            ><small>{{
              c.fellOnTick === null
                ? `${c.population} habitants · ${c.territory} terres`
                : "Civilisation éteinte"
            }}</small
            ><small class="ruler-status">{{ rulerStatus(c.id) }}</small></span
          ><span>{{ c.soldiers }}<small>soldats</small></span>
        </button>
        <template v-if="civ"
          ><div class="ruler-objective">
            <h3>Intention du dirigeant</h3>
            <p>
              {{
                state.objectives[civ.id] ||
                "Le premier conseil n’a pas encore eu lieu."
              }}
            </p>
            <small>{{
              answers.find((a) => a.civ === civ!.id)?.model ||
              "Aucune décision enregistrée"
            }}</small>
          </div>
          <section
            v-if="strategicPlan"
            class="strategic-plan"
            aria-label="Plan stratégique du dirigeant"
          >
            <div class="plan-heading">
              <h3>Projet de civilisation</h3>
              <span :class="['plan-status', strategicPlan.status]">{{
                planStatuses[strategicPlan.status]
              }}</span>
            </div>
            <strong>{{ planLabels[strategicPlan.kind] }}</strong>
            <p class="plan-target">{{ planTarget }}</p>
            <p class="plan-rationale">{{ strategicPlan.rationale }}</p>
            <label class="plan-progress"
              >Avancement constaté
              <span>{{ Math.round(strategicPlan.progress * 100) }} %</span
              ><progress
                :value="strategicPlan.progress"
                :max="1"
                aria-label="Avancement constaté du plan"
            /></label>
            <p class="plan-evidence">{{ strategicPlan.detail }}</p>
            <small
              v-if="
                strategicPlan.stagnation > 0 &&
                strategicPlan.status !== 'completed' &&
                strategicPlan.status !== 'cancelled'
              "
              >Aucun progrès depuis {{ strategicPlan.stagnation }}
              {{ strategicPlan.stagnation > 1 ? "tours" : "tour" }}.</small
            >
            <small class="plan-dates"
              >Lancé au tour {{ strategicPlan.startedAt }} · vérifié au tour
              {{ strategicPlan.updatedAt }}</small
            >
          </section>
          <p v-else-if="state.rules === 'spectator-3'" class="plan-empty">
            Aucun projet stratégique engagé à ce tour.
          </p>
          <dl class="reserves">
            <div>
              <dt>Vivres</dt>
              <dd>{{ Math.floor(civ.stock.food) }}</dd>
            </div>
            <div>
              <dt>Bois</dt>
              <dd>{{ Math.floor(civ.stock.timber) }}</dd>
            </div>
            <div>
              <dt>Minerai</dt>
              <dd>{{ Math.floor(civ.stock.ore) }}</dd>
            </div>
            <div>
              <dt>Trésor</dt>
              <dd>{{ Math.floor(civ.stock.wealth) }}</dd>
            </div>
          </dl>
          <h3>Villes et recherche</h3>
          <p class="research">
            {{ civ.advances.length }} découvertes ·
            {{ Math.floor(civ.science ?? 0) }} points<br />{{
              technologies[state.research[civ.id] ?? ""] ||
              "Aucun projet de recherche"
            }}
          </p>
          <div
            v-for="city in world.simulation!.cities.filter(
              (c) => c.owner === selected,
            )"
            :key="city.id"
            class="city-row"
          >
            <strong>{{ world.board[city.position]!.name }}</strong
            ><small>{{
              city.buildings.map((b) => buildings[b]).join(", ") ||
              "Nouvelle implantation"
            }}</small
            ><span v-if="city.queue"
              >{{ buildings[city.queue.building] }} ·
              {{ city.queue.remaining }} tours</span
            >
            <div
              v-for="ledger in (state.economy ?? []).filter(
                (l) => l.city === city.id,
              )"
              :key="ledger.city"
              class="city-production"
            >
              <small
                >{{ ledger.population }} habitants ·
                {{ ledger.workedTiles.length }} sites avec une équipe</small
              >
              <small
                >Production de base :
                {{ Math.round(ledger.production.food) }} vivres ·
                {{ Math.round(ledger.production.timber) }} bois ·
                {{ Math.round(ledger.production.ore) }} minerai ·
                {{ Math.round(ledger.production.wealth) }} richesse</small
              >
              <small v-for="delivery in ledger.deliveries" :key="delivery.unit"
                >Caravane arrivée : +{{ delivery.value }} richesse</small
              >
            </div>
          </div>
          <p v-if="state.rules !== 'spectator-1'" class="panel-help">
            Production du dernier tour avant météo et consommation. Les réserves
            restent partagées entre les villes.
          </p></template
        >
      </aside>
      <section class="world-viewport" aria-label="Monde observé">
        <div class="world-caption">
          <div>
            <span>{{
              loaded ? "Le théâtre du monde" : "Le monde attend ses dirigeants"
            }}</span>
            <h1>
              <small>Tour</small>{{ world.tick.toString().padStart(3, "0") }}
            </h1>
          </div>
          <span class="world-count"
            >{{
              world.civs.filter((c) => c.fellOnTick === null).length
            }}
            civilisations<br />{{
              world.simulation!.cities.length
            }}
            villes<br /><span v-if="!loaded">Aperçu initial</span></span
          >
        </div>
        <WorldDiorama
          :focus-tile="cameraEvent?.tile ?? null"
          :focus-event-key="cameraEvent?.key"
          immersive
          :year="year"
          :parcels="parcels"
          :selected="selected"
          :route="route"
          :missions="state.missions"
          :selected-unit="unitId"
          :orders-visible="hud"
          @select-unit="selectUnit"
          @select="select"
        />
        <div v-if="incident" class="world-bulletin" role="status">
          <strong>{{ incident.title }}</strong
          ><span>{{ incident.description }}</span
          ><small
            >Annonce commune · tours {{ incident.start }} à
            {{ incident.end }}</small
          >
        </div>
        <div v-else class="world-bulletin quiet">
          <strong>{{
            over ? "Fin de cette ère" : "Le monde suit son cours"
          }}</strong
          ><span>{{
            over
              ? "Une seule civilisation demeure. La chronique reste consultable."
              : "Aucun événement mondial actif à ce tour."
          }}</span>
        </div>
        <div v-if="mission" class="route-caption">
          <strong
            >{{ actions[mission.action] }} ·
            {{ statuses[mission.status] }}</strong
          ><span>{{ mission.reason }}</span
          ><small
            >Itinéraire prévu en pointillés · destination
            {{ mission.target }}</small
          >
        </div>
      </section>
      <aside id="council-journal" class="council-panel" v-show="journalOpen">
        <button
          class="panel-close"
          aria-label="Fermer le journal"
          @click="journalOpen = false"
        >
          ×
        </button>
        <div class="panel-tabs">
          <button
            :class="{ active: panel === 'orders' }"
            @click="panel = 'orders'"
          >
            Ordres</button
          ><button
            :class="{ active: panel === 'events' }"
            @click="panel = 'events'"
          >
            Événements</button
          ><button
            :class="{ active: panel === 'diplomacy' }"
            @click="panel = 'diplomacy'"
          >
            Relations
          </button>
        </div>
        <template v-if="panel === 'orders'"
          ><h2>{{ selected ? names[selected] : "Toutes les unités" }}</h2>
          <p class="panel-help">
            Sélectionnez une unité pour afficher sa mission sur la carte.
          </p>
          <button
            v-for="u in units"
            :key="u.id"
            class="unit-row"
            :class="{ chosen: unitId === u.id }"
            @click="unitId = u.id"
          >
            <span
              ><strong
                >{{ roles[u.role] }}
                <small>{{
                  u.role === "soldier" ? u.strength : ""
                }}</small></strong
              ><small>{{ u.id }} · case {{ u.position }}</small></span
            ><span
              >{{
                actions[
                  state.missions.find((m) => m.unit === u.id)?.action ?? ""
                ] || "En attente"
              }}<small>{{
                statuses[
                  state.missions.find((m) => m.unit === u.id)?.status ?? ""
                ] || "Sans ordre"
              }}</small></span
            >
          </button>
          <div v-if="mission" class="mission-detail">
            <h3>{{ actions[mission.action] }}</h3>
            <p>{{ mission.reason }}</p>
            <p>{{ missionText(mission.detail) }}</p>
            <small
              >Émis au tour {{ mission.issuedAt }} · cible {{ mission.target
              }}<br />Trajet :
              {{
                mission.route.join(" → ") || "aucun chemin disponible"
              }}</small
            >
          </div>
          <p v-if="!units.length" class="panel-help">
            Aucune unité disponible.
          </p></template
        >
        <template v-else-if="panel === 'events'"
          ><h2>Ce tour a changé le monde</h2>
          <p v-if="!outcome" class="panel-help">
            Avancez d’un tour pour observer les premières conséquences.
          </p>
          <article
            v-for="(e, i) in outcome?.events.filter((e) => e.kind !== 'GREW')"
            :key="i"
            class="event-row"
          >
            <small
              >{{ names[e.civ] }} · {{ eventNames[e.kind] ?? e.kind }}</small
            >
            <p>{{ e.detail }}</p>
          </article>
          <article
            v-for="delivery in deliveries"
            :key="'delivery-' + delivery.unit"
            class="event-row"
          >
            <small>Livraison commerciale</small>
            <p>
              {{ cityName(delivery.from) }} → {{ cityName(delivery.to) }} : +{{
                delivery.value
              }}
              richesse.
            </p>
          </article>
          <article
            v-for="(e, i) in outcome?.rejected"
            :key="`r${i}`"
            class="event-row rejected"
          >
            <small>Ordre refusé · {{ e.civ }}</small>
            <p>{{ missionText(e.detail) }}</p>
          </article>
          <article
            v-for="a in answers.filter((a) => a.review)"
            :key="`review-${a.civ}`"
            class="event-row"
          >
            <small>{{ names[a.civ] }} · Révision des ordres</small>
            <p>
              {{
                a.review?.corrected
                  ? "Le dirigeant a corrigé sa proposition avant la résolution."
                  : "Une correction a été demandée ; les règles du moteur restent appliquées aux ordres retenus."
              }}
            </p>
            <details>
              <summary>Motifs de la révision</summary>
              <p v-if="a.review?.secondError">
                Correction indisponible : {{ a.review.secondError }}
              </p>
              <p v-for="(issue, i) in a.review?.issues" :key="i">{{ issue }}</p>
            </details>
          </article>
          <article
            v-for="a in answers.filter((a) => a.error)"
            :key="a.civ"
            class="event-row rejected"
          >
            <small>{{ names[a.civ] }} · IA indisponible</small>
            <p>{{ a.error }}. Les missions existantes continuent.</p>
          </article></template
        >
        <template v-else
          ><h2>Les équilibres du monde</h2>
          <article
            v-for="r in world.simulation!.relations"
            :key="`${r.a}-${r.b}`"
            class="relation-row"
          >
            <strong>{{ names[r.a] }} / {{ names[r.b] }}</strong
            ><span :class="r.status">{{
              r.status === "war"
                ? "En guerre"
                : r.status === "trade"
                  ? "Accord commercial"
                  : "En paix"
            }}</span
            ><small v-if="r.truceUntil > world.tick"
              >Trêve jusqu’au tour {{ r.truceUntil }}</small
            >
          </article>
          <p class="panel-help">
            Les accords commerciaux et les paix nécessitent deux propositions
            concordantes. Une déclaration de guerre reste unilatérale, hors
            trêve.
          </p></template
        >
      </aside>
    </div>
    <footer class="turn-controls">
      <div class="playback">
        <button
          :disabled="!loaded || index === 0"
          @click="seek(Math.max(0, index - 1))"
          aria-label="Tour précédent"
        >
          ←</button
        ><button
          :disabled="!loaded || latest"
          @click="
            playing = !playing;
            autoAdvance = false;
          "
        >
          {{ playing ? "Pause" : "Lire l’histoire" }}</button
        ><select v-model.number="speed" aria-label="Vitesse de lecture">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="4">4×</option>
        </select>
      </div>
      <label class="scrubber"
        >Tour {{ index }} / {{ (loaded?.history.length ?? 1) - 1
        }}<input
          type="range"
          min="0"
          :max="(loaded?.history.length ?? 1) - 1"
          :value="index"
          @input="seek(Number(($event.target as HTMLInputElement).value))"
      /></label>
      <div class="live-controls">
        <span v-if="busy" role="status"
          >Conseil en cours…
          {{ loaded?.campaign.pending?.answers.length ?? 0 }}/{{
            world.civs.filter((c) => c.fellOnTick === null).length
          }}</span
        ><button
          v-if="!latest"
          @click="seek((loaded?.history.length ?? 1) - 1)"
        >
          Revenir au présent</button
        ><template v-else
          ><label
            ><input
              v-model="autoAdvance"
              type="checkbox"
              :disabled="!loaded || over"
            />
            Tours automatiques</label
          ><button
            class="primary"
            :disabled="!loaded || busy || over"
            @click="next"
          >
            {{ busy ? "Décisions en cours…" : "Résoudre le tour suivant" }}
          </button></template
        ><a
          v-if="loaded"
          :href="`/api/campaigns/${loaded.campaign.id}/export`"
          download="aevum-campaign.json"
          >Exporter</a
        >
      </div>
    </footer>
  </main>
</template>

<style src="./spectator.css"></style>
