<script setup lang="ts">
import { computed } from "vue";
import type { Ruling, TickEvent, Year } from "@abs/world";

/**
 * A readable observation window over the deterministic chronicle.
 *
 * The journal does not contain a model-written narration. The sentence shown in
 * this component is therefore deliberately labelled as derived: it is a small
 * deterministic editorial aid, never evidence. Facts and rulings remain next
 * to it so a reader can inspect the replay instead of trusting prose.
 */
const EPISODE_LENGTH = 7;

const props = defineProps<{
  years: Year[];
  worldVersion: string;
  seed: number;
  fingerprint?: string | null;
}>();

const emit = defineEmits<{ seek: [number] }>();

interface ObservationEpisode {
  number: number;
  from: number;
  to: number;
  years: Year[];
  facts: Array<{ tick: number; civ: string; kind: string; detail: string }>;
  decisions: Array<{ tick: number; ruling: Ruling }>;
  narration: string;
}

const FACT_LABEL: Record<string, string> = {
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

function describeFacts(facts: ObservationEpisode["facts"], decisions: ObservationEpisode["decisions"], from: number, to: number): string {
  const counts = new Map<string, number>();
  for (const fact of facts) counts.set(fact.kind, (counts.get(fact.kind) ?? 0) + 1);
  const notable = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `${count} ${kind}${count > 1 ? "s" : ""}`)
    .join(", ");
  const factSentence = notable ? `Le moteur a inscrit ${notable}.` : "Le moteur n'a inscrit aucun événement notable.";
  const decisionSentence = decisions.length
    ? `${decisions.length} décision${decisions.length > 1 ? "s" : ""} de dirigeant${decisions.length > 1 ? "s" : ""} figure${decisions.length > 1 ? "nt" : ""} dans le journal.`
    : "Aucune décision de dirigeant n'est inscrite dans cette fenêtre.";
  return `Entre les années ${from} et ${to}, ${factSentence} ${decisionSentence}`;
}

const episodes = computed<ObservationEpisode[]>(() => {
  const output: ObservationEpisode[] = [];
  for (let start = 0; start < props.years.length; start += EPISODE_LENGTH) {
    const years = props.years.slice(start, start + EPISODE_LENGTH);
    const facts = years.flatMap((year) =>
      year.events.map((event: TickEvent) => ({
        tick: year.tick,
        civ: event.civ,
        kind: FACT_LABEL[event.kind] ?? event.kind.toLowerCase(),
        detail: event.detail,
      })),
    );
    const decisions = years.flatMap((year) => year.rulings.map((ruling) => ({ tick: year.tick, ruling })));
    const from = years[0]?.tick ?? 0;
    const to = years.at(-1)?.tick ?? from;
    output.push({
      number: output.length + 1,
      from,
      to,
      years,
      facts,
      decisions,
      narration: describeFacts(facts, decisions, from, to),
    });
  }
  return output;
});

function replayLink(tick: number): string {
  const url = new URL(location.href);
  url.searchParams.set("annee", String(tick));
  url.hash = "replay-proof";
  return url.toString();
}

function seek(tick: number): void {
  emit("seek", tick);
}
</script>

<template>
  <section class="episodes" aria-labelledby="episodes-title">
    <header class="section-heading">
      <p class="eyebrow mono">Observation · fenêtres de {{ EPISODE_LENGTH }} années</p>
      <div class="episodes-heading">
        <div>
          <h2 id="episodes-title">Épisodes de la chronique</h2>
          <p class="intro">Chaque épisode rapproche la situation, les décisions et les conséquences sans les confondre.</p>
        </div>
        <dl class="provenance mono" id="replay-proof">
          <div><dt>source</dt><dd>rejeu local du journal</dd></div>
          <div><dt>règles</dt><dd>{{ worldVersion }}</dd></div>
          <div><dt>graine</dt><dd>{{ seed }}</dd></div>
          <div><dt>empreinte</dt><dd>{{ fingerprint ?? "non enregistrée" }}</dd></div>
        </dl>
      </div>
    </header>

    <ol class="episode-list">
      <li v-for="episode in episodes" :key="episode.number" class="episode" :id="`episode-${episode.number}`">
        <header class="episode-header">
          <p class="mono eyebrow">Épisode {{ String(episode.number).padStart(2, "0") }}</p>
          <p class="mono range">an {{ episode.from }} → {{ episode.to }}</p>
        </header>

        <p class="narration"><span class="label mono">Narration dérivée</span>{{ episode.narration }}</p>

        <div class="episode-columns">
          <section class="episode-column engine" :aria-labelledby="`engine-facts-${episode.number}`">
            <h3 :id="`engine-facts-${episode.number}`"><span class="marker">01</span> Faits du moteur</h3>
            <ul v-if="episode.facts.length" class="facts">
              <li v-for="(fact, index) in episode.facts" :key="`${fact.tick}-${fact.kind}-${index}`">
                <button type="button" class="tick mono" @click="seek(fact.tick)">an {{ fact.tick }}</button>
                <span><strong>{{ fact.kind }}</strong> · {{ fact.civ }} · {{ fact.detail }}</span>
              </li>
            </ul>
            <p v-else class="muted">Aucun événement notable n'a été écrit.</p>
          </section>

          <section class="episode-column model" :aria-labelledby="`model-decisions-${episode.number}`">
            <h3 :id="`model-decisions-${episode.number}`"><span class="marker">02</span> Décisions et provenance</h3>
            <ul v-if="episode.decisions.length" class="decisions">
              <li v-for="item in episode.decisions" :key="item.ruling.tick + '-' + item.ruling.civ + '-' + item.ruling.kind">
                <button type="button" class="tick mono" @click="seek(item.tick)">an {{ item.tick }}</button>
                <span>
                  <strong>{{ item.ruling.civ }}</strong> · {{ item.ruling.kind.toLowerCase() }}
                  <span class="served mono"> · servi : {{ item.ruling.model ?? "aucun appel modèle" }}</span>
                  <br /><q>{{ item.ruling.reason || "sans justification" }}</q>
                </span>
              </li>
            </ul>
            <p v-else class="muted">Le moteur a continué sans consulter de modèle.</p>
          </section>
        </div>

        <footer class="episode-footer">
          <span class="mono proof-label">Preuve</span>
          <a :href="replayLink(episode.from)">Rejouer l'épisode depuis l'an {{ episode.from }}</a>
          <span class="mono proof-note">journal {{ worldVersion }} · années {{ episode.from }}–{{ episode.to }}</span>
        </footer>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.episodes {
  padding: clamp(var(--s6), 7vw, 88px) 0;
  border-bottom: 1px solid var(--border);
}

.section-heading {
  margin-bottom: var(--s6);
}

.eyebrow {
  margin: 0 0 var(--s2);
  color: var(--accent);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.episodes-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.7fr);
  gap: var(--s6);
  align-items: end;
}

h2 {
  max-width: 18ch;
  font-family: var(--display);
  font-size: clamp(32px, 5vw, 62px);
  font-weight: 400;
  line-height: 1;
}

.intro {
  max-width: 48ch;
  margin: var(--s3) 0 0;
  color: var(--muted);
}

.provenance {
  margin: 0;
  padding: var(--s3) 0 0;
  border-top: 1px solid var(--border-soft);
  font-size: 10px;
}

.provenance div {
  display: grid;
  grid-template-columns: 7ch 1fr;
  gap: var(--s3);
  padding: 3px 0;
}

.provenance dt {
  color: var(--muted);
  text-transform: uppercase;
}

.provenance dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.episode-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--border-soft);
}

.episode {
  padding: var(--s5) 0;
  border-bottom: 1px solid var(--border-soft);
}

.episode-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
}

.episode-header .eyebrow {
  margin: 0;
}

.range {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
}

.narration {
  max-width: 74ch;
  margin: var(--s4) 0 0;
  font-family: var(--display);
  font-size: 18px;
  line-height: 1.45;
}

.label,
.proof-label {
  display: block;
  margin-bottom: var(--s2);
  color: var(--accent);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.episode-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s5);
  margin-top: var(--s5);
}

.episode-column {
  min-width: 0;
  padding-top: var(--s3);
  border-top: 1px solid var(--border-soft);
}

.episode-column.model {
  border-top-color: var(--accent-dim);
}

h3 {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  margin: 0 0 var(--s3);
  font-family: var(--display);
  font-size: 19px;
  font-weight: 400;
}

.marker {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 10px;
}

.facts,
.decisions {
  display: grid;
  gap: var(--s2);
  list-style: none;
  padding: 0;
  margin: 0;
}

.facts li,
.decisions li {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: var(--s2);
  align-items: start;
  font-size: 13px;
}

.tick {
  min-width: 0;
  min-height: 32px;
  padding: 2px var(--s2);
  color: var(--muted);
  background: transparent;
  border-color: var(--border-soft);
  font-size: 10px;
  text-align: left;
}

.facts strong,
.decisions strong {
  color: var(--accent);
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.decisions q {
  display: inline-block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.served {
  color: var(--muted);
  font-size: 10px;
}

.muted {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.episode-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
  margin-top: var(--s5);
  padding-top: var(--s3);
  border-top: 1px solid var(--border-soft);
  font-size: 12px;
}

.episode-footer .proof-label {
  display: inline;
  margin: 0;
}

.episode-footer a {
  color: var(--accent);
  text-underline-offset: 3px;
}

.proof-note {
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 760px) {
  .episodes-heading,
  .episode-columns {
    grid-template-columns: 1fr;
  }

  .episodes-heading {
    gap: var(--s5);
  }
}

@media (max-width: 480px) {
  .episode-header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--s1);
  }

  .facts li,
  .decisions li {
    grid-template-columns: 4rem minmax(0, 1fr);
  }
}
</style>
