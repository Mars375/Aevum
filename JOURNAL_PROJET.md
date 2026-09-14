# Aevum — journal de référence

Ce fichier est la référence de reprise. Le lire avant toute intervention et le mettre à jour à chaque modification, même petite : changement, validation, limite et prochaine action. Ne jamais présenter un travail prévu comme terminé.

## Objectif

Créer une simulation de civilisations gouvernées par IA, exclusivement spectateur pour le moment. Chaque dirigeant joue son tour, agit sur le monde et transmet la main au suivant. Les décisions doivent produire une histoire compréhensible et des conséquences visibles. À terme : Bronze, Antiquité, Moyen Âge, Industrie, Moderne, Futur, indépendamment pour chaque civilisation.

## Chantier en cours : extension jusqu'au futur

Branche `codex/future-ages`. Version `spectator-6` implémentée et validée ; les anciennes campagnes gardent leur progression d'origine. Synchronisé dans `main` le 14 septembre 2026 (voir historique).

État actuel : six âges du Bronze au futur, six programmes nationaux décidés par le dirigeant, dépenses de ressources et science, progression en tours personnels, suspension sans académie, effets de production et science. Villes et soldats changent de silhouette ; programmes, prérequis et parcours comparés dans l'interface spectateur.

Validation : 542 tests, TypeScript, build, archives de saison et dix campagnes historiques rejouées. Conseil Nous réel v6 valide au tour 557 : mécanisation choisie sans rejet ni correction. Démonstration locale de 300 manches : http://127.0.0.1:5174/?campaign=future-ages-local-42.

Limites : infrastructures représentées par des programmes nationaux, sans réseau électrique géographique ni pollution ; les silhouettes militaires avancées conservent les règles tactiques existantes. Un conseil distant validé ne constitue pas encore une campagne complète de modernisation par modèles distants.

### 2026-09-13 — Programmes de modernisation

- Défini les six âges et six programmes nationaux : mécanisation, électricité, informatique, énergie propre, automatisation, réseau orbital. Coûts en ressources/science, prérequis et durée en tours personnels ; effets sur la production.
- La progression au-delà du Moyen Âge demande explicitement le contexte de modernisation, absent des anciennes règles.
- Validation et raccordement moteur encore à faire. Les projets sont des investissements nationaux abstraits, pas encore des bâtiments localisés ni un réseau électrique simulé.
- Travail visuel délégué sur les seuls modèles et la projection ; moteur et IA traités localement.

## État confirmé avant le chantier des âges

- Projet actif : `F:\Projet\Aevum`. Ancienne copie archivée dans `F:\Projet\Archives\Aevum-2026-09-08`.
- Dépôt : Mars375/Aevum. Une branche par évolution. Dernière base fusionnée : `3dc120f`, sur main, règles spectator-4.
- Tours successifs Ambre → Azur → Pourpre → Sylve, une manche par rotation des civilisations vivantes.
- Budgets de déplacement : civils 2, armées 3, marchands 4 ; plaine 1 point, autres terrains 2. Chemins animés sur leurs cases réelles.
- Villes, production, caravanes, recherche, combats, diplomatie persistante et plans suivis. Les stocks sont encore nationaux.
- Longcat via Nous présélectionné, clé côté serveur. Une manche réelle de quatre décisions validées sans ordre rejeté. Aucun remplacement silencieux par du local.
- Interface 3D, historique, moments importants, bilan, lancement Windows par double-clic. Démo enregistrée sans clé.
- Dernière validation : 524 tests, TypeScript, build et archives. Trois essais locaux de 40 manches et six anciennes campagnes rejouées.
- Linear : tickets préparés dans docs/linear-backlog.md, mais projet distant non créé faute de connecteur disponible.

## Chantier actif : âges des civilisations

Branche de cette évolution : `codex/civilization-ages`. Implémentation `10155b7` poussée et fusionnée dans `main` le 13 septembre 2026.

État actuel : premier lot implémenté dans les nouvelles campagnes `spectator-5`. Âges individuels, déblocages moteur, observations IA, villes et soldats 3D, conditions visibles et transitions dans le journal du spectateur. Les versions antérieures restent inchangées. Démonstration locale : http://127.0.0.1:5174/?campaign=ages-local-42 (620 actions enregistrées, aucun appel IA).

Premier lot accepté : Bronze → Antiquité → Moyen Âge. Les trois âges suivants restent prévus, pas implémentés. Une civilisation progresse par réalisations, pas par date arbitraire ; les civilisations peuvent avoir des âges différents. Comparer développement, prospérité, influence et résilience sans assimiler âge avancé à victoire automatique.

Critères du lot :

- État d'âge persistant propre à chaque civilisation, transitions vérifiées par le moteur.
- Conditions lisibles, liées aux technologies, infrastructures et réserves ; déblocages effectifs.
- Informations d'âge fournies aux IA et affichées au spectateur.
- Transformation visible des villes et des unités.
- Nouvelle version de règles, replays historiques inchangés.
- Tests de progression, indépendance des civilisations, déblocages, sauvegarde et rendu.

## Historique des interventions

### 2026-09-13 — Ouverture du chantier

- Vérifié : dépôt propre, branche main, base moteur spectator-4.
- Créé la branche dédiée et ce journal permanent.
- Prochaine action : définir les seuils des trois premiers âges et intégrer les règles versionnées, puis leur présentation 3D.

### 2026-09-13 — Contrat des âges

- Ajouté AGENTS.md pour imposer la lecture et la mise à jour de ce journal aux prochaines interventions.
- Ajouté ages.ts : Bronze → Antiquité nécessite irrigation, maçonnerie, grenier et deux vivres par habitant ; Antiquité → Moyen Âge nécessite trois technologies supplémentaires, deux villes, atelier, marché et 80 richesses.
- Déblocages prévus dans le moteur : atelier/marché et métallurgie/monnaie/ingénierie à l'Antiquité ; académie/érudition au Moyen Âge.
- Validation encore à faire : intégration moteur, tests et rendu. Les seuils restent à évaluer sur des simulations.
- Délégation visuelle indisponible (limite du service) ; poursuite locale.

## Évolutions ultérieures

Industrie → Moderne → Futur, réseaux et énergie, pollution, crises annoncées, négociations avec obligations, mémoire décision/action/conséquence, défis comparables entre modèles, installateur autonome. Ces fonctionnalités ne sont pas livrées dans le premier lot d'âges.

### 2026-09-13 — Tests des règles d'âge

- Ajout des contrôles de progression individuelle, absence d'avancement par calendrier, refus des déblocages prématurés et déterminisme sur 80 actions locales.
- TypeScript validé après intégration moteur. Exécution des nouveaux tests en cours.
- Limite : activation serveur, informations IA et modèles visuels non intégrés à ce stade.

### 2026-09-13 — Intégration du moteur v5

- Ajout des ages persistants, transitions en fin du tour personnel et verrouillage des recherches/constructions. Politique locale adaptee aux deblocages.
- Verification en cours ; serveur et interface restent sur v4 tant que toute la chaine ne supporte pas v5.
- Prochaine action : tests moteur puis observations IA et rendu.

### 2026-09-13 - Compatibilite de bout en bout

- Campagnes v5 reconnues par le replay, le serveur, le bilan et les tours du spectateur. Options IA filtrees par age, conditions fournies dans leur observation.
- Les quatre tests moteur passent. Activation par defaut differee jusqu au rendu et a la validation globale.

### 2026-09-13 — Sauvegardes et validation

- Les 528 tests existants et ajoutés passent, ainsi que TypeScript.
- Renforcé le schéma v5 : une sauvegarde doit contenir les âges de tous ses dirigeants et sa séquence.
- Étendu les tests au replay de campagne v5 et aux conditions médiévales. Validation de cette extension en cours.
- Prochaine étape : présentation des âges au spectateur et transformations visuelles ; les nouvelles campagnes restent en v4 pour le moment.

### 2026-09-13 — Silhouettes 3D

- Créé les géométries procédurales des trois habitats et des trois soldats, avec architectures, boucliers et casques différents. Aucun téléchargement ni clé nécessaire.
- Les cinq tests moteur et TypeScript passent avant ce changement. Raccordement et validation des géométries en cours.

- Raccorde les modeles au cache instancie et a la projection par age, ajoute les ages et conditions dans les fiches des dirigeants. Controle TypeScript et build a suivre.

### 2026-09-13 — Activation des nouvelles campagnes

- Trois simulations de 800 actions (graines 42, 7, 123) : aucun ordre local rejeté, progression jusqu'au Moyen Âge dans chaque simulation, avec des différences entre civilisations. Aucune progression forcée.
- Activé v5 pour les nouvelles campagnes et l'aperçu. Les campagnes existantes conservent leurs règles et leur rendu.
- Ajouté un test de projection des villes et soldats par âge, sans mutation du monde ni modification des vues archivées.
- Limites : modèles procéduraux simples, inspection visuelle navigateur encore nécessaire ; Industrie, Moderne et Futur restent à construire.

### 2026-09-13 — Vérification visuelle et clôture du lot

- Vérifié dans Chrome : carte chargée, villes médiévales et antiques distinctes, âges différents dans les fiches, conditions affichées. Serveur relancé après contrôle qu'aucune campagne ne travaillait.
- Les neuf campagnes existantes ont été rejouées sans erreur. Démonstration locale supplémentaire de 620 actions sauvegardée et replay vérifié.
- 530 tests, TypeScript et build passent. Ajout final : transitions d'âge visibles dans le journal et incluses dans les moments importants ; contrôle final à suivre.
- À approfondir : équilibrage de la durée (environ 35–55 manches avant l'Antiquité dans ces essais), qualité artistique des silhouettes, comparaison détaillée des trajectoires. Les trois âges futurs ne sont pas implémentés.

- Contrôle final après ajout des transitions : TypeScript et build validés, diff sans erreur d'espacement. Sauvegarde sur la branche dédiée puis synchronisation du dépôt.

### 2026-09-13 - Silhouettes des trois ages suivants

- Ajout des villes industrielles (usines et cheminees), modernes (tours) et futuristes (fleche et anneau), et des unites fusilier, blinde et drone. Modeles historiques conserves dans leur chemin de rendu existant.
- Ajout des six noms au catalogue des modeles instancies. Aucune dependance ni ressource distante.
- Validation : inspection du raccordement au chargeur effectuee ; tests de geometrie et TypeScript a suivre. Limite : modeles proceduraux stylises, sans animation propre du drone.
- Prochaine action : tester les geometries et la projection avec les ages etendus.

- Tests dedies ajoutes : geometries finies dans leur parcelle, absence de penetration du sol, projection des trois ages avances sans mutation. Execution a suivre.

### 2026-09-13 - Integration v6

- Raccorde les programmes aux decisions, paiement, progression du seul dirigeant actif et production des villes. La perte de toutes les academies suspend le chantier.
- Les campagnes et consommateurs reconnaissent v6 ; activation par defaut differee. Controle TypeScript en cours.

- Corrigé le raccordement après détection TypeScript d'importations inutilisées : initialisation de l'état, effets de production, progression et choix local maintenant branchés. Aucun résultat de simulation encore revendiqué.

### 2026-09-13 — Contrat de décision IA

- Ajouté un contrat fournisseur propre à v6 avec choix de modernisation, coûts, effets, disponibilité et motifs de blocage dans l'observation. Les contrats précédents restent identiques.
- Le moteur exige l'état de modernisation pour tous les dirigeants v6. La politique locale réserve les dépenses du programme avant de choisir ses constructions.
- TypeScript validé avant ce lot ; nouveaux tests moteur et IA à exécuter. Les choix distants n'ont pas encore été testés sur une API réelle pour v6.

### 2026-09-13 — Tests de modernisation

- Ajouté les contrôles de paiement unique, refus sans dépense, progression personnelle, suspension faute d'académie, effets de production, transition et sauvegarde complète.
- Un replay de 1 100 actions locales vérifie les décisions autonomes et l'accessibilité du futur. Exécution en cours ; la durée pourra révéler un besoin d'équilibrage.

- Le replay autonome atteint le futur sans ordre rejeté. Corrigé la fixture du test de transition : sa seconde ville doit se trouver sur un terrain effectivement possédé, conformément au validateur du monde.

- La fixture initiale ne possédait qu'une seule case : ajouté explicitement un terrain neutre à son territoire et recalculé le recensement avant la seconde ville. Cette correction concerne le test uniquement.

### 2026-09-13 — Vérification reproductible

- Les six tests moteur de modernisation passent, dont 1 100 décisions locales et leur replay jusqu'au futur.
- Ajouté les tests de contrat IA : disponibilité, coûts, confidentialité des programmes rivaux et compatibilité des contrats antérieurs.
- Ajouté `scripts/future-ages-probe.ts` : trois graines, vérification des archives et rapport JSON reproductible. Option `--write-demo` crée uniquement une nouvelle démonstration locale, sans écraser les campagnes présentes.

### 2026-09-13 — Activation et conseil distant

- Nouvelles campagnes serveur en v6. Précisé dans les options IA l'ordre réel de paiement : modernisation, constructions, recrutement.
- Ajouté un probe distant explicite (`--remote`) au premier tour éligible à une modernisation ; il vérifie le contrat et les ordres sans modifier une campagne existante. Exécution à venir.
- Rapport local généré : dix archives vérifiées, zéro rejet sur les trois graines ; le futur est atteint dans les graines 42 et 7, la graine 123 termine l'observation à l'âge moderne. Démonstration locale créée sans écrasement.

- Validation visuelle technique : neuf tests de geometrie/projection passent apres extension du schema aux six ages. Formatage Prettier applique aux trois fichiers visuels. TypeScript global reste bloque temporairement par deux imports moteur inutilises pendant integration parallele ; aucun diagnostic visuel. Prochaine action : verification globale apres integration moteur.

### 2026-09-13 - Observation de la modernisation

- Interface spectateur : programme actif, duree personnelle restante, suspension sans academie, programmes acheves et effets, conditions/couts des prochains programmes. Aucun bouton de commande ajoute.
- Conditions des ages futurs raccordees aux programmes acheves. Historique individuel des ages dans les fiches et colonne de comparaison dans le bilan ; plans accomplis visibles aussi en versions sequentielles. Apercu passe en v6.
- Validation : TypeScript a suivre ; les transitions utilisent les actions historiques exactes, sans conversion approximative en manches. Prochaine action : verification de l integration complete.

- Validation apres formatage du panneau : TypeScript et vue-tsc passent. Verification navigateur a effectuer avec une campagne v6 ; moteur et sauvegardes controles par le chantier principal.

### 2026-09-14 — Reprise et diagnostic du conseil distant

- Premier conseil Nous v6 refusé : réponse contenant des champs de plan non autorisés, y compris après la correction bornée. Aucun remplacement silencieux par un dirigeant local.
- Fournit maintenant le contrat JSON complet dans la demande v6, même si le fournisseur n'impose pas les sorties structurées. Consigne explicite de séparer les métadonnées observées du plan et le choix national de modernisation.
- Test long : il passe isolément mais dépasse cinq secondes dans la suite parallèle ; délai porté à vingt secondes pour ce seul test de 1 100 actions, sans réduire les assertions.
- Nouvelle vérification distante et suite complète à exécuter. Travail non encore fusionné.

- Ajouté un test fournisseur sans support des sorties structurées : vérifie que le contrat v6 est transmis dans la demande et que les ordres valides restent acceptés.

- Deuxième essai réel : réponse conforme et mécanisation choisie, mais ancien plan de fondation réutilisé sur une cible invalide. Ajouté `currentPlanIssue`, issu du validateur réel, et une consigne d'abandon/remplacement ; aucun assouplissement des règles du moteur.

### 2026-09-14 — Validation finale du lot futur

- Troisième essai réel : Longcat via Nous choisit la mécanisation, réponse valide dès le premier appel, aucun ordre rejeté et aucun fallback. Rapport `docs/future-council-verification.json`.
- Suite globale : 542 tests passent. Après la dernière précision du contrat : TypeScript, 17 tests passerelle IA et vérification des archives de saison repassés avec succès.
- Vérifié dans Chrome : bilan des âges, progression à 560 actions, villes modernes à 650 actions et villes futuristes en fin de chronique. Le replay reste navigable et les programmes affichent leur durée et leurs effets.
- Serveur relancé après constat d'absence d'écoute sur 5174. Démonstration disponible et build reconstruit par le lanceur.
- Prochaine évolution : différencier les capacités militaires par technologie, localiser les infrastructures et ajouter les contraintes énergétiques ; ce lot ne prétend pas déjà les simuler.

### 2026-09-14 — Synchronisation du lot futur

- Lot spectator-6 (six âges, programmes nationaux, conseil IA v6) committé sur `codex/future-ages`, fusionné dans `main` et poussé. Nouvelle base pour les évolutions suivantes.
- Validation re-exécutée ce jour : typecheck OK, build Vite OK, 536 tests passent. 5 échecs dans la suite de publication `aevum-release.test.ts` : environnementaux, car `os.userInfo()` échoue avec `uv_os_get_passwd ENOMEM` dans tout processus enfant tsx ici (suite déjà fragile sous Windows selon l'audit). `discovery.test.ts` a montré un unique timeout en parallèle, vert seul.
- Limite : les scripts tsx enfants (probes serveur, vérification de publication) ne peuvent pas tourner dans cette sandbox ; artefacts publiés non régénérés sur ce poste aujourd'hui.
- Prochaine action : ouvrir un nouveau chantier — différencier les capacités militaires par technologie.
