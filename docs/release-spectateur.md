# Livraison de l'expérience spectateur

Référence de travail au 20 septembre 2026 (avancement des lots mis à jour). Le journal conserve les preuves de chaque livraison.

## Périmètre

Une application locale simple à lancer pour regarder quatre civilisations gouvernées par IA, en tours successifs, du Bronze au futur. Une démo enregistrée reste disponible sans clé. Les erreurs des fournisseurs restent explicites. Le mode dieu et l'hébergement public ne font pas partie de cette livraison.

## Lots et critères

1. **Base militaire v7** : capacités technologiques effectives, anciennes décisions préservées, tests et build verts. Intégré dans main (`77f0f0a`).
2. **Crises préparables v8** : annoncer les événements trois manches avant, fournir cette information à chaque dirigeant, adapter la politique locale, afficher les réserves/protections avant et les évolutions observées après. Aucune attribution abusive des pertes au seul climat. Replays v1–v7 conservés. Intégré dans main (`b880895`) ; les 13 archives relâchées/anciennes se rejouent sans rejet.
3. **Infrastructures et énergie** : localiser les investissements avancés, rendre leurs modèles visibles, représenter production/consommation d'énergie et pollution avec choix de réduction. Règles versionnées et informations exploitables par les dirigeants. **Livré et intégré** : v9 (`0d150a2`, infrastructures localisées, énergie et pollution) et choix IA réalisables (`f79fcf3`) poussés puis fusionnés fast-forward dans `origin/main`. Validé : 597 tests complets, typecheck et build ; 13 archives rejouées sans échec ; graines 42/7/123 (1041/1048/406 actions, zéro rejet local, 13/13/0 sites) ; conseil distant réel au tick 639 `valid: true`, zéro rejet, aucun fallback (`docs/infrastructure-verification.json`). Un conseil valide ne prouve pas une campagne distante longue ; la distribution autonome signée reste hors périmètre de cette validation.
4. **Diplomatie suivie** : obligations et durée d'un pacte visibles, acceptation bilatérale, rupture enregistrée et conséquences sur la confiance. Pas de promesse narrative sans état vérifiable.
5. **Lecture et identité** : parcours des civilisations, forces comparables, modèles des villes/unités/infrastructures cohérents avec les âges, liens décision–action–conséquence et navigation dans les moments importants.
6. **Accès et fiabilité** : partie longue accessible, lancement et reprise simples, démo vérifiée, campagnes distantes évaluées avec modèle effectivement servi, erreurs/latence et replays. Les tests locaux ne prouvent pas la qualité d'une campagne distante.

Reste à livrer : diplomatie suivie (lot 4), lecture/identité (5) et accès/fiabilité (6). La fiabilité d'une campagne distante longue et une distribution autonome signée ne sont pas acquises par cette validation locale.

## Validation finale

- Tests moteur, contrats IA, replays historiques, vérification TypeScript et build.
- Contrôle navigateur du lancement, création/reprise, progression, navigation historique et bilan.
- Campagnes locales multi-graines et échantillon distant borné ; limites et coût d'appels consignés.
- Journal à jour, dépôt propre, branches d'évolution poussées et intégrées.

Une distribution autonome signée et une qualification sur machine Windows vierge nécessitent leurs propres preuves ; elles ne sont pas acquises par un build de développement réussi.
