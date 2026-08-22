# Mesures d'adaptation observable

`@abs/metrics` mesure des changements de comportement a partir d'un journal
rejoue. Il ne mesure ni intelligence generale, ni modification des poids d'un
modele. Le paquet est pur : aucun appel reseau, aucune horloge et aucun hasard.

## Observation

`buildObservations(years, rulings, runId)` relie chaque decision a l'etat enregistre
immediatement apres elle, a l'annee suivante disponible et a la prochaine
decision de la meme civilisation. Une consequence qui suit une decision reste
qualifiee `observed-after` : l'ordre temporel ne prouve pas la causalite.
Quand plusieurs rulings mordent au meme tick, leurs transitions de doctrine
sont rejouees dans l'ordre du journal afin que chacune conserve son propre
couple avant/apres.

Chaque observation conserve une identite de course fournie par l'appelant, la graine, les empreintes et instantanes de
doctrine, les deltas objectifs, les identifiants d'evenements, le texte du
dirigeant et la preuve de service. Une observation comportementale n'est
eligible que si cette preuve nomme le meme modele demande et servi, sans repli,
en une tentative et sans report. Les autres observations restent dans
`sampleCount` et les metadonnees de service, mais sont exclues du numerateur, du
denominateur, de la valeur et de l'intervalle de Wilson.

Une preuve de service absente reste `UNKNOWN`. Les taux sont `null` si aucune
preuve n'est connue ; sinon les observations inconnues restent dans leur
denominateur et leur nombre est publie separement. Elles ne peuvent donc jamais
faire apparaitre artificiellement 100 % de service propre. Sans cette preuve,
l'identite du modele demande reste elle aussi inconnue : le champ historique
`ruling.model` ne suffit pas a la deduire.

Un evenement source n'est joint que par une `consequenceRef` valide : meme
civilisation et evenement deja visible au tick de la question posee. Une
reponse differee conserve ce tick de question plutot que son tick de reponse. Sans
reference valide, aucun autre evenement du meme tick ou de l'annee de reponse
n'est annexe par proximite.

## Series

Les quatre series ne sont jamais fusionnees en une note unique :

- `consequence-recognition` : changement d'un champ de doctrine pertinent pour
  une consequence negative effectivement enregistree et referencee ; un label
  de type de decision n'est jamais une preuve objective ;
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
de repli, nombre de preuves inconnues, intervalle de Wilson a 95 %, nombre de graines/courses et identifiants
des evenements sources. Les fenetres sont des intervalles entiers fixes, ancres
sur des multiples de leur taille.

## Appariement et classement

Plusieurs identites de course ne peuvent etre agregees sans `pairedRunKey` et
la liste complete `pairedRunIds`. La liste declaree doit correspondre exactement
aux courses observees pour le modele : deux fichiers de meme graine restent deux
courses et l'absence d'une course attendue fait echouer l'agregation.

Le classement est `UNRANKED` si une preuve de service manque, si le taux de
service propre est sous le seuil ou si le taux de repli depasse son plafond. Il est `INSUFFICIENT_DATA` si les
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
