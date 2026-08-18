<script setup lang="ts">
import { computed } from "vue";
import type { BattleReport, ReportAudit } from "@abs/contracts";

const props = defineProps<{ reports: BattleReport[]; audits: ReportAudit[] }>();
const emit = defineEmits<{ goToTurn: [number] }>();

/**
 * Verdict styling carries a text prefix as well as a colour, like every other
 * status in this player: a reader who cannot separate the hues must still be
 * able to tell a confirmed claim from a contradicted one.
 */
const VERDICT: Record<string, { label: string; tone: string; hint: string }> = {
  VERIFIED: { label: "CONFIRMÉ", tone: "ok", hint: "Le replay confirme cette affirmation." },
  CONTRADICTED: { label: "CONTREDIT", tone: "bad", hint: "Le replay ne contient pas ce qui est affirmé." },
  UNSUPPORTED: { label: "NON VÉRIFIABLE", tone: "vague", hint: "Aucune action reconnaissable : ni crédité ni pénalisé." },
  OUT_OF_RANGE: { label: "TOUR INEXISTANT", tone: "bad", hint: "Le tour cité n'existe pas dans cette bataille." },
};

const panels = computed(() =>
  props.reports.map((report) => {
    const audit = props.audits.find((a) => a.factionId === report.factionId);
    return {
      report,
      audit,
      // Explicitly "non mesurable", never 0%: not knowing and lying are
      // different findings and must not look alike.
      fidelity: audit?.fidelity == null ? null : Math.round(audit.fidelity * 100),
      claims: audit?.claims ?? [],
    };
  }),
);
</script>

<template>
  <section v-if="panels.length" class="reports">
    <h2>Rapports de bataille</h2>
    <p class="preamble">
      Chaque général a rendu compte de sa bataille après coup. Chaque affirmation est confrontée au replay,
      tour par tour, mécaniquement — aucun modèle ne juge ici.
    </p>

    <article v-for="p in panels" :key="p.report.factionId" class="card report" :style="{ '--faction': `var(--${p.report.factionId})` }">
      <header>
        <h3>{{ p.report.factionId }}</h3>
        <span class="fidelity mono" :class="p.fidelity === null ? 'vague' : p.fidelity >= 80 ? 'ok' : p.fidelity >= 50 ? 'mixed' : 'bad'">
          {{ p.fidelity === null ? "fidélité non mesurable" : `fidélité ${p.fidelity} %` }}
        </span>
      </header>

      <p class="summary">{{ p.report.summary }}</p>

      <ol v-if="p.claims.length" class="claims">
        <li v-for="(c, i) in p.claims" :key="i" :class="VERDICT[c.verdict]?.tone">
          <button type="button" class="turn mono" :title="`Aller au tour ${c.claim.turn}`" @click="emit('goToTurn', c.claim.turn)">
            T{{ c.claim.turn }}
          </button>
          <div class="body">
            <p class="claim">{{ c.claim.decision }}</p>
            <p v-if="c.claim.result" class="result">→ {{ c.claim.result }}</p>
            <p class="verdict mono">
              <span class="badge">{{ VERDICT[c.verdict]?.label ?? c.verdict }}</span>
              <span class="evidence">{{ c.evidence }}</span>
            </p>
          </div>
        </li>
      </ol>
      <p v-else class="empty">Aucune affirmation datée dans ce rapport.</p>

      <!-- Read from the replay, never from the report, and shown beside it
           rather than folded into a single score. -->
      <dl v-if="p.audit" class="metrics mono">
        <div><dt>attaques portées</dt><dd>{{ p.audit.metrics.attacksLanded }}</dd></div>
        <div><dt>gaspillées</dt><dd>{{ p.audit.metrics.attacksWasted }}</dd></div>
        <div><dt>ordres rejetés</dt><dd>{{ p.audit.metrics.ordersRejected }}</dd></div>
        <div><dt>pertes</dt><dd>{{ p.audit.metrics.squadsLost }}</dd></div>
        <div><dt>PV finaux</dt><dd>{{ p.audit.metrics.finalHp }}</dd></div>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.reports {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.preamble {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  max-width: 70ch;
}

.report {
  border-left: 3px solid var(--faction);
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

h3 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--faction);
}

.fidelity {
  font-size: 12px;
}

/* Colour reinforces the wording; it never carries the verdict alone. */
.fidelity.ok,
.badge {
  color: var(--verdant);
}
.fidelity.mixed {
  color: var(--amber);
}
.fidelity.bad {
  color: var(--crimson);
}
.fidelity.vague {
  color: var(--muted);
}

.summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #cbd5e1;
}

.claims {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.claims li {
  display: flex;
  gap: var(--s3);
  padding: var(--s2);
  border-left: 2px solid var(--border);
  background: var(--card-raised);
  border-radius: 0 3px 3px 0;
}

.claims li.ok {
  border-left-color: var(--verdant);
}
.claims li.bad {
  border-left-color: var(--crimson);
}
.claims li.vague {
  border-left-color: #64748b;
}

.turn {
  flex: none;
  min-height: 32px;
  min-width: 44px;
  padding: var(--s1) var(--s2);
  font-size: 11px;
  align-self: flex-start;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.claim {
  margin: 0;
  font-size: 13px;
}

.result {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.verdict {
  margin: 2px 0 0;
  font-size: 11px;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

li.bad .badge {
  color: var(--crimson);
}
li.vague .badge {
  color: #94a3b8;
}

.badge {
  font-weight: 700;
  letter-spacing: 0.03em;
}

.evidence {
  color: var(--muted);
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  margin: 0;
  font-size: 11px;
  border-top: 1px solid var(--border-soft);
  padding-top: var(--s2);
}

.metrics dt {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
}

.metrics dd {
  margin: 0;
  font-size: 13px;
}

.empty {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
