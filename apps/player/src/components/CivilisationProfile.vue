<script setup lang="ts">
import type { Identity } from "@abs/contracts";
import type { Doctrine, Turning } from "@abs/world";
import DecisionSources from "./DecisionSources.vue";
import LearningCurveView, { type PublishedLearningCurve } from "./LearningCurve.vue";

export interface CivilisationHistory {
  turnings: Turning[];
}

defineProps<{
  identity: Identity;
  doctrine: Doctrine;
  history: CivilisationHistory;
  curve: PublishedLearningCurve | null;
}>();

const emit = defineEmits<{ seek: [tick: number] }>();

const WORK = [
  ["farming", "agriculture"],
  ["forestry", "forêt"],
  ["mining", "mines"],
  ["trade", "commerce"],
  ["military", "armée"],
] as const;
</script>

<template>
  <article class="profile">
    <section class="identity" aria-labelledby="profile-title">
      <p class="eyebrow mono">Profil de civilisation</p>
      <h2 id="profile-title">{{ identity.displayName }}</h2>
      <p v-if="identity.origin" class="origin">{{ identity.origin }}</p>
      <p v-else class="muted">Origine non renseignée.</p>
      <ul v-if="identity.values.length" class="values mono" aria-label="Valeurs déclarées">
        <li v-for="value in identity.values" :key="value">{{ value }}</li>
      </ul>
      <p v-else class="muted">Valeurs non renseignées.</p>

      <div class="doctrine">
        <div>
          <p class="label mono">doctrine actuelle</p>
          <p>{{ doctrine.creed || "Aucun credo transmis." }}</p>
        </div>
        <dl class="mono">
          <div><dt>posture</dt><dd>{{ doctrine.posture.toLowerCase() }}</dd></div>
          <div><dt>terre visée</dt><dd>{{ doctrine.claim }}</dd></div>
          <div v-for="[key, label] in WORK" :key="key"><dt>{{ label }} · part déclarée</dt><dd>{{ doctrine[key] }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="history" aria-labelledby="history-title">
      <p class="eyebrow mono">Chronologie</p>
      <h3 id="history-title">Tournants historiques</h3>
      <p v-if="history.turnings.length === 0" class="muted">Aucun tournant historique n'est encore daté.</p>
      <ol v-else>
        <li v-for="turn in history.turnings" :key="`${turn.tick}-${turn.kind}`">
          <button type="button" class="mono" @click="emit('seek', turn.tick)">an {{ turn.tick }}</button>
          <span class="mono kind">{{ turn.kind }}</span>
          <span>{{ turn.text }}</span>
        </li>
      </ol>
    </section>

    <section class="evidence-grid" aria-label="Mesures et sources">
      <LearningCurveView
        v-if="curve"
        :series="curve.series"
        :event-markers="curve.eventSources"
        :classification="curve.classification"
        :service-rate="curve.serviceRate"
        :sample-count="curve.sampleCount"
        :unranked-reasons="curve.unrankedReasons"
        @select-observation="emit('seek', $event)"
      />
      <LearningCurveView
        v-else
        :series="{ consequenceRecognition: [], errorCorrection: [], doctrineCoherence: [], narrativeFidelity: [] }"
        :event-markers="[]"
        classification="INSUFFICIENT_DATA"
        :service-rate="null"
        :sample-count="0"
        :unranked-reasons="[]"
        @select-observation="emit('seek', $event)"
      />
      <DecisionSources :observations="curve?.eventSources ?? []" @seek="emit('seek', $event)" />
    </section>
  </article>
</template>

<style scoped>
.profile { padding: clamp(var(--s5), 6vw, 72px) 0; border-bottom: 1px solid var(--border); }
.eyebrow { margin: 0 0 var(--s2); color: var(--accent); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
h2 { max-width: 18ch; font-family: var(--display); font-size: clamp(38px, 6vw, 72px); font-weight: 400; line-height: 0.98; }
h3 { margin: 0; font-family: var(--display); font-size: clamp(28px, 4vw, 48px); font-weight: 400; }
.origin { max-width: 70ch; margin: var(--s4) 0 0; font-family: var(--display); font-size: 18px; }
.muted { color: var(--muted); }
.values { display: flex; flex-wrap: wrap; gap: var(--s2); margin: var(--s4) 0 0; padding: 0; list-style: none; }
.values li { padding: var(--s1) var(--s2); border: 1px solid var(--border); font-size: 11px; }
.doctrine { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr); gap: var(--s6); margin-top: var(--s6); padding-top: var(--s4); border-top: 1px solid var(--border-soft); }
.doctrine p { margin: 0; }
.label { color: var(--muted); font-size: 10px; text-transform: uppercase; }
.doctrine dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s1) var(--s4); margin: 0; font-size: 11px; }
.doctrine dl div { display: flex; justify-content: space-between; gap: var(--s2); border-bottom: 1px solid var(--border-soft); }
dt { color: var(--muted); } dd { margin: 0; }
.history { margin-top: var(--s6); padding-top: var(--s6); border-top: 1px solid var(--border); }
.history ol { margin: var(--s5) 0 0; padding: 0; list-style: none; }
.history li { display: grid; grid-template-columns: 6rem 8rem minmax(0, 1fr); gap: var(--s3); align-items: center; min-height: 52px; border-bottom: 1px solid var(--border-soft); }
.history .kind { color: var(--accent); font-size: 10px; }
.evidence-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: var(--s6); margin-top: var(--s6); padding-top: var(--s6); border-top: 1px solid var(--border); }
@media (max-width: 900px) { .doctrine, .evidence-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .doctrine dl { grid-template-columns: 1fr; }
  .history li { grid-template-columns: 1fr; gap: var(--s1); padding: var(--s2) 0; }
  .history button { justify-self: start; }
}
</style>
