<script setup lang="ts">
import { computed } from "vue";
import type { FactionId, Squad, WorldState } from "@abs/contracts";

const props = defineProps<{
  state: WorldState;
  gridSize: number;
  highlight: string | null;
  /** v2: "a|b" pairs. Allied factions get a shared marker on the grid. */
  alliancePairs?: string[];
}>();

/** Factions that are allied with at least one other, for the grid marker. */
const alliedFactions = computed(() => {
  const set = new Set<string>();
  for (const pair of props.alliancePairs ?? []) for (const f of pair.split("|")) set.add(f);
  return set;
});

const cells = computed(() => {
  const byTile = new Map<string, Squad>();
  for (const squad of props.state.squads) byTile.set(`${squad.position.x},${squad.position.y}`, squad);

  return Array.from({ length: props.gridSize * props.gridSize }, (_, i) => {
    const x = i % props.gridSize;
    const y = Math.floor(i / props.gridSize);
    return { x, y, squad: byTile.get(`${x},${y}`) ?? null };
  });
});

const initial: Record<FactionId, string> = { crimson: "C", azure: "A", verdant: "V", amber: "M" };

const ARCHETYPE_SHAPE: Record<string, string> = { MELEE: "melee", RANGED: "ranged", SCOUT: "scout", HEAVY: "heavy" };

/**
 * Faction is never carried by colour alone: each squad also shows its faction
 * initial, and the archetype changes the shape (melee is a square, ranged a
 * circle). The grid stays readable in greyscale, and for a reader who cannot
 * separate the red faction from the green one.
 */
function label(squad: Squad): string {
  return `${squad.factionId} ${squad.archetype.toLowerCase()}, tuile ${squad.position.x} ${squad.position.y}, ${squad.hp} sur ${squad.maxHp} points de vie`;
}
</script>

<template>
  <div class="wrap">
    <div
      class="grid"
      :style="{ '--n': gridSize }"
      role="img"
      :aria-label="`Champ de bataille ${gridSize} sur ${gridSize}, ${state.squads.length} escouades en vie`"
    >
      <div
        v-for="cell in cells"
        :key="`${cell.x},${cell.y}`"
        class="cell"
        :class="{ dark: (cell.x + cell.y) % 2 === 1 }"
      >
        <div
          v-if="cell.squad"
          class="squad"
          :class="[
            ARCHETYPE_SHAPE[cell.squad.archetype],
            { flash: highlight === cell.squad.id, allied: alliedFactions.has(cell.squad.factionId) },
          ]"
          :style="{ '--faction': `var(--${cell.squad.factionId})` }"
          :title="label(cell.squad)"
        >
          <span class="initial" aria-hidden="true">{{ initial[cell.squad.factionId] }}</span>
          <span
            class="hp"
            aria-hidden="true"
            :style="{ '--pct': `${(cell.squad.hp / cell.squad.maxHp) * 100}%` }"
          />
          <span class="visually-hidden">{{ label(cell.squad) }}</span>
        </div>
      </div>
    </div>

    <ul class="legend mono">
      <li v-for="(letter, faction) in initial" :key="faction">
        <span class="chip" :style="{ '--faction': `var(--${faction})` }" aria-hidden="true">{{ letter }}</span>
        {{ faction }}
      </li>
      <li class="shapes">
        <span class="chip melee" aria-hidden="true" />mêlée
        <span class="chip ranged" aria-hidden="true" />distance
        <span class="chip scout" aria-hidden="true" />éclaireur
        <span class="chip heavy" aria-hidden="true" />lourde
      </li>
      <li v-if="alliancePairs?.length" class="shapes">
        <span class="chip allied" aria-hidden="true" />liseré = alliée
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  gap: 1px;
  background: var(--border-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  /* Square whatever the viewport, so the tactical picture never distorts. */
  aspect-ratio: 1;
  width: 100%;
}

.cell {
  background: #080d1c;
  position: relative;
}

.cell.dark {
  background: #0b1120;
}

.squad {
  position: absolute;
  inset: 8%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--faction) 26%, transparent);
  border: 2px solid var(--faction);
  color: var(--faction);
  font-family: var(--mono);
  font-weight: 700;
  font-size: clamp(7px, 1.1vw, 13px);
  border-radius: 2px;
}

/* Archetype is carried by SHAPE as well as colour, so the grid stays readable
   in greyscale and for readers who cannot separate the four faction hues. */
.squad.ranged,
.chip.ranged {
  border-radius: 50%;
}

.squad.scout,
.chip.scout {
  border-radius: 50%;
  border-style: dashed;
}

.squad.heavy,
.chip.heavy {
  border-radius: 2px;
  border-width: 3px;
}

/* Alliance is an outline, never a hue change: the faction must stay itself. */
.squad.allied,
.chip.allied {
  outline: 2px dotted var(--fg);
  outline-offset: 1px;
}

.initial {
  line-height: 1;
}

/* Thin bar along the bottom edge: hp without spending a tooltip on it. */
.hp {
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 1px;
  height: 2px;
  background: #0006;
}

.hp::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--pct);
  background: var(--faction);
}

.flash {
  animation: pulse 700ms ease-out 2;
}

@keyframes pulse {
  50% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--faction) 50%, transparent);
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--muted);
}

.legend li {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.chip {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  font-weight: 700;
  color: var(--faction, var(--muted));
  border: 2px solid var(--faction, var(--muted));
  background: color-mix(in srgb, var(--faction, var(--muted)) 26%, transparent);
  border-radius: 2px;
  flex: none;
}

.chip.ranged {
  border-radius: 50%;
}

.shapes {
  gap: var(--s1);
}
</style>
