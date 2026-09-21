<script setup lang="ts">
import { computed } from "vue";
import type { FactionId } from "@abs/contracts";
import {
  planHistory,
  planRecord,
  type PlanBearingState,
  type PlanChapter,
} from "../../../../packages/world/src/plan-history";

/**
 * Ce qu'un dirigeant a voulu, ce qu'il a fait, et ce qui en est sorti.
 *
 * Deux voix, séparées à dessein : la raison qu'il a donnée, mot pour mot, et
 * le constat du moteur à chaque étape. Le lecteur peut donc comparer une
 * intention à son résultat sans qu'on lui souffle la conclusion.
 *
 * Rien n'est ajouté à l'état : tout se lit dans l'histoire déjà rejouée.
 */
const props = defineProps<{
  civId: FactionId;
  history: readonly PlanBearingState[];
  /** Jusqu'où le lecteur a avancé : on ne montre pas l'avenir. */
  upTo: number;
}>();

const chapters = computed(() =>
  planHistory(props.history.slice(0, props.upTo + 1), props.civId),
);
const record = computed(() => planRecord(chapters.value));

const KIND_NAMES: Record<PlanChapter["kind"], string> = {
  settle: "Fonder une ville",
  build: "Construire",
  research: "Chercher",
  trade: "Commercer",
};
const OUTCOME_NAMES: Record<PlanChapter["outcome"], string> = {
  completed: "tenu",
  blocked: "bloqué",
  cancelled: "abandonné",
  active: "en cours",
};

/** « Fonder une ville · case 42 » — la visée, dite en clair. */
function aim(chapter: PlanChapter): string {
  const target =
    chapter.targetTile !== null
      ? `case ${chapter.targetTile}`
      : (chapter.targetCity ??
        chapter.targetTech ??
        chapter.targetBuilding ??
        null);
  return target
    ? `${KIND_NAMES[chapter.kind]} · ${target}`
    : KIND_NAMES[chapter.kind];
}

const when = (chapter: PlanChapter) =>
  chapter.endedAt !== null
    ? `tours ${chapter.startedAt} à ${chapter.endedAt}`
    : `depuis le tour ${chapter.startedAt}`;

const percent = (progress: number) => `${Math.round(progress * 100)} %`;
</script>

<template>
  <section class="plan-history" aria-label="Décisions et conséquences">
    <h3>Décisions et conséquences</h3>
    <template v-if="chapters.length">
      <p class="plan-record">
        {{ record.adopted }}
        {{ record.adopted > 1 ? "plans adoptés" : "plan adopté" }} —
        {{ record.completed }} tenu{{ record.completed > 1 ? "s" : "" }},
        {{ record.blocked }} bloqué{{ record.blocked > 1 ? "s" : "" }},
        {{ record.cancelled }} abandonné{{ record.cancelled > 1 ? "s" : "" }}
      </p>
      <details
        v-for="(chapter, index) in [...chapters].reverse()"
        :key="`${chapter.startedAt}:${index}`"
        class="plan-chapter"
        :open="index === 0"
      >
        <summary>
          <strong>{{ aim(chapter) }}</strong>
          <span :class="`plan-outcome plan-${chapter.outcome}`">{{
            OUTCOME_NAMES[chapter.outcome]
          }}</span>
          <small>{{ when(chapter) }}</small>
        </summary>
        <!-- Les mots du dirigeant, cités, jamais reformules. -->
        <blockquote v-if="chapter.rationale" class="plan-rationale">
          {{ chapter.rationale }}
        </blockquote>
        <ol class="plan-steps">
          <li
            v-for="step in chapter.steps"
            :key="`${step.tick}:${step.detail}`"
          >
            <small>Tour {{ step.tick }}</small> — {{ step.detail }}
            <small v-if="step.progress > 0"
              >({{ percent(step.progress) }})</small
            >
          </li>
        </ol>
      </details>
    </template>
    <p v-else class="plan-empty">
      Aucun plan adopté à ce stade de la campagne.
    </p>
  </section>
</template>

<style scoped>
.plan-history {
  margin: 1rem 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.5rem;
}
.plan-history h3 {
  margin: 0 0 0.5rem;
}
.plan-record {
  margin: 0 0 0.5rem;
  opacity: 0.85;
}
.plan-chapter summary {
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: baseline;
}
.plan-outcome {
  font-size: 0.82em;
  padding: 0.05rem 0.4rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.plan-completed {
  border-color: rgba(131, 186, 145, 0.7);
}
.plan-blocked {
  border-color: rgba(229, 141, 131, 0.7);
}
.plan-rationale {
  margin: 0.4rem 0 0.35rem;
  padding-left: 0.65rem;
  border-left: 2px solid rgba(255, 255, 255, 0.2);
  font-style: italic;
  opacity: 0.9;
}
.plan-steps {
  margin: 0.25rem 0 0.5rem;
  padding-left: 1.2rem;
}
.plan-steps li {
  margin-bottom: 0.22rem;
}
.plan-history small {
  opacity: 0.72;
}
.plan-empty {
  margin: 0;
  opacity: 0.78;
}
</style>
