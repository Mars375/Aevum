<script setup lang="ts">
import type { DecisionRecord, WorldState } from "@abs/contracts";

defineProps<{ decisions: DecisionRecord[]; state: WorldState }>();

const shortModel = (m: string | null) => (m ? m.split("/").pop()!.replace(":free", "") : "—");
</script>

<template>
  <div class="stack">
    <article v-for="d in decisions" :key="d.factionId" class="card general" :style="{ '--faction': `var(--${d.factionId})` }">
      <header>
        <h3>{{ d.factionId }}</h3>
        <span class="hp mono" :title="`Points de vie restants pour ${d.factionId}`">
          {{ state.squads.filter((s) => s.factionId === d.factionId).reduce((n, s) => n + s.hp, 0) }} PV
        </span>
      </header>

      <p v-if="d.telemetry.error" class="error mono">Injoignable — {{ d.telemetry.error }}</p>
      <p v-else class="reasoning">{{ d.reasoning || "Aucune justification fournie." }}</p>

      <dl class="mono">
        <div>
          <dt>modèle</dt>
          <dd :title="d.telemetry.servedModel ?? 'aucun'">{{ shortModel(d.telemetry.servedModel) }}</dd>
        </div>
        <div>
          <dt>latence</dt>
          <dd>{{ (d.telemetry.latencyMs / 1000).toFixed(1) }}s</dd>
        </div>
        <div>
          <dt>tokens</dt>
          <dd>{{ d.telemetry.promptTokens + d.telemetry.completionTokens }}</dd>
        </div>
        <div>
          <dt>essais</dt>
          <dd>{{ d.telemetry.attempts }}</dd>
        </div>
      </dl>

      <!--
        A fallback is worth showing: on the free tier it is the normal regime,
        and it explains why one general suddenly reasons differently.
      -->
      <p v-if="d.telemetry.fellBack" class="fallback mono">
        repli depuis {{ shortModel(d.telemetry.requestedModel) }}
      </p>
    </article>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.general {
  border-left: 3px solid var(--faction);
  padding: var(--s3);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
}

h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--faction);
}

.hp {
  font-size: 12px;
  color: var(--muted);
}

.reasoning {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #cbd5e1;
}

.error {
  margin: 0;
  font-size: 12px;
  color: var(--crimson);
}

dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: var(--s2);
  margin: 0;
  font-size: 11px;
}

dt {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fallback {
  margin: 0;
  font-size: 11px;
  color: var(--amber);
}
</style>
