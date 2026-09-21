<script setup lang="ts">
import { computed } from "vue";
import type { FactionId } from "@abs/contracts";
import type { World } from "@abs/world";
import {
  agreementView,
  type AgreementState,
  type Parcel,
} from "../../../../packages/world/src/agreements";

/**
 * Ce que les dirigeants se sont promis, et ce qu'il en reste.
 *
 * Strictement en lecture : aucun bouton ne permet au lecteur de proposer,
 * d'accepter ni de rompre. Le spectateur regarde une négociation, il n'y
 * participe pas.
 */
const props = defineProps<{
  civId: FactionId;
  world: World;
  agreement: AgreementState | null;
  round: number;
}>();

const view = computed(() =>
  agreementView(
    { world: props.world, agreement: props.agreement ?? undefined },
    props.civId,
    props.round,
  ),
);

const KIND_NAMES = {
  nonaggression: "Pacte de non-agression",
  transfer: "Échange",
} as const;

/** « 30 minerai, 20 nourriture » — et « rien » plutôt qu'une ligne vide. */
function goods(parcel: Parcel): string {
  const parts = (
    [
      ["nourriture", parcel.food],
      ["bois", parcel.timber],
      ["minerai", parcel.ore],
      ["richesse", parcel.wealth],
    ] as const
  )
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => `${amount} ${name}`);
  return parts.length ? parts.join(", ") : "rien";
}

const terms = (offer: (typeof view.value.incoming)[number]) =>
  offer.kind === "nonaggression"
    ? `${offer.duration} manches`
    : `donne ${goods(offer.give)}, demande ${goods(offer.receive)}`;

/**
 * La confiance se lit mieux par son signe que par son nombre : un lecteur veut
 * savoir si la relation s'est abîmée, pas retenir une échelle.
 */
const mood = (trust: number) =>
  trust > 20 ? "bonne" : trust < -20 ? "abîmée" : "neutre";

const partners = computed(() =>
  Object.entries(view.value.trust).sort(([a], [b]) => a.localeCompare(b)),
);
const hasAnything = computed(
  () =>
    view.value.pacts.length > 0 ||
    view.value.incoming.length > 0 ||
    view.value.outgoing.length > 0 ||
    view.value.recent.length > 0,
);
</script>

<template>
  <section class="agreements-panel" aria-label="Accords diplomatiques">
    <h3>Accords</h3>
    <template v-if="hasAnything">
      <ul v-if="view.pacts.length" class="agreement-pacts">
        <li v-for="pact in view.pacts" :key="pact.id">
          <strong>Non-agression avec {{ pact.partner }}</strong> —
          {{ pact.roundsLeft }}
          {{ pact.roundsLeft > 1 ? "manches restantes" : "manche restante" }}
        </li>
      </ul>

      <details v-if="view.incoming.length" class="agreement-offers" open>
        <summary>Propositions reçues ({{ view.incoming.length }})</summary>
        <ul>
          <li v-for="offer in view.incoming" :key="offer.id">
            <strong>{{ KIND_NAMES[offer.kind] }}</strong> de {{ offer.from }} —
            {{ terms(offer) }}
            <small>expire à la manche {{ offer.expiresRound }}</small>
          </li>
        </ul>
      </details>

      <details v-if="view.outgoing.length" class="agreement-offers">
        <summary>Propositions émises ({{ view.outgoing.length }})</summary>
        <ul>
          <li v-for="offer in view.outgoing" :key="offer.id">
            <strong>{{ KIND_NAMES[offer.kind] }}</strong> à {{ offer.to }} —
            {{ terms(offer) }}
            <small>expire à la manche {{ offer.expiresRound }}</small>
          </li>
        </ul>
      </details>

      <dl class="agreement-trust">
        <div v-for="[partner, trust] in partners" :key="partner">
          <dt>{{ partner }}</dt>
          <dd>
            {{ trust }} <small>relation {{ mood(trust) }}</small>
          </dd>
        </div>
      </dl>

      <details v-if="view.recent.length" class="agreement-history">
        <summary>Faits récents ({{ view.recent.length }})</summary>
        <ul>
          <li
            v-for="(entry, index) in [...view.recent].reverse()"
            :key="`${entry.round}:${entry.kind}:${index}`"
          >
            <small>Manche {{ entry.round }}</small> — {{ entry.detail }}
          </li>
        </ul>
      </details>
    </template>
    <p v-else class="agreement-empty">
      Aucune promesse échangée pour l’instant.
    </p>
  </section>
</template>

<style scoped>
.agreements-panel {
  margin: 1rem 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.5rem;
}
.agreements-panel h3 {
  margin: 0 0 0.5rem;
}
.agreements-panel ul {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
}
.agreements-panel li {
  margin-bottom: 0.3rem;
}
.agreements-panel small {
  opacity: 0.72;
}
.agreement-trust {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0.4rem;
  margin: 0.6rem 0 0;
}
.agreement-trust dt {
  font-weight: 600;
}
.agreement-trust dd {
  margin: 0;
}
.agreement-empty {
  margin: 0;
  opacity: 0.78;
}
</style>
