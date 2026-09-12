<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import type { FactionId } from "@abs/contracts";
import type { Year } from "@abs/world";
import WorldDiorama from "./WorldDiorama.vue";
import { CIV_COLORS, projectWorld } from "../three/world-projection";
const props = defineProps<{ years: Year[]; index: number; turningTick?: number | null }>();
const emit = defineEmits<{ seek: [number]; select: [FactionId] }>();
const year = computed(() => props.years[Math.min(props.index, props.years.length - 1)]!);
const parcels = computed(() => projectWorld(year.value, props.years));
const living = computed(() => year.value.world.civs.filter((civ) => civ.fellOnTick === null).length);
const population = computed(() => year.value.world.civs.reduce((sum, civ) => sum + civ.population, 0));
const selected = ref<FactionId | null>(null);
const selectedCiv = computed(() => year.value.world.civs.find((civ) => civ.id === selected.value));
const selectedCities = computed(() => year.value.world.simulation?.cities.filter(c => c.owner === selected.value) ?? []);
const selectedRelations = computed(() => year.value.world.simulation?.relations.filter(r => r.a === selected.value || r.b === selected.value) ?? []);
const buildings = {granary:'Grenier',workshop:'Atelier',market:'Marché',walls:'Remparts',academy:'Académie'};
const focuses = {balanced:'Équilibre',growth:'Croissance',industry:'Industrie',science:'Recherche',military:'Défense'};
const latestRuling = computed(() => {
  if (!selected.value) return null;
  for (let i = props.index; i >= 0; i--) {
    const ruling = props.years[i]?.rulings.find((r) => r.civ === selected.value);
    if (ruling) return ruling;
  }
  return null;
});
const playing = ref(false), speed = ref(4);
const SPEEDS = [1, 4, 12, 40] as const;
let timer: number | undefined;
const step = () => {
  if (props.index >= props.years.length - 1) { playing.value = false; return; }
  emit("seek", props.index + 1);
};
function togglePlay() {
  if (!playing.value && props.index >= props.years.length - 1) emit("seek", 0);
  playing.value = !playing.value;
}
watch([playing, speed], () => {
  clearInterval(timer);
  if (playing.value) timer = window.setInterval(step, 1000 / speed.value);
});
onUnmounted(() => clearInterval(timer));
const format = (number: number) => Math.round(number).toLocaleString("fr-FR");
</script>
<template>
  <section class="stage" aria-labelledby="world-year">
    <header class="atlas-heading">
      <div class="atlas-title"><p>Atlas des civilisations</p><h2>Le temps façonne les royaumes.</h2><span>Explorez leurs terres. Remontez le fil de leur histoire.</span></div>
      <div class="year-stamp"><span>Année observée</span><h3 id="world-year">{{ year.tick.toString().padStart(3, '0') }}</h3></div>
    </header>
    <div class="world-frame">
      <div class="world-summary"><span><i></i>{{ living }} {{ living === 1 ? 'civilisation vivante' : 'civilisations vivantes' }}</span><span>{{ format(population) }} habitants</span><span>{{ year.world.board.length }} lieux</span></div>
      <WorldDiorama :year="year" :parcels="parcels" :selected="selected" @select="selected = $event" />
      <aside v-if="selectedCiv" class="territory-card" :style="{ '--civ-color': CIV_COLORS[selectedCiv.id] }" aria-label="Civilisation sur la carte">
        <button class="dismiss" aria-label="Fermer la sélection" @click="selected = null">×</button>
        <p>{{ selectedCiv.fellOnTick === null ? 'Civilisation' : 'Civilisation éteinte' }}</p><h3>{{ selectedCiv.id }}</h3>
        <dl><div><dt>Habitants</dt><dd>{{ format(selectedCiv.population) }}</dd></div><div><dt>Territoire</dt><dd>{{ selectedCiv.territory }} lieux</dd></div><div><dt>Soldats</dt><dd>{{ format(selectedCiv.soldiers) }}</dd></div><div><dt>Progrès</dt><dd>{{ selectedCiv.advances.length }}</dd></div></dl>
        <div v-if="year.world.simulation" class="development">
          <p>{{ selectedCities.length }} villes · {{ focuses[selectedCiv.doctrine.focus ?? 'balanced'] }}</p>
          <p>{{ format(selectedCiv.science ?? 0) }} points de recherche</p>
          <ul><li v-for="city in selectedCities" :key="city.id"><strong>{{ year.world.board[city.position]?.name }}</strong><span>{{ city.queue ? `${buildings[city.queue.building]} · ${city.queue.remaining} ans` : `${city.buildings.length} bâtiments achevés` }}</span></li></ul>
          <p v-for="r in selectedRelations" :key="`${r.a}-${r.b}`">{{ r.a === selected ? r.b : r.a }} · {{ r.status === 'war' ? 'Guerre' : r.status === 'trade' ? 'Commerce' : r.truceUntil > year.tick ? 'Trêve' : 'Paix' }}</p>
        </div>
        <blockquote v-if="latestRuling?.reason">« {{ latestRuling.reason }} »</blockquote><p v-else class="no-ruling">Aucune décision enregistrée à cette date.</p>
        <button class="open-profile" @click="emit('select', selectedCiv.id)">Lire son histoire</button>
      </aside>
      <div class="faction-rail" role="group" aria-label="Sélectionner une civilisation sur la carte">
        <button v-for="civ in year.world.civs" :key="civ.id" :aria-pressed="selected === civ.id" :class="{ fallen: civ.fellOnTick !== null }" :style="{ '--civ-color': CIV_COLORS[civ.id] }" @click="selected = selected === civ.id ? null : civ.id">
          <span class="faction-mark" aria-hidden="true">{{ civ.id.slice(0, 2) }}</span><span class="faction-name">{{ civ.id }}<small>{{ civ.fellOnTick === null ? `${civ.territory} lieux` : `Éteinte en ${civ.fellOnTick}` }}</small></span><span class="faction-pop">{{ format(civ.population) }}<small>habitants</small></span>
        </button>
      </div>
    </div>
    <div class="timeline">
      <div class="timeline-title"><span>Le fil de l'ère</span><p>{{ index === years.length - 1 ? 'Vous observez la dernière année enregistrée.' : `Vous explorez l’histoire à l’an ${year.tick}.` }}</p></div>
      <div class="playback"><button class="play" :aria-pressed="playing" @click="togglePlay"><span aria-hidden="true">{{ playing ? 'Ⅱ' : '▷' }}</span>{{ playing ? 'Mettre en pause' : index === years.length - 1 ? 'Revivre cette ère' : 'Dérouler les années' }}</button><div class="speeds" role="group" aria-label="Vitesse de lecture"><button v-for="s in SPEEDS" :key="s" :aria-pressed="speed === s" :aria-label="`${s} années par seconde`" @click="speed = s">×{{ s }}</button></div></div>
      <label class="scrub"><span class="visually-hidden">Parcourir les années de l'ère</span><span class="first-year">{{ years[0]?.tick }}</span><input type="range" min="0" :max="years.length - 1" :value="index" :aria-valuetext="`an ${year.tick}`" @input="emit('seek', Number(($event.target as HTMLInputElement).value))"/><output>{{ years.at(-1)?.tick }}</output></label>
      <div class="timeline-foot"><p>{{ year.world.simulation ? 'Villes et unités persistantes. Une figurine militaire représente une formation ; positions et missions calculées par le moteur.' : 'Figurines représentatives des armées et métiers : leur nombre et leur placement sont schématiques. Effectifs et territoires issus du journal.' }}</p><div><button v-if="turningTick != null" @click="emit('seek', years.findIndex(y => y.tick === turningTick))">Dernier tournant</button><button :disabled="index === years.length - 1" @click="emit('seek', years.length - 1)">Dernière année</button></div></div>
    </div>
  </section>
</template>
<style scoped>
.stage { min-width: 0; }
.atlas-heading { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 16px 0 28px; }
.atlas-title > p { margin: 0 0 8px; color: #d5b98f; font-size: 13px; }
.atlas-title h2 { font: 400 clamp(28px, 3.8vw, 48px)/1.15 var(--display); letter-spacing: -.025em; color: #f1ede3; }
.atlas-title > span { display: block; margin-top: 12px; color: #9cafb6; font-size: 13px; }
.year-stamp { padding-left: 30px; border-left: 1px solid #78929c35; text-align: right; flex-shrink: 0; }
.year-stamp > span { color: #a1b4b9; font-size: 11px; }
.year-stamp h3 { font: 400 clamp(44px, 5vw, 72px)/1 var(--display); color: #dbc395; font-variant-numeric: tabular-nums; }
.world-frame { position: relative; border: 1px solid #718b9240; border-radius: 10px; overflow: hidden; box-shadow: 0 25px 80px #0004; }
.world-summary { position: absolute; top: 28px; left: 28px; z-index: 1; display: flex; gap: 18px; color: #b5c7c7; font-size: 11px; pointer-events: none; }
.world-summary span:first-child { color: #e1e6d9; }
.world-summary i { display: inline-block; width: 6px; height: 6px; background: #a5be95; border-radius: 50%; margin-right: 7px; }
.faction-rail { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); background: #101e28; border-top: 1px solid #72899230; }
.faction-rail > button { min-width: 0; display: flex; align-items: center; gap: 12px; padding: 20px 24px; border: 0; border-radius: 0; border-right: 1px solid #72899225; background: transparent; text-align: left; position: relative; }
.faction-rail > button:last-child { border-right: 0; }
.faction-rail > button::before { content: ''; position: absolute; height: 2px; background: var(--civ-color); top: 0; inset-inline: 24px; opacity: .45; }
.faction-rail > button[aria-pressed=true] { background: #243741; }
.faction-rail > button[aria-pressed=true]::before { opacity: 1; }
.faction-mark { display: grid; place-items: center; width: 34px; height: 40px; border: 1px solid color-mix(in srgb,var(--civ-color),transparent 55%); color: var(--civ-color); font: 17px var(--display); border-radius: 3px 3px 14px 14px; flex-shrink: 0; }
.faction-name { text-transform: capitalize; font: 20px var(--display); color: var(--civ-color); }
.faction-rail small { display: block; color: #99adb3; font: 10px var(--sans); margin-top: 4px; text-transform: none; }
.faction-pop { margin-left: auto; font: 20px var(--display); color: #e8e6d9; text-align: right; }
.fallen .faction-mark { opacity: .5; }
.territory-card { position: absolute; top: 92px; left: 24px; width: 220px; padding: 22px; background: #0b1822f5; border: 1px solid #8baba540; border-top: 2px solid var(--civ-color); border-radius: 5px; z-index: 2; box-shadow: 0 15px 40px #0003; }
.territory-card > p { margin: 0; font-size: 11px; color: #a3b5ba; }
.territory-card h3 { margin: 7px 0 20px; color: var(--civ-color); text-transform: capitalize; font: 32px var(--display); }
.dismiss { position: absolute; top: 8px; right: 8px; background: transparent; border: 0; min-width: 32px; min-height: 32px; padding: 0; font-size: 22px; }
.territory-card dl { margin: 0; display: grid; gap: 9px; }
.territory-card dl > div { display: flex; justify-content: space-between; font-size: 12px; }
.territory-card dt { color: #a3b5ba; }
.territory-card dd { margin: 0; color: #ede8da; }
.territory-card blockquote { margin: 18px 0; color: #cbcec2; font: italic 15px/1.5 var(--display); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.territory-card .no-ruling { margin-top: 18px; }
.development { margin-top: 15px; color: #b5c7c7; font-size: 11px; }
.development p { margin: 6px 0; }
.development ul { max-height: 100px; overflow: auto; list-style: none; margin: 10px 0; padding: 0; }
.development li { margin-bottom: 9px; }
.development li span { display: block; margin-top: 3px; color: #d9bd8c; }
.open-profile { width: 100%; font-size: 11px; background: #20343d; border-color: #56717b; margin-top: 15px; }
.timeline { padding: 24px 0 22px; display: grid; grid-template-columns: 1fr auto; gap: 15px 24px; border-bottom: 1px solid #72899230; }
.timeline-title > span { font: 22px var(--display); color: #ece4d3; }
.timeline-title p { margin: 5px 0 0; color: #9cafb6; font-size: 11px; }
.playback,.speeds { display: flex; align-items: center; gap: 4px; }
.playback { gap: 18px; }
.play { background: #d4bb8d; border-color: #d4bb8d; color: #17242a; font-size: 12px; min-height: 42px; padding: 8px 17px; }
.play span { font-size: 18px; padding-right: 9px; }
.speeds button { background: transparent; border: 0; font-size: 11px; padding: 8px; min-width: 35px; min-height: 40px; color: #a0b3bb; }
.speeds button[aria-pressed=true] { color: #efd9ae; background: #27343b; }
.scrub { grid-column: 1/-1; display: flex; align-items: center; gap: 16px; font: 12px var(--mono); color: #b8c7c8; }
.scrub input { width: 100%; min-width: 0; min-height: 36px; accent-color: #d7bf91; cursor: pointer; }
.timeline-foot { grid-column: 1/-1; display: flex; justify-content: space-between; align-items: center; gap: 15px; }
.timeline-foot p { margin: 0; font-size: 10px; color: #8ca3ad; }
.timeline-foot > div { display: flex; gap: 10px; flex-shrink: 0; }
.timeline-foot button { padding: 3px 0; min-height: 32px; border: 0; background: transparent; font-size: 10px; color: #bcc7c6; }
@media(max-width: 1000px) {
  .faction-rail > button { padding: 17px 14px; gap: 9px; }
  .faction-pop { display: none; }
  .world-summary { gap: 10px; left: 20px; }
  .world-summary span:not(:first-child) { display: none; }
}
@media(max-width: 650px) {
  .atlas-heading { gap: 12px; padding: 8px 0 20px; align-items: end; }
  .atlas-title > p { font-size: 11px; }
  .atlas-title h2 { font-size: 30px; max-width: 9em; }
  .atlas-title > span { display: none; }
  .year-stamp { padding-left: 12px; }
  .year-stamp > span { font-size: 9px; }
  .world-summary { top: 70px; left: 18px; font-size: 10px; }
  .faction-rail { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .faction-rail > button { border-bottom: 1px solid #72899225; padding: 12px; }
  .faction-rail > button::before { inset-inline: 12px; }
  .faction-name { font-size: 18px; }
  .faction-mark { width: 27px; height: 32px; font-size: 14px; }
  .territory-card { position: relative; top: auto; left: auto; width: auto; margin: 0; border-radius: 0; box-shadow: none; padding: 16px 20px; }
  .territory-card h3 { font-size: 25px; margin-bottom: 12px; }
  .territory-card dl { display: flex; justify-content: space-between; }
  .territory-card dl > div { display: block; }
  .territory-card blockquote { -webkit-line-clamp: 2; }
  .timeline { grid-template-columns: 1fr; gap: 14px; padding-top: 20px; }
  .playback { justify-content: space-between; gap: 8px; }
  .timeline-title p { font-size: 10px; }
  .timeline-foot { align-items: start; flex-direction: column; gap: 4px; }
}
</style>
