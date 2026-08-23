# Task 5 — campagne Aevum Season 1 reproductible

Statut : terminé.

## Livré

- Commande de campagne compatible avec `--seed`, `--ticks`, `--silent`, `--out` et `--resume`, plus un mode `--scripted` local qui ne charge ni clé ni fournisseur distant.
- Fixture déterministe seed 99 : 120 ans vécus, fingerprint `fdc76c0b`, crimson survivante, trois civilisations historiques tombées, première guerre, pertes de capital, extinctions et chaîne événement-décision sourcée.
- Écriture canonique : une reprise d'une ère fermée conserve le SHA-256 du journal `12710d2268b433b6671fc83bab7fb7af4aacf03c6bd103d6977196d76cc05bd8`.
- Sidecar `aevum-learning-curve-v1` produit par `@abs/metrics`, avec provenance `SCRIPTED_NO_REMOTE_MODEL`, zéro appel distant, 67 preuves de service inconnues et taux de service/repli à `null`.
- Rapport Season 1 généré uniquement depuis le journal et le sidecar, puis rendu en HTML avec liens vers les artefacts.
- Catalogue public enrichi avec version du monde, seed, chemin du sidecar et rapport; journal et sidecar sont copiés sous les liens publiés.
- Les chemins silencieux ne mutent plus une horloge de décision sans ruling, ce qui préserve W4 au rejeu.

## Vérifications

- Tests ciblés : 40/40, puis 11/11 après le dernier nettoyage.
- `npm test` : 411/411.
- `npm run typecheck` : succès.
- `npm run world:probe` : succès, 101 points de décision sur 500 tours, économie 19,8x.
- `npm run learning-curve -- worlds/aevum-season-1/era-0001.json --execution=scripted-no-remote-model --out=worlds/aevum-season-1/era-0001.learning.json` : succès.
- `npm run build-reports` : succès, 15 rapports.
- `npm run index-worlds` : succès, 1 ère indexée.
- Liens journal et sidecar présents dans le HTML; copies publiques identiques aux sources.
- `git diff --check` : succès.

## Limites

- La campagne est une fixture locale et ne classe aucun modèle.
- Les décisions scriptées ont volontairement `service: null`; l'absence d'appel distant n'est pas présentée comme 100 % de service.
- Un journal ne conserve pas les appels définitivement échoués; le résumé de service porte sur les rulings persistés.
