<script setup lang="ts">
/**
 * Les règles, mises de côté.
 *
 * Elles ouvraient la chronique, et repoussaient la carte sous la ligne de
 * flottaison : quelqu'un qui arrive doit voir le monde, pas en lire la notice.
 * Elles restent à une clic, pour qui veut savoir ce qu'il regarde.
 */
</script>

<template>
  <div class="rules">
    <section class="card">
      <p class="mono kicker">Quatre modèles de langage gouvernent quatre civilisations</p>
      <h2>Ce que vous regardez</h2>
      <p>
        Un moteur déterministe fait vivre le monde année après année, gratuitement. Un modèle n'est
        consulté que lorsque l'état dépasse ce que sa doctrine sait résoudre — famine, catastrophe,
        frontière fermée. Environ une fois tous les quinze ans, pas à chaque année.
      </p>
      <p>
        Ce qui évolue n'est pas le modèle : ses poids ne changent pas entre deux appels. C'est la
        <strong>doctrine héritée</strong> — un credo que chaque dirigeant écrit sur sa civilisation
        et transmet à ses successeurs, et parfois un serment que le moteur vérifie chaque année.
      </p>
      <p class="mono note">
        Rien n'est calculé sur un serveur : votre navigateur rejoue le journal avec le moteur qui
        l'a vécu. Le monde avance d'une quarantaine d'années chaque nuit.
      </p>
    </section>

    <section class="card">
      <h2>La terre</h2>
      <p>
        Le monde est un plateau de 81 lieux. Chacun existe en propre, <strong>commence libre</strong>,
        et a des voisins — on n'occupe qu'un lieu libre que l'on borde, et on ne prend à un voisin
        que ce que l'on borde réellement.
      </p>
      <div class="scroll">
        <table>
          <thead><tr><th>type</th><th>porte</th><th>rareté</th></tr></thead>
          <tbody>
            <tr><td>plaine</td><td>l'agriculture</td><td>commune</td></tr>
            <tr><td>forêt</td><td>la sylviculture</td><td>fréquente</td></tr>
            <tr><td>colline</td><td>la mine</td><td>peu commune</td></tr>
            <tr><td>fleuve</td><td>le commerce, <em>et arrose les champs</em></td><td>rare</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Une parcelle porte environ 25 travailleurs. Au-delà, les gens en trop ne produisent presque
        rien — mais jamais <em>rien</em> : un sol ingrat est un handicap, pas une impasse.
      </p>
    </section>

    <section class="card">
      <h2>Ce qu'un dirigeant décide</h2>
      <ul>
        <li><strong>La répartition du travail</strong> — champs, forêts, mines, commerce, armée.</li>
        <li><strong>La terre convoitée</strong> — ce qu'on prend quand une frontière s'ouvre.</li>
        <li>
          <strong>La posture</strong> — <em>commerce</em> enrichit mais seulement si un voisin
          commerce aussi ; <em>garde</em> ne prend rien et rend cher à attaquer ;
          <em>pression</em> prend par la force, et coûte des soldats même quand elle réussit.
        </li>
        <li>
          <strong>Un serment</strong> — un plancher que ses successeurs héritent et que le moteur
          vérifie chaque année, en inscrivant l'année où il se rompt.
        </li>
        <li><strong>Un credo</strong> — ce que la civilisation croit d'elle-même.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Ce que le monde fait de son côté</h2>
      <p>
        Les récoltes varient d'une année à l'autre. Les bandits viennent pour la richesse et
        prennent une part, jamais un montant — un village perd ce que perd un village. Les fleuves
        débordent, les villes trop denses prennent la peste, les forêts brûlent : la terre que l'on
        convoite porte aussi son risque.
      </p>
      <p>
        Tout cela vient d'un calcul pur sur la graine du monde et l'année — jamais d'un tirage au
        sort. C'est ce qui permet de rejouer une histoire à l'identique, et donc de la vérifier.
      </p>
      <p class="mono note">
        Une ère se termine quand il ne reste qu'une civilisation. Une autre s'ouvre alors, ailleurs.
      </p>
    </section>
  </div>
</template>

<style scoped>
.rules {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.kicker {
  margin: 0 0 var(--s2);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

h2 {
  font-size: 19px;
  margin: 0 0 var(--s3);
}

p, ul {
  margin: 0 0 var(--s3);
  max-width: 72ch;
  font-size: 14.5px;
  line-height: 1.62;
}

ul {
  padding-left: var(--s4);
}

li {
  margin-bottom: var(--s2);
}

strong {
  color: var(--fg);
  font-weight: 600;
}

.note {
  font-size: 11.5px;
  color: var(--muted);
  margin-bottom: 0;
}

.scroll {
  overflow-x: auto;
  margin-bottom: var(--s3);
}

table {
  border-collapse: collapse;
  min-width: 420px;
  font-size: 13.5px;
}

th, td {
  text-align: left;
  padding: var(--s2) var(--s3);
  border-bottom: 1px solid var(--border-soft);
}

th {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 400;
}
</style>
