<script setup lang="ts">
import { computed } from "vue";
import type { BattleEvent } from "@abs/contracts";

const props = defineProps<{ events: BattleEvent[] }>();
const emit = defineEmits<{ focusSquad: [string | null] }>();

/** Tone drives colour; the prefix keeps the meaning legible without colour. */
const TONE: Record<string, { tone: "hit" | "miss" | "reject" | "fatal" | "info"; prefix: string }> = {
  ATTACK_HIT: { tone: "hit", prefix: "TOUCHE" },
  ATTACK_MISSED: { tone: "miss", prefix: "MANQUE" },
  ATTACK_OUT_OF_RANGE: { tone: "reject", prefix: "HORS PORTEE" },
  ATTACK_FRIENDLY_BLOCKED: { tone: "reject", prefix: "TIR ALLIE" },
  MOVE_OK: { tone: "info", prefix: "DEPLACE" },
  MOVE_BLOCKED: { tone: "miss", prefix: "BLOQUE" },
  ORDER_REJECTED: { tone: "reject", prefix: "REJET" },
  ORDER_MISSING: { tone: "reject", prefix: "ORDRE ABSENT" },
  SQUAD_DESTROYED: { tone: "fatal", prefix: "DETRUITE" },
  FACTION_ELIMINATED: { tone: "fatal", prefix: "FACTION ELIMINEE" },
  GENERAL_UNREACHABLE: { tone: "fatal", prefix: "GENERAL INJOIGNABLE" },
  ATTACK_ALLY_BLOCKED: { tone: "reject", prefix: "TIR SUR ALLIE" },
  COMPOSITION_REJECTED: { tone: "reject", prefix: "ARMEE REJETEE" },
  DIPLOMACY_REJECTED: { tone: "reject", prefix: "DIPLOMATIE REJETEE" },
  ALLIANCE_PROPOSED: { tone: "info", prefix: "ALLIANCE PROPOSEE" },
  ALLIANCE_FORMED: { tone: "hit", prefix: "ALLIANCE FORMEE" },
  ALLIANCE_BREAK_DECLARED: { tone: "reject", prefix: "RUPTURE ANNONCEE" },
  ALLIANCE_BROKEN: { tone: "fatal", prefix: "ALLIANCE ROMPUE" },
  FACTION_SURRENDERED: { tone: "fatal", prefix: "CAPITULATION" },
};

const rows = computed(() =>
  props.events.map((e, i) => {
    const meta = TONE[e.type] ?? { tone: "info" as const, prefix: e.type };
    const any = e as Record<string, any>;
    let detail = "";
    switch (e.type) {
      case "ATTACK_HIT":
        detail = `${any.squadId} → ${any.targetSquadId} (${any.damage} dégâts)`;
        break;
      case "ATTACK_OUT_OF_RANGE":
        detail = `${any.squadId} vise (${any.at.x},${any.at.y}) — distance ${any.distance}, portée ${any.range}`;
        break;
      case "ATTACK_MISSED":
      case "ATTACK_FRIENDLY_BLOCKED":
        detail = `${any.squadId} vise (${any.at.x},${any.at.y})`;
        break;
      case "MOVE_OK":
        detail = `${any.squadId} (${any.from.x},${any.from.y}) → (${any.to.x},${any.to.y})`;
        break;
      case "MOVE_BLOCKED":
        detail = `${any.squadId} vers (${any.attempted.x},${any.attempted.y})`;
        break;
      case "ORDER_REJECTED":
        detail = `${any.squadId} — ${any.reason}`;
        break;
      case "GENERAL_UNREACHABLE":
        detail = `${any.factionId} — ${any.error}`;
        break;
      case "FACTION_ELIMINATED":
        detail = any.factionId;
        break;
      case "ATTACK_ALLY_BLOCKED":
        detail = `${any.squadId} vise (${any.at.x},${any.at.y})`;
        break;
      case "COMPOSITION_REJECTED":
      case "DIPLOMACY_REJECTED":
        detail = `${any.factionId} — ${any.reason}`;
        break;
      case "ALLIANCE_PROPOSED":
        detail = `${any.from} → ${any.to}${any.message ? ` « ${any.message} »` : ""}`;
        break;
      case "ALLIANCE_FORMED":
      case "ALLIANCE_BROKEN":
        detail = `${any.a} + ${any.b}`;
        break;
      case "ALLIANCE_BREAK_DECLARED":
        // Worth spelling out: the betrayal does not bite until effectiveTurn.
        detail = `${any.from} → ${any.to}, effective au tour ${any.effectiveTurn}`;
        break;
      case "FACTION_SURRENDERED":
        detail = `${any.factionId}${any.message ? ` « ${any.message} »` : ""}`;
        break;
      default:
        detail = any.squadId ?? "";
    }
    return { key: `${i}-${e.type}`, squadId: any.squadId ?? null, ...meta, detail };
  }),
);
</script>

<template>
  <div class="card log">
    <h2>Journal du tour</h2>
    <p v-if="!rows.length" class="empty">Aucun événement sur ce tour.</p>
    <ol v-else class="mono">
      <li
        v-for="row in rows"
        :key="row.key"
        :class="row.tone"
        @mouseenter="emit('focusSquad', row.squadId)"
        @mouseleave="emit('focusSquad', null)"
      >
        <span class="prefix">{{ row.prefix }}</span>
        <span class="detail">{{ row.detail }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.log {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-height: 0;
}

h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.empty {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

ol {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  max-height: 340px;
  font-size: 12px;
}

li {
  display: flex;
  gap: var(--s2);
  padding: var(--s1) var(--s2);
  border-left: 2px solid var(--border);
  border-radius: 0 3px 3px 0;
  transition: background var(--t);
}

li:hover {
  background: var(--card-raised);
}

.prefix {
  flex: none;
  min-width: 108px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.detail {
  color: var(--muted);
  word-break: break-word;
}

/* Colour reinforces the prefix; it never carries the meaning by itself. */
.hit {
  border-left-color: var(--verdant);
}
.hit .prefix {
  color: var(--verdant);
}

.fatal {
  border-left-color: var(--crimson);
}
.fatal .prefix {
  color: var(--crimson);
}

.reject {
  border-left-color: var(--amber);
}
.reject .prefix {
  color: var(--amber);
}

.miss {
  border-left-color: #64748b;
}
.miss .prefix {
  color: #94a3b8;
}

.info {
  border-left-color: var(--azure);
}
.info .prefix {
  color: var(--azure);
}
</style>
