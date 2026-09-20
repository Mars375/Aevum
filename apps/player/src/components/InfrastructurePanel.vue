<script setup lang="ts">
import { computed } from "vue";
import type { FactionId } from "@abs/contracts";
import type { World } from "@abs/world";
import {
  POLLUTION_CAP,
  energyReport,
  type InfrastructureKind,
  type InfrastructureState,
} from "../../../../packages/world/src/infrastructure";

const props = defineProps<{
  civId: FactionId;
  world: World;
  infrastructure: InfrastructureState | null;
}>();

const INFRASTRUCTURE_NAMES: Record<InfrastructureKind, string> = {
  foundry: "Fonderie",
  thermal_plant: "Centrale thermique",
  solar_array: "Parc solaire",
  research_center: "Centre de recherche",
  automated_factory: "Usine automatisée",
  spaceport: "Spatioport",
};

const report = computed(() =>
  energyReport(
    { world: props.world, infrastructure: props.infrastructure ?? undefined },
    props.civId,
  ),
);
const activeConstruction = computed(() => {
  const queue = (props.infrastructure?.queues ?? []).find(
    (candidate) => candidate.owner === props.civId,
  );
  if (!queue) return null;
  return {
    name: INFRASTRUCTURE_NAMES[queue.kind],
    city: cityName(queue.city),
    remaining: queue.remaining,
  };
});
const hasWork = computed(
  () =>
    activeConstruction.value !== null ||
    report.value.cities.some((city) => city.sites.length > 0),
);
function cityName(cityId: string) {
  const city = props.world.simulation?.cities.find((c) => c.id === cityId);
  return city ? props.world.board[city.position]!.name || city.id : cityId;
}
const foodPenalty = (foodFactor: number) => Math.round((1 - foodFactor) * 100);
// Engine values stay fractional; the UI rounds to one decimal at most.
const oneDecimal = (value: number) => Number(value.toFixed(1));
const powered = (ratio: number) => `${Math.round(ratio * 100)} %`;
</script>

<template>
  <section class="infrastructure-panel" aria-label="Infrastructures avancées">
    <h3>Infrastructures avancées</h3>
    <template v-if="hasWork">
      <p v-if="activeConstruction" class="infra-construction">
        Chantier en cours : <strong>{{ activeConstruction.name }}</strong> à
        {{ activeConstruction.city }} —
        {{ activeConstruction.remaining }}
        {{
          activeConstruction.remaining > 1
            ? "tours personnels restants"
            : "tour personnel restant"
        }}.
      </p>
      <details v-if="report.components.length" class="infra-networks" open>
        <summary>
          Réseaux électriques ({{ report.components.length }})
        </summary>
        <ul>
          <li v-for="component in report.components" :key="component.id">
            <strong>Réseau {{ component.id + 1 }}</strong> — Fourni
            {{ component.supply }} / Demandé {{ component.demand
            }}<span v-if="component.deficit > 0">
              · Déficit {{ component.deficit }}</span
            >
            · {{ powered(component.powerRatio) }} alimenté
          </li>
        </ul>
      </details>
      <details
        v-for="city in report.cities"
        :key="city.city"
        class="infra-city"
        :open="report.cities.length === 1"
      >
        <summary>{{ cityName(city.city) }}</summary>
        <ul v-if="city.sites.length" class="infra-sites">
          <li v-for="site in city.sites" :key="`${site.kind}:${site.builtAt}`">
            {{ INFRASTRUCTURE_NAMES[site.kind] }}
          </li>
        </ul>
        <p v-else class="infra-city-empty">Aucun site avancé dans cette ville.</p>
        <dl class="infra-metrics">
          <div>
            <dt>Pollution</dt>
            <dd>{{ oneDecimal(city.pollution) }} / {{ POLLUTION_CAP }}</dd>
          </div>
          <div>
            <dt>Pénalité alimentaire</dt>
            <dd>−{{ foodPenalty(city.foodFactor) }} %</dd>
          </div>
          <div>
            <dt>Bonus science</dt>
            <dd>+{{ oneDecimal(city.scienceBonus) }} / tour personnel</dd>
          </div>
          <div>
            <dt>Énergie</dt>
            <dd>{{ powered(city.powerRatio) }}</dd>
          </div>
        </dl>
      </details>
    </template>
    <p v-else class="infra-empty">
      Aucune infrastructure avancée.<br />
      <small>
        Les infrastructures avancées se débloquent par les programmes nationaux
        de modernisation : le dirigeant lancera leur construction une fois le
        programme correspondant achevé.
      </small>
    </p>
  </section>
</template>

<style scoped>
.infrastructure-panel {
  border-block: 1px solid var(--edge);
  padding: 14px 0;
  margin-top: 14px;
}
.infrastructure-panel h3 {
  margin-top: 0;
}
.infra-construction,
.infra-empty {
  font-size: 12px;
  line-height: 1.7;
}
.infra-networks,
.infra-city {
  border-top: 1px solid var(--edge);
  margin-top: 10px;
  padding-top: 8px;
}
.infra-networks summary,
.infra-city summary {
  cursor: pointer;
  color: var(--accent);
  font-size: 12px;
}
.infra-networks ul,
.infra-sites {
  margin: 8px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
  font-size: 12px;
}
.infra-city-empty {
  font-size: 11px;
  color: var(--soft);
  margin: 8px 0 0;
}
.infra-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin: 10px 0 0;
}
.infra-metrics div {
  display: grid;
  gap: 2px;
}
.infra-metrics dt {
  font-size: 10px;
  color: var(--soft);
}
.infra-metrics dd {
  margin: 0;
  font-size: 13px;
}
@media (max-width: 720px) {
  .infra-metrics {
    grid-template-columns: 1fr;
  }
}
</style>