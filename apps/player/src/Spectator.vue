<script setup lang="ts">
import { AGE_NAMES, ageProgress } from "../../../packages/world/src/ages";
import {
  MODERNIZATION,
  modernizationIssue,
  type ModernizationProject,
} from "../../../packages/world/src/modernization";
import { militaryProfile } from "../../../packages/world/src/military";
import { latestClimateReport } from "../../../packages/world/src/climate-report";
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { FactionId } from "@abs/contracts";
import type { Year } from "@abs/world";
import WorldDiorama from "./components/WorldDiorama.vue";
import InfrastructurePanel from "./components/InfrastructurePanel.vue";
import { projectWorld, CIV_COLORS } from "./three/world-projection";
import {
  incidentFor,
  forecastFor,
  newSpectator,
  MOVEMENT_BUDGET,
  type SpectatorState,
  type resolveCouncil,
} from "../../../packages/world/src/spectator";
import type { Campaign } from "../../../packages/world/src/campaign";
import { campaignSummary } from "../../../packages/world/src/campaign-summary";

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
const maxTurns = ref(40),
  momentsOnly = ref(false),
  resultOpen = ref(true);
const scenarios = [
  {
    seed: 42,
    turns: 40,
    title: "Premiers pas",
    detail: "40 manches pour découvrir les décisions et leurs conséquences.",
  },
  {
    seed: 7,
    turns: 80,
    title: "Une histoire se construit",
    detail: "80 manches pour suivre les villes et les projets des dirigeants.",
  },
  {
    seed: 123,
    turns: 120,
    title: "Une longue chronique",
    detail:
      "120 manches pour observer les trajectoires de quatre civilisations.",
  },
  {
    seed: 42,
    turns: 300,
    title: "À travers les âges",
    detail: "300 manches pour suivre le développement jusqu'aux âges avancés, selon les choix des dirigeants.",
  },
];
const lastCampaignKey = "aevum:last-campaign";
function rememberedCampaign() {
  try {
    return localStorage.getItem(lastCampaignKey);
  } catch {
    return null;
  }
}
function chooseScenario(scenario: (typeof scenarios)[number]) {
  seed.value = scenario.seed;
  maxTurns.value = scenario.turns;
}

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
  if (sequential.value) {
    if (summary.value?.finished && latest.value) return "Chronique terminée";
    if (activeRuler.value === id)
      return busy.value && latest.value ? "Se prépare" : "À son tour";
    return "À suivre";
  }
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
const preview = newSpectator(42, "spectator-9");
const state = computed(() => loaded.value?.history[index.value] ?? preview);
const world = computed(() => state.value.world);
const sequential = computed(() =>
  ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.value.rules),
);
const activeRuler = computed(() => state.value.sequence?.activeCiv ?? null);
const activeRulerName = computed(() =>
  activeRuler.value ? names[activeRuler.value] : "dirigeant",
);
const lastRuler = computed(() =>
  sequential.value ? answers.value[0]?.civ : undefined,
);
const displayRound = computed(() =>
  sequential.value && latest.value && campaignFinished.value
    ? (summary.value?.turns ?? world.value.tick)
    : (state.value.sequence?.round ?? world.value.tick),
);
const movementBudget = (role: string) =>
  MOVEMENT_BUDGET[role as keyof typeof MOVEMENT_BUDGET];
const deliveries = computed(() =>
  (state.value.economy ?? [])
    .filter(
      (ledger) =>
        !sequential.value ||
        world.value.simulation!.cities.some(
          (city) => city.id === ledger.city && city.owner === lastRuler.value,
        ),
    )
    .flatMap((ledger) => ledger.deliveries),
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
const parcels = computed(() => {
  const result = projectWorld(
    year.value,
    [year.value],
    state.value.ages
      ? Object.fromEntries(
          Object.entries(state.value.ages).map(([id, age]) => [
            id,
            age.current,
          ]),
        )
      : undefined,
    state.value.infrastructure?.sites,
  );
  if (sequential.value)
    for (const parcel of result)
      for (const asset of parcel.assets)
        if (asset.unitId)
          asset.movementPath = state.value.movement?.find(
            (trace) => trace.unit === asset.unitId,
          )?.path;
  return result;
});
const civ = computed(() =>
  world.value.civs.find((c) => c.id === selected.value),
);
const modernization = computed(() =>
  civ.value ? state.value.modernization?.[civ.value.id] : undefined,
);
const infrastructureForSelected = computed(() =>
  civ.value && ["spectator-9"].includes(state.value.rules)
    ? state.value.infrastructure ?? null
    : null,
);
const modernizationSuspended = computed(
  () =>
    !!modernization.value?.active &&
    !world.value.simulation!.cities.some(
      (city) =>
        city.owner === civ.value?.id && city.buildings.includes("academy"),
    ),
);
const military = computed(() =>
  ["spectator-7", "spectator-8", "spectator-9"].includes(state.value.rules) &&
  civ.value &&
  state.value.ages?.[civ.value.id] &&
  state.value.modernization?.[civ.value.id]
    ? militaryProfile(
        state.value.ages[civ.value.id]!.current,
        civ.value.advances,
        state.value.modernization[civ.value.id]!.completed,
      )
    : null,
);
const modernizationOptions = computed(() => {
  const owner = civ.value;
  const development = modernization.value;
  const age = owner ? state.value.ages?.[owner.id]?.current : undefined;
  if (!owner || !development || !age) return [];
  return (Object.keys(MODERNIZATION) as ModernizationProject[])
    .filter(
      (project) =>
        !development.completed.includes(project) &&
        development.active?.project !== project,
    )
    .map((project) => ({
      project,
      ...MODERNIZATION[project],
      issue: modernizationIssue(
        world.value,
        owner.id,
        age,
        development,
        project,
      ),
      costLabel: Object.entries(MODERNIZATION[project].cost)
        .map(
          ([resource, amount]) =>
            `${amount} ${{ food: "vivres", timber: "bois", ore: "minerai", wealth: "richesses" }[resource] ?? resource}`,
        )
        .join(" · "),
    }));
});
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
  incidentFor(
    world.value.seed,
    sequential.value
      ? (state.value.sequence?.round ?? 1) - 1
      : world.value.tick,
  ),
);
const outcome = computed(() => loaded.value?.outcomes[index.value - 1]);
const forecast = computed(() =>
  ["spectator-8", "spectator-9"].includes(state.value.rules) &&
  state.value.sequence
    ? forecastFor(world.value.seed, state.value.sequence.round - 1)
    : null,
);
const climateReport = computed(() =>
  latestClimateReport(loaded.value?.history.slice(0, index.value + 1) ?? []),
);
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
const campaignFinished = computed(() => summary.value?.reason === "turn-limit");
const over = computed(() => summary.value?.finished ?? false);
const summary = computed(() =>
  loaded.value
    ? campaignSummary(
        loaded.value.campaign,
        loaded.value.state,
        loaded.value.outcomes,
      )
    : null,
);
const scoreboard = computed(() => summary.value?.standings ?? []);
const importantTurns = computed(() =>
  (loaded.value?.outcomes ?? []).flatMap((turn, i) =>
    turn.state.ageTransitions?.length ||
    turn.events.some((event) =>
      ["FOUNDED", "ROUTED", "ADVANCE", "STARVED"].includes(event.kind),
    )
      ? [i + 1]
      : [],
  ),
);
const nextMoment = computed(() =>
  importantTurns.value.find((turn) => turn > index.value),
);
function playHistory() {
  autoAdvance.value = false;
  if (!playing.value && latest.value)
    index.value = momentsOnly.value ? (importantTurns.value[0] ?? 0) : 0;
  playing.value = !playing.value;
}
async function discover() {
  requesting.value = true;
  failure.value = "";
  playing.value = autoAdvance.value = false;
  try {
    const { id } = await api<{ id: string }>("/demo", {});
    await load(id);
    setup.value = false;
    resultOpen.value = false;
    index.value = 0;
    playing.value = true;
    await list();
  } catch (e) {
    failure.value = e instanceof Error ? e.message : String(e);
  } finally {
    requesting.value = false;
  }
}
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
    defaultModels?: Record<string, string>;
  }>("/campaigns");
  const firstConfiguration = providers.value.length === 0;
  catalogue.value = data.campaigns;
  providers.value = data.providers;
  for (const id of ids) {
    if (!models.value[id]?.trim() && data.defaultModels?.[id])
      models.value[id] = data.defaultModels[id];
  }
  if (
    firstConfiguration &&
    data.providers.some(
      (provider) => provider.id === "nous" && provider.configured,
    )
  )
    mode.value = "remote";
}
async function load(id: string, follow = true) {
  const value = await api<Loaded>(`/campaigns/${id}`);
  loaded.value = value;
  try {
    localStorage.setItem(lastCampaignKey, id);
  } catch {
    /* Private browsing may disable storage. */
  }
  if (campaignSummary(value.campaign, value.state, value.outcomes).finished)
    autoAdvance.value = false;
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
      maxTurns: maxTurns.value,
    });
    await load(id);
    resultOpen.value = true;
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
      catalogue.value.find((c) => c.id === rememberedCampaign())?.id;
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
      if (momentsOnly.value) {
        if (nextMoment.value !== undefined) index.value = nextMoment.value;
        else {
          playing.value = false;
          if (campaignFinished.value) {
            index.value = loaded.value!.history.length - 1;
            resultOpen.value = true;
          }
        }
      } else if (!latest.value) index.value++;
      else {
        playing.value = false;
        if (over.value) resultOpen.value = true;
      }
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
        <span class="signal" :class="{ thinking: busy }"></span>
        {{
          loaded
            ? `Monde ${loaded.campaign.seed}`
            : "Observatoire des civilisations"
        }}<small>{{
          loaded?.campaign.id === "nous-discovery"
            ? "Replay Nous · aucun appel en direct"
            : loaded?.campaign.mode === "remote"
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
        <button
          class="discover-button primary"
          :disabled="busy"
          @click="discover"
        >
          {{ requesting ? "Préparation…" : "Découvrir Aevum" }}
        </button>
        <p class="discover-help">
          Une chronique de 50 tours déjà jouée par les modèles Nous. Regardez
          les décisions enregistrées sans configurer de clé, sélectionnez une
          civilisation, puis suivez ses projets.
        </p>
        <span>Une expérience de civilisation autonome</span>
        <h1>Le pouvoir change.<br />L’histoire reste.</h1>
        <p>
          Quatre dirigeants. Des ambitions divergentes. Aucune intervention
          humaine. Lancez le monde, puis observez ce qu’ils en font.
        </p>
      </div>
      <div class="scenario-choices" aria-label="Choisir une durée de partie">
        <button
          v-for="scenario in scenarios"
          :key="scenario.turns"
          :aria-pressed="seed === scenario.seed && maxTurns === scenario.turns"
          @click="chooseScenario(scenario)"
        >
          <strong>{{ scenario.title }}</strong
          ><span>{{ scenario.detail }}</span>
        </button>
      </div>
      <label
        >Durée de la chronique<select v-model.number="maxTurns">
          <option :value="40">40 manches</option>
          <option :value="80">80 manches</option>
          <option :value="120">120 manches</option>
          <option :value="300">300 manches · À travers les âges</option>
        </select></label
      >
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
          >Plusieurs dirigeants peuvent partager le même modèle. Les clés se
          configurent dans .env : OPENROUTER_API_KEY, GROQ_API_KEY ou
          NOUS_API_KEY. Aucune clé dans cette page.</small
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
            ><small v-if="state.ages?.[c.id]">{{
              AGE_NAMES[state.ages[c.id]!.current]
            }}</small
            ><small class="ruler-status">{{ rulerStatus(c.id) }}</small></span
          ><span>{{ c.soldiers }}<small>soldats</small></span>
        </button>
        <template v-if="civ"
          ><div class="ruler-objective">
            <section
              v-if="state.ages?.[civ.id]"
              aria-label="Progression de civilisation"
            >
              <h3>{{ AGE_NAMES[state.ages[civ.id]!.current] }}</h3>
              <p
                v-if="
                  !ageProgress(
                    state.world,
                    civ.id,
                    state.ages[civ.id]!.current,
                    state.modernization?.[civ.id]?.completed,
                  ).next
                "
              >
                Dernier âge disponible dans cette version.
              </p>
              <ul>
                <li
                  v-for="requirement in ageProgress(
                    state.world,
                    civ.id,
                    state.ages[civ.id]!.current,
                    state.modernization?.[civ.id]?.completed,
                  ).requirements"
                  :key="requirement.label"
                >
                  {{ requirement.met ? "Acquis" : "À développer" }} —
                  {{ requirement.label }} :
                  {{ Math.floor(requirement.current) }} /
                  {{ requirement.required }}
                </li>
              </ul>
              <details>
                <summary>Histoire des âges</summary>
                <ol>
                  <li
                    v-for="entry in state.ages[civ.id]!.history"
                    :key="entry.age"
                  >
                    {{ AGE_NAMES[entry.age] }} ·
                    {{ sequential ? "action" : "tour" }} {{ entry.turn }}
                  </li>
                </ol>
              </details>
            </section>
            <section
              v-if="military"
              aria-label="Capacités militaires"
            >
              <h3>Capacités militaires</h3>
              <p>
                Puissance {{ military.power }} · Défense
                {{ military.resilience }}
              </p>
              <small>
                Multiplieurs issus de l'âge et des technologies de la
                civilisation.
              </small>
            </section>
            <section
              v-if="modernization"
              aria-label="Modernisation de la civilisation"
            >
              <h3>Modernisation</h3>
              <template v-if="modernization.active">
                <p>
                  <strong>{{
                    MODERNIZATION[modernization.active.project].name
                  }}</strong>
                  · {{ modernization.active.remaining }} tours personnels
                  restants
                </p>
                <progress
                  :value="
                    MODERNIZATION[modernization.active.project].turns -
                    modernization.active.remaining
                  "
                  :max="MODERNIZATION[modernization.active.project].turns"
                  aria-label="Avancement du programme de modernisation"
                />
                <p v-if="modernizationSuspended">
                  Suspendu : aucune académie ne subsiste. Le programme reprendra
                  lorsqu'une académie sera disponible.
                </p>
                <small
                  >{{ MODERNIZATION[modernization.active.project].effect }} à
                  l'achèvement.</small
                >
              </template>
              <p v-else>
                Aucun programme en cours. Le dirigeant choisit ses
                investissements à son tour.
              </p>
              <ul v-if="modernization.completed.length">
                <li v-for="project in modernization.completed" :key="project">
                  <strong>{{ MODERNIZATION[project].name }} — achevé</strong
                  ><br />{{ MODERNIZATION[project].effect }}
                </li>
              </ul>
              <details v-if="modernizationOptions.length">
                <summary>
                  Programmes et conditions ({{ modernizationOptions.length }})
                </summary>
                <p>
                  Académie et érudition requises. Les réserves et la science
                  sont consommées au lancement.
                </p>
                <ul>
                  <li
                    v-for="program in modernizationOptions"
                    :key="program.project"
                  >
                    <strong>{{ program.name }}</strong> ·
                    {{
                      program.issue ??
                      "Disponible pour le prochain choix du dirigeant"
                    }}<br />
                    <small
                      >{{ AGE_NAMES[program.age] }} · {{ program.turns }} tours
                      personnels · {{ program.science }} science ·
                      {{ program.costLabel }}</small
                    ><br />
                    <small v-if="program.requires.length"
                      >Préalables :
                      {{
                        program.requires
                          .map((project) => MODERNIZATION[project].name)
                          .join(", ")
                      }}.<br
                    /></small>
                    <small>{{ program.effect }}</small>
                  </li>
                </ul>
              </details>
            </section>
            <InfrastructurePanel
              v-if="infrastructureForSelected"
              :civ-id="civ.id"
              :world="world"
              :infrastructure="infrastructureForSelected"
            />
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
          <p
            v-else-if="state.rules === 'spectator-3' || sequential"
            class="plan-empty"
          >
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
              <small>{{ sequential ? "Manche" : "Tour" }}</small
              >{{ displayRound.toString().padStart(3, "0") }}
            </h1>
          </div>
          <div v-if="sequential" class="sequence-status">
            <strong>{{
              over && latest
                ? "Chronique terminée"
                : `Au tour de ${activeRulerName}`
            }}</strong>
            <small v-if="lastRuler"
              >{{ names[lastRuler] }} vient de jouer · action
              {{ world.tick }}</small
            >
            <small v-else>Chaque civilisation joue successivement.</small>
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
            >Annonce commune · {{ sequential ? "manches" : "tours" }}
            {{ incident.start + (sequential ? 1 : 0) }} à
            {{ incident.end + (sequential ? 1 : 0) }}</small
          >
        </div>
        <div v-else-if="forecast && !over" class="world-bulletin forecast" role="status">
          <strong>{{ forecast.title }} annoncée</strong>
          <span>Dans {{ forecast.start + 1 - state.sequence!.round }} manche(s) · {{ forecast.description }}</span>
          <small>Préparation des réserves · manches {{ forecast.start + 1 }} à {{ forecast.end + 1 }}</small>
        </div>
        <div v-else class="world-bulletin quiet">
          <strong>{{
            over ? "Fin de cette ère" : "Le monde suit son cours"
          }}</strong
          ><span>{{
            campaignFinished
              ? "La durée prévue est atteinte. Retrouvez les moments importants et le bilan."
              : over
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
          <p v-if="sequential" class="movement-help">
            Par tour : civils 2 points, armées 3, marchands 4. Une case coûte 1
            point ; forêt, colline et rivière coûtent 2 points.
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
              ><small>{{ u.id }} · case {{ u.position }}</small>
              <small
                v-if="sequential"
                class="movement-budget"
                title="Points par tour du dirigeant : plaine 1 point ; forêt, colline et rivière 2 points. Le déplacement s’arrête quand le budget ne permet plus d’entrer dans la case suivante."
                >{{ movementBudget(u.role) }} points de mouvement / tour</small
              ></span
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
          <details v-if="climateReport" class="climate-report" open>
            <summary>{{ climateReport.event.title }} · bilan observé</summary>
            <p class="panel-help">Manches {{ climateReport.event.start + 1 }}–{{ climateReport.event.end + 1 }}. Les variations incluent aussi consommation, commerce, guerre et recrutement.</p>
            <article v-for="row in climateReport.civilizations" :key="row.civ" class="event-row">
              <strong>{{ names[row.civ] }}</strong>
              <p>{{ row.foodPerPerson }} vivres / habitant au départ · {{ row.protected ? "irrigation ou grenier présent" : "sans protection agricole" }}</p>
              <small>Réserves {{ Math.round(row.foodBefore) }} → {{ Math.round(row.foodAfter) }} · Population {{ row.populationChange > 0 ? "+" : "" }}{{ row.populationChange }}{{ row.survived ? "" : " · civilisation disparue" }}</small>
            </article>
          </details>
          <article
            v-for="transition in state.ageTransitions"
            :key="'age-' + transition.civ"
            class="event-row"
          >
            <small>Nouvel âge · {{ transition.civ }}</small>
            <p>
              {{ AGE_NAMES[transition.from] }} → {{ AGE_NAMES[transition.to] }}
            </p>
          </article>
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
            ><small
              v-if="
                r.truceUntil >
                (sequential ? (state.sequence?.round ?? 1) : world.tick)
              "
              >Trêve jusqu’à {{ sequential ? "la manche" : "au tour" }}
              {{ r.truceUntil }}</small
            >
          </article>
          <p class="panel-help">
            {{
              sequential
                ? "Les offres de paix et de commerce restent ouvertes pour la réponse du prochain dirigeant concerné. Deux propositions concordantes scellent l’accord."
                : "Les accords commerciaux et les paix nécessitent deux propositions concordantes."
            }}
            Une déclaration de guerre reste unilatérale, hors trêve.
          </p></template
        >
      </aside>
    </div>
    <section
      v-if="loaded && over && latest && hud && !setup && resultOpen"
      class="campaign-result"
      aria-label="Bilan de la chronique"
    >
      <button
        class="panel-close"
        @click="resultOpen = false"
        aria-label="Fermer le bilan"
      >
        ×
      </button>
      <h2>
        {{
          campaignFinished
            ? "La chronique est complète"
            : "Une civilisation demeure"
        }}
      </h2>
      <p>
        {{ summary?.turns }}
        {{ sequential ? "manches terminées" : "tours enregistrés" }} ·
        {{
          loaded.campaign.mode === "local"
            ? "Dirigeants locaux déterministes"
            : "Décisions des modèles configurés"
        }}
      </p>
      <div class="result-table">
        <table>
          <caption>
            État final des civilisations, sans score de victoire artificiel
          </caption>
          <thead>
            <tr>
              <th scope="col">Civilisation</th>
              <th v-if="loaded.state.ages" scope="col">Âge et parcours</th>
              <th scope="col">Habitants</th>
              <th scope="col">Villes</th>
              <th scope="col">Découvertes</th>
              <th
                v-if="loaded.state.rules === 'spectator-3' || sequential"
                scope="col"
              >
                Plans accomplis
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in scoreboard" :key="entry.civ">
              <th scope="row">{{ names[entry.civ] }}</th>
              <td v-if="loaded.state.ages">
                <template v-if="loaded.state.ages[entry.civ]">
                  <strong>{{
                    AGE_NAMES[loaded.state.ages[entry.civ]!.current]
                  }}</strong>
                  <details>
                    <summary>Comparer le parcours</summary>
                    <ol>
                      <li
                        v-for="milestone in loaded.state.ages[entry.civ]!
                          .history"
                        :key="milestone.age"
                      >
                        {{ AGE_NAMES[milestone.age] }} ·
                        {{ sequential ? "action" : "tour" }}
                        {{ milestone.turn }}
                      </li>
                    </ol>
                  </details>
                </template>
              </td>
              <td>{{ entry.population }}</td>
              <td>{{ entry.cities }}</td>
              <td>{{ entry.advances }}</td>
              <td v-if="loaded.state.rules === 'spectator-3' || sequential">
                {{ entry.completedPlans }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="result-actions">
        <button
          @click="
            resultOpen = false;
            momentsOnly = true;
            seek(0);
            playing = true;
          "
          :disabled="!importantTurns.length"
        >
          Revoir les moments importants</button
        ><button @click="setup = true">Créer une autre histoire</button>
      </div>
    </section>
    <footer class="turn-controls">
      <div class="playback">
        <button
          :disabled="!loaded || index === 0"
          @click="seek(Math.max(0, index - 1))"
          aria-label="Tour précédent"
        >
          ←</button
        ><button
          :disabled="
            !loaded ||
            loaded.campaign.turns.length === 0 ||
            (momentsOnly && !importantTurns.length)
          "
          @click="playHistory"
        >
          {{ playing ? "Pause" : "Lire l’histoire" }}</button
        ><select v-model.number="speed" aria-label="Vitesse de lecture">
          <option :value="1">1×</option>
          <option :value="2">2×</option>
          <option :value="4">4×</option>
        </select>
      </div>
      <label
        class="moments-toggle"
        title="Fondations, défaites, découvertes et famines enregistrées"
        ><input type="checkbox" v-model="momentsOnly" />Moments importants
        <small>{{ importantTurns.length }}</small></label
      >
      <label class="scrubber"
        >{{ sequential ? "Action" : "Tour" }} {{ index }} /
        {{
          sequential
            ? (loaded?.history.length ?? 1) - 1
            : (loaded?.campaign.maxTurns ?? (loaded?.history.length ?? 1) - 1)
        }}<input
          type="range"
          min="0"
          :max="(loaded?.history.length ?? 1) - 1"
          :value="index"
          @input="seek(Number(($event.target as HTMLInputElement).value))"
      /></label>
      <div class="live-controls">
        <button
          v-if="over"
          @click="
            resultOpen = true;
            seek((loaded?.history.length ?? 1) - 1);
          "
        >
          Voir le bilan
        </button>
        <small v-else-if="loaded?.campaign.maxTurns" class="remaining-turns"
          >{{ summary?.remainingTurns }}
          {{ sequential ? "manches" : "tours" }} à venir</small
        >
        <span v-if="busy" role="status"
          >{{
            sequential
              ? `${activeRulerName} prépare son tour…`
              : "Conseil en cours…"
          }}
          <template v-if="!sequential">
            {{ loaded?.campaign.pending?.answers.length ?? 0 }}/{{
              world.civs.filter((c) => c.fellOnTick === null).length
            }}</template
          ></span
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
            {{
              sequential
                ? busy
                  ? `${activeRulerName} se prépare…`
                  : `Jouer le tour de ${activeRulerName}`
                : busy
                  ? "Décisions en cours…"
                  : "Résoudre le tour suivant"
            }}
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
