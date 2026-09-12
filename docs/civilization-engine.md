# Moteur de civilisation w10

Le moteur w10 étend l'atlas 3D avec un état persistant de villes, d'unités et de relations diplomatiques. Les anciennes archives w8 conservent leur moteur et leurs empreintes. Une année est déterministe : état précédent + décisions enregistrées → état suivant.

## Systèmes intégrés

- Économie : répartition du travail, rendements du terrain, saisons, consommation alimentaire, salaires, stockage et pertes. Une pénurie provoque famine ou désertions ; les ressources restent positives ou nulles.
- Développement : croissance limitée par le logement, fondation de villes, cinq bâtiments payés au lancement et achevés après plusieurs années. Six technologies avec prérequis et effets sur production, commerce, recherche, construction ou combat.
- Unités : formations militaires, équipes de travailleurs et colons persistants. Déplacement cardinal d'une case par année, itinéraires respectant les frontières et ralentissement fluvial avant l'ingénierie. La carte représente leurs positions enregistrées.
- Diplomatie : paix, commerce bilatéral, guerre et trêves. Les combats dépendent des forces présentes, du terrain, des murs et des technologies. Les conquêtes peuvent déplacer une capitale ou éteindre une civilisation.
- Gouvernance : priorités de croissance, industrie, science ou armée, allocation du travail et posture. Ces informations sont exposées au dirigeant distant ; le moteur exécute les décisions.
- Fiabilité : reprise des consultations interrompues, journal remplacé atomiquement, verrou d'écriture exclusif, validation des données et contrôle du rejeu par empreinte.

## Essayer et vérifier

```sh
npm run player:dev
npm run civilization:probe -- --publish
npm run live -- --rules w10 --ticks 100 --silent --world essai-w10
npm run live -- --resume --ticks 100 --silent --world essai-w10
npm test
npm run typecheck
npm run player:build
npm run verify-season-1
```

Dans l'atlas, sélectionner `civilization-w10`. Sa démonstration couvre 300 ans avec une politique locale déterministe, enregistrée comme `SCRIPTED_NO_REMOTE_MODEL`. Elle ne constitue pas une mesure des performances de modèles de langage. Le mode `--silent` conserve les politiques courantes sans consulter de dirigeant ; la démonstration du probe réévalue sa politique locale tous les huit ans.

La version reste explicite (`--rules w10`) afin de préserver les usages w8 existants. Les fichiers de démonstration sont publiés dans `worlds/civilization-w10` et leur copie destinée au lecteur. Après modification des règles, régénérer ces journaux, puis vérifier leurs empreintes.

## Validation du 10 septembre 2026

465 tests passent, avec vérification TypeScript incluant les composants Vue, compilation du lecteur et vérification hors ligne de l'archive Season 1. Les régressions couvrent notamment les reprises interrompues, la conservation des soldats, les déplacements, la famine, les coûts de construction, la recherche et le rejeu après sérialisation JSON. Un essai CLI silencieux de 12 ans puis une reprise de 12 ans a réussi.

Le probe exécute 12 graines sur 300 ans : aucun stock négatif ou désaccord de troupes, et les 12 rejeux retrouvent leur empreinte. Résultats détaillés : `docs/reports/civilization-w10-probe.json`. Selon la graine, il reste une à quatre civilisations. Six simulations finissent avec une seule civilisation : l'équilibrage militaire demande encore une campagne comparative. Le probe poursuit jusqu'à 300 ans pour analyser l'état ; la boucle de jeu ordinaire s'arrête lorsqu'une seule civilisation subsiste.

## Limites connues

Les travailleurs sont des équipes représentatives ; la production est calculée à l'échelle de la civilisation et n'attend pas leur arrivée sur un chantier. Les renforts rejoignent directement les formations existantes. Les déplacements visuels suivent les années, sans interpolation continue. La diplomatie reste pilotée par une posture globale, avec un arbre technologique court : ce n'est pas encore l'étendue des systèmes d'un Civilization commercial.

Les appels à des modèles distants n'ont pas été exécutés dans cette validation. Leur qualité stratégique, leur coût et leur comportement réel en cas de panne restent à mesurer. Un arrêt brutal du processus peut laisser son fichier `.lock` ; vérifier que le processus indiqué ne tourne plus avant de retirer ce verrou. Le lecteur accepte au maximum 20 000 années de rejeu ; cette limite de validation n'est pas une garantie de fluidité à cette taille. Three.js reste un module chargé à la demande d'environ 524 Ko minifiés (133 Ko compressés).
