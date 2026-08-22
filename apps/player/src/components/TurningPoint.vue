<script setup lang="ts">
import { computed, ref } from "vue";
import { turningPoints, type Journal, type Year } from "@abs/world";

const props = defineProps<{ journal: Journal; years: Year[]; at: number }>();
const emit = defineEmits<{ seek: [number] }>();

const EVENT_LABEL: Record<string, string> = {
  STARVED: "famine",
  ADVANCE: "progrès",
  COLLAPSED: "extinction",
  SEIZED: "conquête",
  CEDED: "terre perdue",
  RAIDED: "pillage",
  ROUTED: "assaut repoussé",
  HELD: "frontière tenue",
  LAND_FULL: "monde plein",
  SHORTAGE: "solde impayée",
  DISASTER: "catastrophe",
  VOW_BROKEN: "serment rompu",
  CAPITAL_LOST: "siège perdu",
  CAPITAL_MOVED: "siège déplacé",
};

const points = computed(() => turningPoints(props.years));
const point = computed(() => {
  const eligible = points.value.filter((item) => item.tick <= props.at);
  return eligible.at(-1) ?? points.value[0] ?? null;
});
const actYear = computed(() => {
  if (point.value) return props.years.find((item) => item.tick === point.value!.tick) ?? props.years.at(-1)!;
  return [...props.years].reverse().find((item) => item.rulings.length || item.events.length) ?? props.years.at(-1)!;
});
const ruling = computed(() => {
  const exact = actYear.value.rulings;
  if (!exact.length) return null;
  return exact.find((item) => item.civ === point.value?.civ) ?? exact[0]!;
});
const nextYear = computed(() => props.years.find((item) => item.tick === actYear.value.tick + 1) ?? null);
const resultEvents = computed(() => (ruling.value ? nextYear.value?.events ?? [] : actYear.value.events));

const decision = computed(() => {
  const doctrine = ruling.value?.doctrine;
  if (!doctrine) return [];
  const rows: string[] = [];
  if (doctrine.posture) rows.push(`posture : ${doctrine.posture.toLowerCase()}`);
  if (doctrine.claim) rows.push(`terre convoitée : ${doctrine.claim}`);
  const work = ["farming", "forestry", "mining", "trade", "military"] as const;
  const shares = work.filter((key) => doctrine[key] !== undefined).map((key) => `${key} ${Math.round((doctrine[key] ?? 0) * 100)} %`);
  if (shares.length) rows.push(`répartition : ${shares.join(", ")}`);
  if (doctrine.vow) rows.push(`serment : ${doctrine.vow.metric} ≥ ${doctrine.vow.floor}`);
  if (doctrine.creed) rows.push(`credo transmis : « ${doctrine.creed} »`);
  return rows;
});

const copied = ref(false);
async function copyLink() {
  const url = new URL(location.href);
  url.searchParams.set("annee", String(actYear.value.tick));
  try {
    await navigator.clipboard.writeText(url.toString());
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1800);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <section class="act" aria-labelledby="act-title">
    <header class="act-heading">
      <div>
        <p class="eyebrow mono">Acte de l'année · an {{ actYear.tick }}</p>
        <h2 id="act-title">{{ point?.text ?? `Une année inscrite par le moteur` }}</h2>
      </div>
      <span class="folio mono">{{ point?.kind ?? ruling?.kind ?? "JOURNAL" }}</span>
    </header>

    <div class="sequence">
      <article class="situation">
        <p class="step mono">01 · Situation</p>
        <p v-if="point">{{ point.text }}</p>
        <p v-else-if="ruling">
          {{ ruling.civ }} a été consultée pour « {{ ruling.kind.toLowerCase() }} ».
          Les faits déclencheurs détaillés ne sont pas conservés dans ce journal.
        </p>
        <p v-else>Monde vécu sans décision de dirigeant. Le journal ne conserve ici qu'un événement du moteur.</p>
      </article>

      <article class="words" :class="ruling?.civ">
        <p class="step mono">02 · Parole et décision</p>
        <template v-if="ruling">
          <blockquote v-if="ruling.reason">« {{ ruling.reason }} »</blockquote>
          <p v-else class="missing">Le dirigeant n'a fourni aucune explication.</p>
          <p class="attribution mono">
            {{ ruling.civ }} · modèle servi : {{ ruling.model ?? "doctrine en place, sans appel modèle" }}
            <span v-if="ruling.deferredBy"> · décision différée de {{ ruling.deferredBy }} an(s)</span>
          </p>
          <ul v-if="decision.length" class="decision mono">
            <li v-for="row in decision" :key="row">{{ row }}</li>
          </ul>
          <p v-else class="missing">La décision mécanique ne modifie aucun champ affichable du contrat.</p>
        </template>
        <p v-else class="missing">Aucune décision de dirigeant n'est reliée à ce tournant dans le journal.</p>
      </article>

      <article class="consequence">
        <p class="step mono">03 · Réponse du moteur</p>
        <p v-if="ruling" class="qualification">
          Événements observés l'année suivante. Le journal les date sans prétendre qu'une seule décision les a causés.
        </p>
        <ul v-if="resultEvents.length" class="results">
          <li v-for="(event, index) in resultEvents" :key="`${event.kind}-${index}`">
            <strong>{{ EVENT_LABEL[event.kind] ?? event.kind }}</strong>
            <span>{{ event.civ }} · {{ event.detail }}</span>
          </li>
        </ul>
        <p v-else class="missing">
          {{ ruling && !nextYear ? "Aucune année suivante n'est encore enregistrée : conséquence non observable." : "Aucun effet notable n'est consigné à cette date." }}
        </p>
      </article>
    </div>

    <footer class="act-actions">
      <button type="button" @click="emit('seek', actYear.tick)">Voir cette année</button>
      <button type="button" class="quiet" @click="copyLink">{{ copied ? "Lien copié" : "Copier le lien" }}</button>
      <details class="proof">
        <summary>Comment le vérifier</summary>
        <dl class="mono">
          <div><dt>graine</dt><dd>{{ journal.origin.seed }}</dd></div>
          <div><dt>règles</dt><dd>{{ journal.worldVersion }}</dd></div>
          <div><dt>modèle demandé</dt><dd>non enregistré</dd></div>
          <div><dt>modèle servi</dt><dd>{{ ruling?.model ?? "aucun" }}</dd></div>
          <div><dt>latence / essais</dt><dd>non enregistrés</dd></div>
          <div><dt>relecture</dt><dd>journal recomposé localement par le moteur</dd></div>
        </dl>
      </details>
    </footer>
  </section>
</template>

<style scoped>
.act {
  border-top: 1px solid var(--accent-dim);
  border-bottom: 1px solid var(--border);
  padding: clamp(var(--s5), 5vw, 64px) 0;
}

.act-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s5);
  align-items: start;
}

.eyebrow,
.step {
  margin: 0 0 var(--s2);
  color: var(--accent);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h2 {
  max-width: 24ch;
  font-family: var(--display);
  font-size: clamp(28px, 4.5vw, 54px);
  font-weight: 400;
  line-height: 1.04;
}

.folio {
  color: var(--muted);
  font-size: 10px;
  writing-mode: vertical-rl;
  letter-spacing: 0.16em;
}

.sequence {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(280px, 1.35fr) minmax(240px, 1fr);
  margin-top: var(--s6);
}

.sequence article {
  min-width: 0;
  padding: 0 var(--s5);
  border-left: 1px solid var(--border-soft);
}

.sequence article:first-child {
  padding-left: 0;
  border-left: 0;
}

.sequence p {
  margin-top: 0;
}

blockquote {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(19px, 2vw, 25px);
  line-height: 1.45;
}

.attribution,
.qualification,
.missing {
  color: var(--muted);
  font-size: 12px;
}

.attribution {
  margin-top: var(--s4) !important;
}

.decision,
.results {
  list-style: none;
  margin: var(--s4) 0 0;
  padding: 0;
}

.decision {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  color: var(--muted);
  font-size: 11px;
}

.results li {
  display: grid;
  gap: 2px;
  padding: var(--s2) 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 13px;
}

.results strong {
  color: var(--accent);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.act-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--s2);
  margin-top: var(--s6);
}

.quiet {
  background: transparent;
}

.proof {
  flex: 1 1 100%;
  border-top: 1px solid var(--border-soft);
  margin-top: var(--s3);
}

.proof summary {
  width: fit-content;
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--accent);
  cursor: pointer;
}

.proof dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s3) var(--s5);
  margin: 0;
  padding: var(--s4) 0;
  font-size: 11px;
}

.proof dt {
  color: var(--muted);
}

.proof dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .sequence {
    grid-template-columns: 1fr 1fr;
  }

  .sequence .situation {
    grid-column: 1 / -1;
    padding: 0 0 var(--s5);
    border: 0;
  }

  .sequence .words {
    padding-left: 0;
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .act-heading {
    grid-template-columns: 1fr;
  }

  .folio {
    writing-mode: horizontal-tb;
  }

  .sequence {
    grid-template-columns: 1fr;
  }

  .sequence article,
  .sequence .words {
    padding: var(--s4) 0;
    border-left: 0;
    border-top: 1px solid var(--border-soft);
  }

  .sequence .situation {
    grid-column: auto;
  }

  .proof dl {
    grid-template-columns: 1fr;
  }
}
</style>
