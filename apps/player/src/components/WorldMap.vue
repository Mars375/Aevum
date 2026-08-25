<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { Ruling, TickEvent, Year } from "@abs/world";

/**
 * Reference 2D map for the living world.
 *
 * Every painted fact comes from `Year.world` (the board is authoritative). The
 * contract does not contain local resource, road or infrastructure coordinates,
 * so this view deliberately reports those aggregates instead of inventing map
 * symbols for them.
 */
const props = defineProps<{ year: Year; years: Year[]; index: number }>();
const emit = defineEmits<{ seek: [number] }>();

type Layer = "terrain" | "territory" | "places" | "resources" | "conflicts" | "diplomacy" | "advances" | "losses" | "events";
const LAYERS: Array<{ key: Layer; label: string }> = [
  { key: "terrain", label: "reliefs et eaux" },
  { key: "territory", label: "territoires" },
  { key: "places", label: "capitales et implantations" },
  { key: "resources", label: "réserves" },
  { key: "conflicts", label: "conflits" },
  { key: "diplomacy", label: "diplomatie" },
  { key: "advances", label: "avancées" },
  { key: "losses", label: "pertes" },
  { key: "events", label: "événements" },
];
const visible = reactive<Record<Layer, boolean>>({
  terrain: true,
  territory: true,
  places: true,
  resources: true,
  conflicts: true,
  diplomacy: true,
  advances: true,
  losses: true,
  events: true,
});

const TERRAIN: Record<string, string> = {
  plain: "#46612c",
  forest: "#1f4a37",
  hill: "#5b564e",
  river: "#1d5673",
};
const OWNER: Record<string, string> = {
  crimson: "var(--crimson)",
  azure: "var(--azure)",
  verdant: "var(--verdant)",
  amber: "var(--amber)",
};
const LABEL: Record<string, string> = { plain: "plaine", forest: "forêt", hill: "colline", river: "fleuve" };
const EVENT_LABEL: Record<string, string> = {
  GREW: "croissance",
  STARVED: "famine",
  EXPANDED: "expansion",
  LOST_LAND: "terre abandonnée",
  ADVANCE: "progrès",
  COLLAPSED: "extinction",
  SURPLUS: "abondance",
  SHORTAGE: "solde impayée",
  HARD_YEAR: "mauvaise récolte",
  LAND_FULL: "monde plein",
  SEIZED: "conquête",
  CEDED: "terre perdue",
  TRADED: "commerce",
  ROUTED: "assaut repoussé",
  HELD: "frontière tenue",
  RAIDED: "pillage",
  REPELLED: "bandits repoussés",
  DISASTER: "catastrophe",
  VOW_BROKEN: "serment rompu",
  CAPITAL_LOST: "siège perdu",
  CAPITAL_MOVED: "siège déplacé",
};
const CONFLICTS = new Set(["SEIZED", "CEDED", "ROUTED", "HELD", "RAIDED", "REPELLED", "CAPITAL_LOST", "CAPITAL_MOVED"]);
const DIPLOMACY = new Set(["TRADED"]);
const LOSSES = new Set(["LOST_LAND", "CEDED", "COLLAPSED", "STARVED", "CAPITAL_LOST", "VOW_BROKEN"]);

const S = 20;
const size = computed(() => props.year.world.size);
const mapSize = computed(() => size.value * S);
const board = computed(() => props.year.world.board);
const selectedCiv = ref<string | null>(null);
const zoom = ref(1);
const pan = reactive({ x: 0, y: 0 });
const mapElement = ref<SVGSVGElement | null>(null);
const drag = ref<{ clientX: number; clientY: number; x: number; y: number } | null>(null);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const viewBox = computed(() => {
  const width = mapSize.value / zoom.value;
  const height = mapSize.value / zoom.value;
  const maxX = mapSize.value - width;
  const maxY = mapSize.value - height;
  return `${clamp(pan.x, 0, maxX)} ${clamp(pan.y, 0, maxY)} ${width} ${height}`;
});
function setZoom(delta: number): void {
  zoom.value = clamp(Math.round((zoom.value + delta) * 10) / 10, 1, 4);
  pan.x = clamp(pan.x, 0, mapSize.value - mapSize.value / zoom.value);
  pan.y = clamp(pan.y, 0, mapSize.value - mapSize.value / zoom.value);
}
function resetView(): void {
  zoom.value = 1;
  pan.x = 0;
  pan.y = 0;
}
function wheel(e: WheelEvent): void {
  setZoom(e.deltaY < 0 ? 0.2 : -0.2);
}
function pointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;
  (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  drag.value = { clientX: e.clientX, clientY: e.clientY, x: pan.x, y: pan.y };
}
function pointerMove(e: PointerEvent): void {
  if (!drag.value || !mapElement.value) return;
  const rect = mapElement.value.getBoundingClientRect();
  const visibleSize = mapSize.value / zoom.value;
  const dx = (e.clientX - drag.value.clientX) * (visibleSize / rect.width);
  const dy = (e.clientY - drag.value.clientY) * (visibleSize / rect.height);
  pan.x = clamp(drag.value.x - dx, 0, mapSize.value - visibleSize);
  pan.y = clamp(drag.value.y - dy, 0, mapSize.value - visibleSize);
}
function pointerUp(): void {
  drag.value = null;
}

const xy = (i: number) => ({ x: (i % size.value) * S, y: Math.floor(i / size.value) * S });
const jitter = (i: number, salt: number) => {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h >>> 0) % 1000) / 1000;
};
const cells = computed(() =>
  board.value.map((place, i) => {
    const { x, y } = xy(i);
    return { i, x, y, place, label: `${place.name} — ${LABEL[place.kind]}${place.owner ? ` — ${place.owner}` : " — libre"}` };
  }),
);
const rivers = computed(() => {
  if (!visible.terrain) return "";
  const out: string[] = [];
  board.value.forEach((place, i) => {
    if (place.kind !== "river") return;
    const { x, y } = xy(i);
    const cx = x + S / 2;
    const cy = y + S / 2;
    const right = i % size.value < size.value - 1 ? i + 1 : -1;
    const down = i + size.value < board.value.length ? i + size.value : -1;
    if (right >= 0 && board.value[right]!.kind === "river") out.push(`M${cx},${cy} L${cx + S},${cy}`);
    if (down >= 0 && board.value[down]!.kind === "river") out.push(`M${cx},${cy} L${cx},${cy + S}`);
    out.push(`M${cx - 4},${cy} q4,-3 8,0`);
  });
  return out.join(" ");
});
const frontiers = computed(() =>
  !visible.territory
    ? []
    : props.year.world.civs
        .filter((c) => c.territory > 0)
        .map((civ) => {
          const seg: string[] = [];
          board.value.forEach((place, i) => {
            if (place.owner !== civ.id) return;
            const { x, y } = xy(i);
            const col = i % size.value;
            const row = Math.floor(i / size.value);
            const owns = (c: number, r: number) =>
              c >= 0 && r >= 0 && c < size.value && r < size.value && board.value[r * size.value + c]!.owner === civ.id;
            if (!owns(col, row - 1)) seg.push(`M${x},${y} L${x + S},${y}`);
            if (!owns(col, row + 1)) seg.push(`M${x},${y + S} L${x + S},${y + S}`);
            if (!owns(col - 1, row)) seg.push(`M${x},${y} L${x},${y + S}`);
            if (!owns(col + 1, row)) seg.push(`M${x + S},${y} L${x + S},${y + S}`);
          });
          return { id: civ.id, d: seg.join(" ") };
        }),
);
const towns = computed(() => {
  if (!visible.places) return [];
  const out: Array<{ i: number; x: number; y: number; owner: string; r: number; seat: boolean; name: string }> = [];
  for (const civ of props.year.world.civs) {
    if (civ.territory === 0) continue;
    const perPlace = civ.population / civ.territory;
    const r = Math.max(1.6, Math.min(4.6, Math.sqrt(perPlace) / 3.2));
    board.value.forEach((place, i) => {
      if (place.owner !== civ.id) return;
      const { x, y } = xy(i);
      out.push({ i, x: x + S / 2, y: y + S / 2, owner: civ.id, r, seat: civ.capital === i, name: place.name });
    });
  }
  return out;
});
const neutral = computed(() => board.value.filter((p) => p.owner === null).length);
const held = computed(() => props.year.world.civs.map((c) => ({ id: c.id, n: c.territory, fallen: c.fellOnTick !== null })));
interface MapEntry {
  key: string;
  tick: number;
  civ: string;
  label: string;
  detail: string;
  conflict: boolean;
  diplomacy: boolean;
  advance: boolean;
  loss: boolean;
}
const timelineEntries = computed<MapEntry[]>(() => [
  ...props.year.events.map((event) => ({
    key: `${event.civ}-${event.kind}-${event.detail}`,
    tick: event.tick,
    civ: event.civ,
    label: eventLabel(event),
    detail: event.detail,
    conflict: CONFLICTS.has(event.kind),
    diplomacy: DIPLOMACY.has(event.kind),
    advance: event.kind === "ADVANCE",
    loss: LOSSES.has(event.kind),
  })),
  ...props.year.rulings.map((ruling) => ({
    key: `${ruling.civ}-${ruling.kind}-${ruling.reason}`,
    tick: props.year.tick,
    civ: ruling.civ,
    label: rulingLabel(ruling),
    detail: ruling.reason || "sans justification",
    conflict: false,
    diplomacy: false,
    advance: true,
    loss: false,
  })),
]);
const conflictCount = computed(() => timelineEntries.value.filter((entry) => entry.conflict).length);
const diplomacyCount = computed(() => timelineEntries.value.filter((entry) => entry.diplomacy).length);
const advanceCount = computed(() => timelineEntries.value.filter((entry) => entry.advance).length);
const lossCount = computed(() => timelineEntries.value.filter((entry) => entry.loss).length);
const selected = computed(() => props.year.world.civs.find((civ) => civ.id === selectedCiv.value) ?? null);
const selectedHistory = computed(() => {
  if (!selectedCiv.value) return [];
  return props.years
    .map((year) => ({ tick: year.tick, civ: year.world.civs.find((civ) => civ.id === selectedCiv.value) }))
    .filter((item) => item.civ)
    .filter((_, i, all) => i === 0 || i === all.length - 1 || i % Math.max(1, Math.floor(all.length / 4)) === 0)
    .slice(-6);
});
const latestRuling = computed(() => props.year.rulings.find((ruling) => ruling.civ === selectedCiv.value) ?? null);
function selectCiv(id: string | null): void {
  selectedCiv.value = selectedCiv.value === id ? null : id;
}
function seek(tick: number): void {
  emit("seek", tick);
}
function replayLink(tick: number): string {
  const url = new URL(location.href);
  url.searchParams.set("annee", String(tick));
  url.hash = "world-events";
  return url.toString();
}
function eventLabel(event: TickEvent): string {
  return EVENT_LABEL[event.kind] ?? event.kind.toLowerCase();
}
function rulingLabel(ruling: Ruling): string {
  return `décision · ${ruling.kind.toLowerCase()}`;
}
</script>

<template>
  <figure class="map-card" :data-year-index="index" aria-labelledby="map-title">
    <header class="map-header">
      <div>
        <p class="eyebrow mono">Cartographie du monde · an {{ year.tick }}</p>
        <h3 id="map-title">Territoires vécus, lieux nommés</h3>
      </div>
      <div class="map-tools" role="group" aria-label="Navigation de la carte">
        <button type="button" aria-label="Réduire la carte" @click="setZoom(-0.2)">−</button>
        <output class="mono" aria-live="polite">{{ Math.round(zoom * 100) }} %</output>
        <button type="button" aria-label="Agrandir la carte" @click="setZoom(0.2)">+</button>
        <button type="button" class="reset" @click="resetView">Vue entière</button>
      </div>
    </header>

    <div class="map-layout">
      <div class="viewport">
        <svg
          ref="mapElement"
          :viewBox="viewBox"
          role="img"
          :aria-label="`Carte de ${size} sur ${size} lieux à l'an ${year.tick}. ${held.map((h) => `${h.id} en tient ${h.n}`).join(', ')}. ${neutral} libres.`"
          @wheel.prevent="wheel"
          @pointerdown="pointerDown"
          @pointermove="pointerMove"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @pointerleave="pointerUp"
        >
          <defs>
            <pattern id="forest" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M3,1 L4.6,4.4 L1.4,4.4 Z" fill="#2f6b4f" opacity="0.85" /></pattern>
            <pattern id="hill" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0.6,5 q2.6,-3.2 5.4,0" fill="none" stroke="#7b7568" stroke-width="0.9" /></pattern>
            <pattern id="plain" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,4.6 L6,4.6" stroke="#5d7c3c" stroke-width="0.7" opacity="0.75" /></pattern>
          </defs>
          <g v-for="c in cells" :key="c.i" :class="{ selectable: c.place.owner }" @click="selectCiv(c.place.owner)">
            <rect :x="c.x" :y="c.y" :width="S" :height="S" :fill="visible.terrain ? TERRAIN[c.place.kind] : '#18222a'">
              <title>{{ c.label }}</title>
            </rect>
            <rect v-if="visible.terrain && c.place.kind !== 'river'" :x="c.x" :y="c.y" :width="S" :height="S" :fill="`url(#${c.place.kind})`" :opacity="0.5 + jitter(c.i, 1) * 0.35" pointer-events="none" />
            <rect v-if="visible.territory && c.place.owner" :x="c.x + 1" :y="c.y + 1" :width="S - 2" :height="S - 2" :fill="OWNER[c.place.owner]" opacity="0.13" pointer-events="none" />
          </g>
          <path :d="rivers" class="water" />
          <path v-for="f in frontiers" :key="f.id" :d="f.d" :stroke="OWNER[f.id]" class="frontier" />
          <g v-for="t in towns" :key="`${t.owner}-${t.i}`" class="town" @click.stop="selectCiv(t.owner)">
            <circle :cx="t.x" :cy="t.y" :r="t.r + 1.1" fill="#05070f" opacity="0.65" />
            <circle :cx="t.x" :cy="t.y" :r="t.r" :fill="OWNER[t.owner]" />
            <circle v-if="t.seat" :cx="t.x" :cy="t.y" :r="t.r + 2.6" fill="none" :stroke="OWNER[t.owner]" stroke-width="0.9" />
            <text v-if="t.seat" :x="t.x" :y="t.y - t.r - 4" class="seat-name" text-anchor="middle">{{ t.name }}</text>
            <title>{{ t.seat ? `Capitale ${t.name}` : `Implantation ${t.name}` }} · {{ t.owner }}</title>
          </g>
        </svg>
        <p class="map-hint mono">Molette : zoom · glisser : déplacement · cliquer : civilisation</p>
      </div>

      <aside class="map-side">
        <section class="layers" aria-labelledby="layers-title">
          <h4 id="layers-title">Couches visibles</h4>
          <label v-for="layer in LAYERS" :key="layer.key" class="layer-toggle">
            <input v-model="visible[layer.key]" type="checkbox" />
            <span>{{ layer.label }}</span>
          </label>
        </section>

        <section v-if="selected" class="selected-civ" :class="selected.id" aria-labelledby="selected-title">
          <header>
            <p class="eyebrow mono">Civilisation sélectionnée</p>
            <h4 id="selected-title">{{ selected.id }}</h4>
            <button type="button" class="close" aria-label="Fermer la fiche" @click="selectCiv(null)">Fermer</button>
          </header>
          <dl class="mono stats">
            <div><dt>doctrine</dt><dd>{{ selected.doctrine.posture.toLowerCase() }}</dd></div>
            <div><dt>terres</dt><dd>{{ selected.territory }}</dd></div>
            <div><dt>population</dt><dd>{{ Math.round(selected.population) }}</dd></div>
            <div><dt>soldats</dt><dd>{{ Math.round(selected.soldiers) }}</dd></div>
            <div><dt>vivres</dt><dd>{{ Math.round(selected.stock.food) }}</dd></div>
            <div><dt>richesse</dt><dd>{{ Math.round(selected.stock.wealth) }}</dd></div>
            <div><dt>avancées</dt><dd>{{ selected.advances.length }}</dd></div>
          </dl>
          <p class="mono detail">siège · {{ selected.capital === null ? "aucun" : year.world.board[selected.capital]?.name }}</p>
          <p v-if="latestRuling" class="ruling"><span class="mono">an {{ year.tick }} · {{ rulingLabel(latestRuling) }}</span><br />{{ latestRuling.reason || "sans justification" }}</p>
          <ol class="history mono" aria-label="Historique territorial">
            <li v-for="item in selectedHistory" :key="item.tick"><button type="button" @click="seek(item.tick)">an {{ item.tick }}</button><span>{{ item.civ?.territory ?? 0 }} terres</span></li>
          </ol>
        </section>

        <section v-if="visible.resources" class="resource-summary" aria-labelledby="resources-title">
          <h4 id="resources-title">Réserves du monde</h4>
          <ul class="resource-list mono">
            <li v-for="civ in year.world.civs" :key="civ.id" :class="{ selected: selectedCiv === civ.id }" @click="selectCiv(civ.id)"><span>{{ civ.id }}</span><span>{{ Math.round(civ.stock.food) }} vivres · {{ Math.round(civ.stock.wealth) }} richesse</span></li>
          </ul>
          <p class="contract-note">Le contrat w8 agrège les réserves par civilisation et ne localise ni routes, ni infrastructures, ni armées, ni migrations ; aucun symbole local n'est inventé.</p>
        </section>

        <section v-if="(visible.conflicts && conflictCount) || (visible.diplomacy && diplomacyCount) || (visible.advances && advanceCount) || (visible.losses && lossCount) || (visible.events && timelineEntries.length)" id="world-events" class="event-summary" aria-labelledby="events-title">
          <h4 id="events-title">Preuves de l'an {{ year.tick }}</h4>
          <ul class="event-list">
            <li v-for="entry in timelineEntries.filter((item) => visible.events || (visible.conflicts && item.conflict) || (visible.diplomacy && item.diplomacy) || (visible.advances && item.advance) || (visible.losses && item.loss))" :key="entry.key">
              <button type="button" class="event-jump mono" @click="seek(entry.tick)">an {{ entry.tick }}</button>
              <span><strong>{{ entry.label }}</strong> · {{ entry.civ }}<br />{{ entry.detail }}</span>
              <a :href="replayLink(entry.tick)" :aria-label="`Rejouer l'an ${entry.tick}`">rejouer</a>
            </li>
          </ul>
          <p v-if="visible.advances && advanceCount" class="event-note mono">Les avancées et décisions sont des événements datés, pas des ornements de carte.</p>
        </section>
      </aside>
    </div>

    <figcaption>
      <ul class="legend mono" aria-label="Légende permanente">
        <li v-for="h in held" :key="h.id" :class="[h.id, { fallen: h.fallen }]" @click="selectCiv(h.id)"><span class="swatch"></span>{{ h.id }} <b>{{ h.n }}</b></li>
        <li class="free"><span class="swatch"></span>libres <b>{{ neutral }}</b></li>
        <li class="seat"><span class="ring"></span>siège</li>
        <li class="terrain-key"><span class="texture plain-texture"></span>plaine</li>
        <li class="terrain-key"><span class="texture forest-texture"></span>forêt</li>
        <li class="terrain-key"><span class="texture hill-texture"></span>colline</li>
        <li class="terrain-key"><span class="texture river-texture"></span>fleuve</li>
      </ul>
      <p class="contract-note mono">Source unique : état recomposé du moteur w8 · rendu 2D déterministe · routes et infrastructures absentes du contrat, donc non inventées.</p>
    </figcaption>
  </figure>
</template>

<style scoped>
.map-card { margin: 0; display: flex; flex-direction: column; gap: var(--s3); }
.map-header { display: flex; align-items: end; justify-content: space-between; gap: var(--s3); }
.eyebrow { margin: 0 0 var(--s2); color: var(--accent); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
h3, h4 { margin: 0; }
h3 { font-family: var(--display); font-size: clamp(22px, 3vw, 34px); font-weight: 400; }
.map-tools { display: flex; align-items: center; gap: 2px; }
.map-tools output { min-width: 4.5ch; color: var(--muted); text-align: center; font-size: 11px; }
.map-tools button { min-width: 40px; padding-inline: var(--s2); }
.map-tools .reset { margin-left: var(--s2); font-size: 11px; }
.map-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, .36fr); gap: var(--s4); align-items: start; }
.viewport { min-width: 0; overflow: hidden; background: #0a1020; border: 1px solid var(--map-border); border-radius: var(--radius); box-shadow: 0 24px 80px #0007; }
svg { width: 100%; height: auto; min-height: 360px; display: block; cursor: grab; touch-action: none; }
svg:active { cursor: grabbing; }
.selectable { cursor: pointer; }
.town { cursor: pointer; }
.water { fill: none; stroke: #5fbdea; stroke-width: 1.6; stroke-linecap: round; opacity: .75; pointer-events: none; }
.frontier { fill: none; stroke-width: 1.8; stroke-linecap: round; pointer-events: none; }
.seat-name { fill: var(--fg); font-size: 4.4px; font-family: var(--mono); paint-order: stroke; stroke: #05070f; stroke-width: 1.4; pointer-events: none; }
.map-hint { margin: 0; padding: var(--s2) var(--s3); color: var(--muted); font-size: 10px; border-top: 1px solid var(--border-soft); }
.map-side { display: flex; flex-direction: column; gap: var(--s3); min-width: 0; }
.layers, .selected-civ, .resource-summary, .event-summary { padding: var(--s3); border: 1px solid var(--border-soft); background: var(--card); }
.layers h4, .resource-summary h4, .event-summary h4 { margin-bottom: var(--s2); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.layer-toggle { display: flex; align-items: center; gap: var(--s2); min-height: 32px; color: var(--fg); font-size: 12px; }
.layer-toggle input { accent-color: var(--accent); width: 16px; height: 16px; }
.selected-civ { border-left: 3px solid var(--border); }
.selected-civ.crimson { border-left-color: var(--crimson); }
.selected-civ.azure { border-left-color: var(--azure); }
.selected-civ.verdant { border-left-color: var(--verdant); }
.selected-civ.amber { border-left-color: var(--amber); }
.selected-civ header { position: relative; }
.selected-civ h4 { font-family: var(--display); font-size: 27px; font-weight: 400; text-transform: capitalize; }
.close { position: absolute; right: 0; top: 0; min-height: 30px; padding: 2px var(--s2); font-size: 10px; background: transparent; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s1) var(--s3); margin: var(--s3) 0 0; font-size: 11px; }
.stats div { display: flex; justify-content: space-between; gap: var(--s2); border-bottom: 1px solid var(--border-soft); }
.stats dt, .detail { color: var(--muted); }
.stats dd { margin: 0; }
.detail { margin: var(--s3) 0 0; font-size: 10px; }
.ruling { margin: var(--s3) 0 0; padding-left: var(--s2); border-left: 2px solid var(--accent); font-size: 12px; }
.ruling .mono { color: var(--accent); font-size: 10px; }
.history { display: grid; gap: 2px; list-style: none; margin: var(--s3) 0 0; padding: 0; font-size: 10px; }
.history li { display: flex; align-items: center; justify-content: space-between; gap: var(--s2); }
.history button { min-height: 28px; padding: 2px var(--s2); color: var(--muted); background: transparent; border-color: transparent; font-size: 10px; }
.resource-list, .event-list { display: grid; gap: 2px; list-style: none; margin: 0; padding: 0; }
.resource-list li { display: flex; justify-content: space-between; gap: var(--s2); padding: 5px 0; border-bottom: 1px solid var(--border-soft); color: var(--muted); font-size: 10px; cursor: pointer; }
.resource-list li.selected { color: var(--accent); }
.resource-list li span:first-child { color: var(--fg); text-transform: capitalize; }
.event-list li { display: grid; grid-template-columns: 4.3rem minmax(0, 1fr); gap: var(--s2); align-items: start; padding: var(--s2) 0; border-bottom: 1px solid var(--border-soft); font-size: 11px; }
.event-list strong { color: var(--accent); font-family: var(--mono); font-size: 10px; text-transform: uppercase; }
.event-list a { grid-column: 2; color: var(--accent); font-size: 10px; text-underline-offset: 3px; }
.event-jump { min-height: 28px; padding: 2px; color: var(--muted); background: transparent; border-color: var(--border-soft); font-size: 10px; }
.event-note, .contract-note { margin: var(--s3) 0 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
.legend { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); list-style: none; margin: 0; padding: 0; color: var(--muted); font-size: 11px; }
.legend li { display: flex; align-items: center; gap: var(--s2); text-transform: capitalize; cursor: pointer; }
.legend b { color: var(--fg); }
.legend .fallen { opacity: .45; }
.swatch { width: 10px; height: 10px; border: 2px solid var(--border); border-radius: 2px; }
.legend .crimson .swatch { border-color: var(--crimson); background: color-mix(in srgb, var(--crimson) 25%, transparent); }
.legend .azure .swatch { border-color: var(--azure); background: color-mix(in srgb, var(--azure) 25%, transparent); }
.legend .verdant .swatch { border-color: var(--verdant); background: color-mix(in srgb, var(--verdant) 25%, transparent); }
.legend .amber .swatch { border-color: var(--amber); background: color-mix(in srgb, var(--amber) 25%, transparent); }
.legend .free .swatch { border-color: transparent; background: #46612c; }
.ring { width: 10px; height: 10px; border: 1.5px solid var(--muted); border-radius: 50%; }
.texture { width: 16px; height: 10px; border: 1px solid var(--border); }
.plain-texture { background: repeating-linear-gradient(0deg, #a3e635 0 1px, #46612c 1px 4px); }
.forest-texture { background: repeating-conic-gradient(#34d399 0 25%, #1f4a37 0 50%) 50% / 6px 6px; }
.hill-texture { background: repeating-radial-gradient(ellipse at bottom, #a8a29e 0 1px, #5b564e 1px 4px); }
.river-texture { background: #38bdf8; }
@media (max-width: 920px) { .map-layout { grid-template-columns: 1fr; } .map-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } .event-summary { grid-column: 1 / -1; } }
@media (max-width: 600px) { .map-header { align-items: start; flex-direction: column; } .map-tools { width: 100%; } .map-tools button { flex: 1; } svg { min-height: 280px; } .map-side { display: flex; } }
@media (prefers-reduced-motion: reduce) { svg { scroll-behavior: auto; } }
</style>
