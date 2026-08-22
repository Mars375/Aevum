# Rapport Task 3 - metriques d'adaptation

## Etat

Implementation terminee. Le calcul reste dans `@abs/metrics`, sans Vue, sans
appel de modele, sans reseau, sans horloge et sans aleatoire. Les quatre series
restent distinctes et aucun scalaire d'« intelligence » n'est produit.

## Fichiers changes

- `packages/metrics/package.json` : nouveau workspace `@abs/metrics`.
- `packages/metrics/src/types.ts` : observations enrichies, series, incertitude,
  courbe, options et etats de classement.
- `packages/metrics/src/observations.ts` : jointure pure entre annees, decisions,
  etats suivants, prochaines decisions, evenements et preuves de service.
- `packages/metrics/src/curves.ts` : quatre mesures independantes, fenetrage,
  Wilson 95 %, protocole de graines appariees et classification.
- `packages/metrics/src/index.ts` : exports publics.
- `packages/metrics/test/observations.test.ts` : etat suivant, prochaine
  decision, attribution et exclusion des appels differes/reessayes.
- `packages/metrics/test/curves.test.ts` : correction apres echec repete,
  reconnaissance, coherence malgre une perte, fidelite, service, appariement et
  continuite entre fenetres.
- `scripts/learning-curve.ts` : rapport JSON par defaut ou Markdown, entierement
  hors ligne.
- `docs/spec/learning-metrics.md` : semantique, limites et protocole.
- `package.json` : commande `learning-curve`.
- `package-lock.json` : workspace `@abs/metrics`.
- `tsconfig.json` : alias TypeScript `@abs/metrics`.

## Interfaces

- `buildObservations(years: Year[], rulings: Ruling[]): LearningObservation[]`
- `scoreConsequenceRecognition(observations): MetricSeries`
- `scoreErrorCorrection(observations): MetricSeries`
- `scoreDoctrineCoherence(observations): MetricSeries`
- `scoreNarrativeFidelity(observations): MetricSeries`
- `buildLearningCurve(observations, options): LearningCurve`
- `classifyLearningSignal(curve): "ADAPTATION_OBSERVED" | "NO_EVIDENCE" | "INSUFFICIENT_DATA" | "UNRANKED"`

`MetricSeries` expose fenetre, numerateur, denominateur, valeur nullable,
echantillon, taux de service, taux de repli, intervalle de Wilson, nombre de
graines/courses et identifiants d'evenements sources. Une aggregation de
plusieurs graines leve une erreur sans `pairedRunKey` explicite.

## Verification

- `npx vitest run packages/metrics/test` : 2 fichiers, 9 tests passes.
- `npm test` : 21 fichiers, 383 tests passes.
- `npm run typecheck` : passe, aucune erreur.
- `npm run learning-curve -- packages/world/test/fixtures/journal-v0.2.0.json --markdown` : passe ; `model/a`, service 100 %, repli 0 %, un echantillon, verdict honnete `INSUFFICIENT_DATA`.
- `npm run learning-curve -- packages/world/test/fixtures/journal-v0.2.0.json` : passe ; rapport JSON `aevum-learning-curve-v1`.
- `git diff --check` : passe, aucune sortie.

## Points d'attention

- Le chemin demande en exemple, `worlds/demo/era-0001.json`, n'existe pas dans
  ce worktree et `worlds/` est ignore. La verification utilise donc le fixture
  deterministe versionne `packages/world/test/fixtures/journal-v0.2.0.json`.
- La fidelite narrative est volontairement mecanique et conservatrice : seules
  les affirmations factuelles reconnues par le lexique documente entrent au
  denominateur. Un texte vague ou hors lexique reste non mesurable (`null` s'il
  n'existe aucune affirmation reconnue), jamais automatiquement faux.
- `pairedRunKey` est une declaration de protocole fournie par l'appelant. Le
  paquet interdit la fusion implicite de graines mais ne peut pas prouver, a
  partir d'un journal seul, que positions et expositions externes etaient
  effectivement appariees.
