# Mesures d'adaptation observable

`@abs/metrics` mesure des changements de comportement a partir d'un journal
rejoue. Il ne mesure ni intelligence generale, ni modification des poids d'un
modele. Le paquet est pur : aucun appel reseau, aucune horloge et aucun hasard.

## Observation

`buildObservations(years, rulings)` relie chaque decision a l'etat enregistre
immediatement apres elle, a l'annee suivante disponible et a la prochaine
decision de la meme civilisation. Une consequence qui suit une decision reste
qualifiee `observed-after` : l'ordre temporel ne prouve pas la causalite.

Chaque observation conserve la graine, les empreintes et instantanes de
doctrine, les deltas objectifs, les identifiants d'evenements, le texte du
dirigeant et la preuve de service. Un appel differe ou retente reste dans les
taux de service mais ne peut pas entrer au numerateur d'une mesure.

## Series

Les quatre series ne sont jamais fusionnees en une note unique :

- `consequence-recognition` : changement d'un champ de doctrine pertinent pour
  une consequence negative effectivement enregistree ;
- `error-correction` : changement pertinent au retour d'un meme type d'echec
  pour la meme civilisation et le meme modele ; une reussite sans rapport ne
  compte pas ;
- `doctrine-coherence` : accord mecanique entre les intentions de doctrine
  reconnaissables dans la justification et la doctrine appliquee. Sans
  intention reconnaissable, conserver la doctrine est coherent, meme si le
  resultat du monde est mauvais ;
- `narrative-fidelity` : affirmation factuelle reconnaissable confirmee par un
  evenement source du journal. Un texte vague est non mesurable et exclu ; une
  affirmation reconnaissable sans preuve est comptee comme non confirmee.

Chaque point publie fenetre, numerateur, denominateur, valeur (`null` si elle
est impossible a mesurer), nombre d'observations, taux de service propre, taux
de repli, intervalle de Wilson a 95 %, nombre de graines/courses et identifiants
des evenements sources. Les fenetres sont des intervalles entiers fixes, ancres
sur des multiples de leur taille.

## Appariement et classement

Des observations de graines differentes ne peuvent etre agregees sans
`pairedRunKey`. Cette cle atteste seulement que l'appelant applique un protocole
apparie ; elle n'autorise pas a masquer une exposition inegale.

Le classement est `UNRANKED` si le taux de service propre est sous le seuil ou
si le taux de repli depasse son plafond. Il est `INSUFFICIENT_DATA` si les
echantillons ou fenetres mesurables manquent, `ADAPTATION_OBSERVED` uniquement
si sensibilite aux consequences et correction progressent toutes deux au-dela
du seuil declare, et `NO_EVIDENCE` sinon.

## CLI hors ligne

```sh
npm run learning-curve -- worlds/demo/era-0001.json
npm run learning-curve -- worlds/demo/era-0001.json --markdown
npm run learning-curve -- run-42.json run-99.json --paired-run-key=rotation-a
```

Le JSON est le format par defaut. Le rapport Markdown expose les memes taux,
series, motifs de non-classement et evenements sources. Le CLI lit uniquement
des journaux locaux valides et les rejoue avec `@abs/world`.
