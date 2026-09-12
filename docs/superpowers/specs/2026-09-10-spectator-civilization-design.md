# Aevum — simulation spectateur

## Direction validée dans la conversation

Le joueur reste uniquement spectateur. Le mode d'intervention dans le monde est reporté. La simulation fonctionne au tour par tour avec collecte des décisions sur un même état initial, puis résolution commune. Les modèles commandent leurs unités explicitement ; ils ne se limitent pas aux allocations économiques.

Project Napoleon (https://napole0n.ai/, consulté le 10 septembre 2026) est la référence de départ. La page accessible présente une expérience de simulation IA et une invitation à composer une armée. Son fonctionnement interne et sa résolution des combats n'ont pas été vérifiés. Pour Aevum, retenir des dirigeants identifiables et des décisions visibles, tout en étendant le cadre aux civilisations, à leur économie et à leur histoire.

## Contrat du tour

1. Figer l'état au début du tour et préparer la même échéance pour tous les dirigeants.
2. Présenter à chacun ses informations connues, ses unités identifiées, ses villes, ses ressources, ses engagements diplomatiques et les résultats de ses ordres antérieurs.
3. Recueillir des ordres structurés : déplacer, défendre, attaquer, se retirer, explorer, escorter, fonder, construire, rechercher et proposer un accord diplomatique.
4. Valider propriété, cibles, coûts, prérequis et bornes. Une réponse invalide ne modifie pas le monde. Conserver le motif de rejet pour le spectateur et le prochain arbitrage.
5. Résoudre les déplacements et conflits à partir des intentions collectées ; aucune IA ne voit une décision adverse du même tour avant sa propre soumission. Définir explicitement les collisions, échanges de positions et assauts conjoints avant implémentation.
6. Enregistrer ordres, origine des réponses, événements et état de fin de tour. Une interruption doit permettre la reprise sans rejouer une décision déjà enregistrée.

Les missions longues persistent sans appel supplémentaire à chaque case. Un incident ou une nouvelle décision peut les interrompre. Le moteur calcule routes, durée, ravitaillement et combats ; le modèle choisit les intentions et leur justification. Une panne fournisseur conserve les ordres encore valides et produit un statut explicite, sans inventer une nouvelle décision IA.

## Expérience web

Carte 3D centrale et interface de simulation occupant l'écran, navigation secondaire vers les archives. Commandes spectateur : pause, lecture, vitesse, tour suivant et retour dans l'histoire. Distinguer lecture d'une archive et avancement réel de la simulation.

Sélection d'une unité : propriétaire, effectif, mission, destination, route et explication du dirigeant. Sélection d'une ville : production, stock, bâtiments et chantier. Panneau des dirigeants : modèle réellement servi, intention déclarée, dernier ordre et relations. Fil des événements concis avec accès au journal détaillé. Aucun chiffre ni mouvement décoratif ne doit être présenté comme une donnée simulée.

## Architecture et livraison

## Ordres visibles et événements mondiaux — complément validé

Les ordres sont consultables avant et après résolution : unité concernée, action, destination, justification déclarée, tour d'émission et statut (en attente, en cours, terminé, interrompu ou rejeté). La carte affiche les routes et les cibles de l'unité sélectionnée ; un filtre permet de voir les intentions d'une civilisation sans surcharger l'ensemble du plateau. Distinguer graphiquement l'intention du déplacement effectivement réalisé. Le spectateur peut consulter les ordres révélés ; les dirigeants ne reçoivent pas les ordres adverses privés du même tour.

Des événements mondiaux aléatoires sont tirés par le moteur à partir d'une graine enregistrée et annoncés à tous les dirigeants avant leur phase de décision : sécheresse, hiver rigoureux, récolte exceptionnelle, épidémie ou découverte majeure, selon les systèmes réellement implémentés. Le tirage, le tour, la portée, l'intensité, la durée et les effets mécaniques sont déterministes et rejouables. L'IA réagit à l'événement ; elle ne détermine pas arbitrairement ses effets.

Un événement commun n'implique pas des pertes identiques : les impacts dépendent de l'exposition, des stocks et des infrastructures, selon des règles explicites. Afficher un bulletin mondial, la durée prévue et le bilan par civilisation. Borner fréquence, cumul et gravité pour laisser des possibilités de réaction et éviter des extinctions arbitraires au démarrage. Tester l'annonce identique à tous, les effets différenciés justifiés, la fin effective des modificateurs temporaires et le rejeu après reprise.

## Architecture et livraison (suite)

Préserver les archives w8/w10 avec leurs règles actuelles. Introduire les nouveaux ordres et leur résolution sous une nouvelle version. Séparer contrats d'ordres, observation, validation, résolution, orchestration des fournisseurs et projection visuelle. Les clés restent côté serveur.

Ordre de réalisation : contrats et tests de résolution ; commandement IA et persistance ; service local d'exécution ; interface spectateur ; simulations comparatives et validation des appels distants. La refonte n'est pas considérée terminée sur la seule base d'un scénario scripté ou d'une maquette.

Nous Portal est un fournisseur optionnel à intégrer après vérification du contrat d'API et des identifiants de modèles disponibles. Son site annonce une offre gratuite limitée aux modèles gratuits et à des quotas standards, sans crédit mensuel. Ne pas supposer que tous les modèles Hermes sont gratuits, ni déduire la tarification du simple nom d'un modèle. Aucun achat, abonnement ou appel payant n'est autorisé par cette spécification.

## Critères de validation

Tests des ordres étrangers ou impossibles, frontières, chemins, collisions, coûts et missions persistantes ; indépendance de l'ordre de réponse des fournisseurs ; reprise interrompue équivalente ; rejeu déterministe après sérialisation ; absence de fuite de clés vers le navigateur. Vérifier ensuite la lisibilité du tour et les contrôles dans l'interface, puis mesurer variété des stratégies, domination militaire, stagnation, durée et coût des consultations.
