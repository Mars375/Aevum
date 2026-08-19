<script setup lang="ts">
/**
 * What a reader is looking at, before any chart.
 *
 * The chronicle used to open on four coloured lines and no words: someone
 * arriving knew neither what they were seeing nor why four models were
 * governing civilisations. This answers the question in the time it takes to
 * scroll past it, and gets out of the way — it is not a landing page in front
 * of the product, it is the first paragraph of it.
 */
defineProps<{ era: number; years: number; rulings: number; alive: number }>();
</script>

<template>
  <section class="intro card">
    <div class="prose">
      <p class="mono kicker">Quatre modèles de langage gouvernent quatre civilisations</p>
      <p class="one">
      Un moteur déterministe fait vivre le monde année après année, gratuitement. Un modèle n'est
      consulté que lorsque l'état dépasse ce que sa doctrine sait résoudre — famine, catastrophe,
      frontière fermée. Environ une fois tous les quinze ans, pas à chaque année.
    </p>
    <p class="two">
      Ce qui évolue n'est pas le modèle : ses poids ne changent pas entre deux appels. C'est la
      <strong>doctrine héritée</strong> — un credo que chaque dirigeant écrit sur sa civilisation et
      transmet à ses successeurs, et parfois un serment que le moteur vérifie chaque année.
      </p>
      <p class="mono note">
        Rien de tout ceci n'est calculé sur un serveur : votre navigateur rejoue le journal avec le
        moteur qui l'a vécu. Le monde avance d'une quarantaine d'années chaque nuit.
      </p>
    </div>

    <dl class="facts mono">
      <div><dt>ère</dt><dd>{{ era }}</dd></div>
      <div><dt>années vécues</dt><dd>{{ years }}</dd></div>
      <div><dt>décisions prises</dt><dd>{{ rulings }}</dd></div>
      <div><dt>civilisations en vie</dt><dd>{{ alive }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.intro {
  display: grid;
  /* The prose keeps its reading measure; the counters take the room that would
     otherwise sit empty beside it on a wide screen. */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s4);
}

@media (min-width: 900px) {
  .intro {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--s6);
    align-items: start;
  }
}

.prose {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  max-width: 68ch;
}

.kicker {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.one,
.two {
  margin: 0;
  max-width: 68ch;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--fg);
}

.two {
  color: var(--muted);
}

.two strong {
  color: var(--fg);
  font-weight: 600;
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s5);
  margin: 0;
  padding-top: var(--s3);
  border-top: 1px solid var(--border-soft);
}

.facts > div {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
}

@media (min-width: 900px) {
  .facts {
    flex-direction: column;
    align-items: flex-end;
    gap: var(--s3);
    padding-top: 0;
    padding-left: var(--s5);
    border-top: 0;
    border-left: 1px solid var(--border-soft);
    min-width: 15rem;
  }

  .facts > div {
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }

  .facts dd {
    font-size: 26px;
    line-height: 1.1;
  }
}

.facts dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.facts dd {
  margin: 0;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  max-width: 68ch;
}
</style>
