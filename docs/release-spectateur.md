# Livraison de l'expérience spectateur

Référence de travail au 20 septembre 2026 (avancement des lots mis à jour). Le journal conserve les preuves de chaque livraison.

## Périmètre

Une application locale simple à lancer pour regarder quatre civilisations gouvernées par IA, en tours successifs, du Bronze au futur. Une démo enregistrée reste disponible sans clé. Les erreurs des fournisseurs restent explicites. Le mode dieu et l'hébergement public ne font pas partie de cette livraison.

## Lots et critères

1. **Base militaire v7** : capacités technologiques effectives, anciennes décisions préservées, tests et build verts. Intégré dans main (`77f0f0a`).
2. **Crises préparables v8** : annoncer les événements trois manches avant, fournir cette information à chaque dirigeant, adapter la politique locale, afficher les réserves/protections avant et les évolutions observées après. Aucune attribution abusive des pertes au seul climat. Replays v1–v7 conservés. Intégré dans main (`b880895`) ; les 12 archives relâchées/anciennes se rejouent sans rejet.
3. **Infrastructures et énergie** : localiser les investissements avancés, rendre leurs modèles visibles, représenter production/consommation d'énergie et pollution avec choix de réduction. Règles versionnées et informations exploitables par les dirigeants. Implémentation v9 prête (moteur, IA, UI, modèles) ; validation locale passée (592 tests, typecheck, build), porte finale à revalider après le dernier import et les raffinements de consignes IA ; branche `codex/infrastructure-v9` non fusionnée. La qualité d'action distante (conseil v9 réel `valid: false`) reste prioritaire avant les obligations diplomatiques.
4. **Diplomatie suivie** : obligations et durée d'un pacte visibles, acceptation bilatérale, rupture enregistrée et conséquences sur la confiance. Pas de promesse narrative sans état vérifiable.
5. **Lecture et identité** : parcours des civilisations, forces comparables, modèles des villes/unités/infrastructures cohérents avec les âges, liens décision–action–conséquence et navigation dans les moments importants.
6. **Accès et fiabilité** : partie longue accessible, lancement et reprise simples, démo vérifiée, campagnes distantes évaluées avec modèle effectivement servi, erreurs/latence et replays. Les tests locaux ne prouvent pas la qualité d'une campagne distante.

## Validation finale

- Tests moteur, contrats IA, replays historiques, vérification TypeScript et build.
- Contrôle navigateur du lancement, création/reprise, progression, navigation historique et bilan.
- Campagnes locales multi-graines et échantillon distant borné ; limites et coût d'appels consignés.
- Journal à jour, dépôt propre, branches d'évolution poussées et intégrées.

Une distribution autonome signée et une qualification sur machine Windows vierge nécessitent leurs propres preuves ; elles ne sont pas acquises par un build de développement réussi.
