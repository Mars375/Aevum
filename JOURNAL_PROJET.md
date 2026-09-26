# Aevum — journal de référence

Ce fichier est la référence de reprise. Le lire avant toute intervention et le mettre à jour à chaque modification, même petite : changement, validation, limite et prochaine action. Ne jamais présenter un travail prévu comme terminé.

## État actuel

- Objectif : simulation de civilisations gouvernées par IA, exclusivement spectateur, du Bronze au Futur, indépendamment pour chaque civilisation.
- Livré et fusionné fast-forward dans `origin/main` (poussés) : infrastructures localisées v9 (`0d150a2`) et choix IA réalisables (`f79fcf3`, options restreintes aux unités/bâtiments réellement atteignables).
- Branche courante : `codex/feasible-ai-orders` (documentation uniquement, aucun commit ajouté).
- Validation : 597 tests complets, typecheck, vérification de saison et build racine passés ; 13 archives rejouées sans échec ; graines 42/7/123 = 1041/1048/406 actions, zéro rejet local, 13/13/0 sites (26 au total).
- Conseil distant v9 réel au tick 639 : civilisation azure, `research_center` choisi sur `city-amber` (foundry demandée), conseil valide zéro rejet, rapport `valid: true` confirmé à la lecture de `docs/infrastructure-verification.json`, aucun fallback local. Un conseil n'est pas une campagne distante complète.
- Vérification API racine `infrastructure-local-42` : spectator-9, 1041 actions, 13 sites, `error: null`.
- Aperçu `docs/previews/infrastructure-v9.png` (1400×900) généré uniquement ; inspection d'image non supportée et auth navigateur indisponible → aucun contrôle visuel.
- Reste à faire : obligations diplomatiques ; distribution autonome signée et campagne distante longue non acquises.
- Tout ce qui suit dans ce fichier est constitué d'entrées datées historiques.

### 2026-09-20 — Clôture de documentation infrastructures v9

- Documentation uniquement (journal, `docs/infrastructure-v9-design.md`, `docs/release-spectateur.md`) ; aucun changement de source, aucun commit.
- Implémentation v9 : six infrastructures localisées, réseaux énergétiques par composante de territoire (rivières coupantes), pollution fractionnaire par site (émissions proportionnelles à la génération fossile consommée), une file par civilisation, bonus fractionnaires mis à l'échelle par `powerRatio` ; panneau spectateur, modèles et projection raccordés.
- Validation : 592 tests complets, typecheck et build racine verts avant le dernier import et les raffinements de consignes IA (porte finale en attente) ; 18 tests de domaine racine incluant le nettoyage des orphelins ; index eager réduit 491 Ko → 280 Ko (split des métadonnées).
- Replays : les 12 archives relâchées/anciennes rejouées ; graines 42/7/123, zéro rejet local, 13/13/0 sites, 26 au total (`docs/infrastructure-verification.json` fait foi).
- Conseil distant v9 réel : la centrale thermique autorisée est choisie mais d'autres ordres (plan/unités) sont rejetés → `valid: false` ; ni validation distante complète ni fonctionnalité complète globale revendiquées.
- Démo expérimentale v9 sous règles antérieures archivée dans `worlds/spectator/drafts` (pas une campagne relâchée) ; démo fraîche `infrastructure-local-42` créée.
- Aperçu `docs/previews/infrastructure-v9.png` (1400×900) généré ; inspection d'image non supportée et auth navigateur indisponible → aucun contrôle visuel.
- Dernières corrections consignées : budget réservé avant l'infrastructure, approvisionnement des réseaux déficitaires, élagage des orphelins, arrondi UI uniquement (moteur intact), script warm-up corrigé pour ne pas faire avancer l'acteur.
- Prochaines actions : porte finale (suite complète après le dernier import et les raffinements de prompts), amélioration de la qualité d'action distante avant les obligations diplomatiques, puis fusion de la branche.

### 2026-09-20 — Synchronisation de documentation : v9 et choix IA réalisables livrés

- Documentation uniquement (journal, `docs/release-spectateur.md`, `docs/infrastructure-v9-design.md`) ; aucun changement de source, aucun commit.
- `0d150a2` (infrastructures v9) et `f79fcf3` (choix IA réalisables) poussés puis fusionnés fast-forward dans `origin/main` ; branche courante `codex/feasible-ai-orders`.
- Validation : 597 tests complets, typecheck, vérification de saison et build racine passés ; 13 archives relâchées/anciennes rejouées sans échec ; graines 42/7/123 = 1041/1048/406 actions, zéro rejet local, 13/13/0 sites.
- Conseil distant réel au tick 639 : `research_center` choisi sur `city-amber` (foundry demandée), conseil entier valide zéro rejet, rapport `valid: true`, aucun fallback — `docs/infrastructure-verification.json` relu et confirmé. Une manche valide ne vaut pas campagne distante complète.
- API racine `infrastructure-local-42` : spectator-9, 1041 actions, 13 sites, `error: null`.
- PNG 1400×900 seul artefact visuel (inspection d'image non supportée, auth navigateur indisponible) ; aucun contrôle visuel revendiqué.
- Prochaines actions : obligations diplomatiques, puis distribution autonome signée et qualification distante de campagne longue.

## Objectif

### 2026-09-19 — Validation des crises préparables

- 552 tests réussis, TypeScript réussi, build lancé par le lanceur réussi. Serveur local prêt sur 5174.
- Probe : onze campagnes archivées rejouées ; graines 42/7/123, respectivement 1 041/1 048/406 actions, zéro ordre rejeté et replay identique.
- Quatre décisions Nous réelles sous v8 avec prévision climatique : toutes valides, aucun remplacement local. Rapport `docs/release-verification.json`. Ceci valide une manche, pas la fiabilité distante sur 300 manches.
- Démonstration générée sans écrasement : `climate-local-42`. Contrôle visuel bloqué par l'outil navigateur (« Codex auth token is unavailable »), ne pas présenter ce contrôle comme réussi.
- Revue ciblée déléguée avant intégration. Prochain lot : infrastructures avancées localisées et effets énergétiques.

### 2026-09-19 — Vérification reproductible v8

- Neuf tests ciblés moteur et TypeScript passent. Ajouté le contrôle de l'observation des quatre dirigeants (prévision commune, capacités militaires/modernisation conservées, aucune prévision v7).
- Ajouté un probe de livraison : replays sauvegardés, trois graines locales jusqu'à 300 manches, arrêt si une seule civilisation subsiste, démo sans écrasement ; option distante explicite bornée à quatre décisions.
- Rapport et démo pas encore générés à cette étape. Une manche distante réussie ne sera pas présentée comme une campagne distante complète.

### 2026-09-19 — Interface des prévisions et parties longues

- Bulletin d'anticipation avant l'événement et bilan par civilisation dans les événements. L'historique est tronqué à l'action affichée pour ne pas révéler le futur lors d'un replay.
- Ajouté le format « À travers les âges » de 300 manches dans le choix de partie ; atteindre le futur dépend toujours des dirigeants.
- TypeScript moteur passe. Corrigé une assertion de test : avant la clôture du deuxième événement, le bilan du premier doit rester consultable.
- Prochaine action : validation moteur/IA/interface, puis démonstration navigateur.

### 2026-09-19 — Comparaison des crises

- Ajouté un rapport dérivé des instantanés existants : réserves et protections au début, réserves et variation de population à la fin. Aucun état de sauvegarde dupliqué ni attribution causale inventée.
- Ajouté les tests de calendrier, protection des règles v7, réaction locale et replay v8 sur 110 actions.
- Validation en cours. Le rapport nécessite une crise terminée et un historique couvrant ses deux bornes ; les données futures ne doivent pas être fournies depuis l'interface.

### 2026-09-19 — Règles v8 et prévisions

- Étendu les consommateurs séquentiels à v8 sans modifier les versions précédentes. Les nouvelles campagnes utilisent v8.
- Prévision publique déterministe trois manches avant les événements existants, y compris au changement de bloc climatique. Les dirigeants distants reçoivent calendrier et options de préparation.
- Politique locale v8 : en cas de pénurie annoncée/active et de réserves sous quatre vivres par habitant, priorité alimentaire et suspension du recrutement de colons.
- Validation à effectuer : limites de calendrier, réaction locale, observation IA et replay. Prochaine action : bilan factuel dans l'interface.

### 2026-09-19 — Compatibilité de la politique locale

- Revue v7 : trouvé un calcul de puissance militaire appliqué par erreur aussi aux décisions locales v6. Restreint ce calcul à v7 pour préserver les anciennes décisions diplomatiques.
- Test de régression reproduit avant correction : v6 proposait le commerce au lieu de la guerre prévue par ses règles historiques. Le même scénario doit rester prudent en v7.
- Prochaine action : repasser ce test et les validations globales avant fusion. Aucun changement des dégâts ni des sauvegardes.

Créer une simulation de civilisations gouvernées par IA, exclusivement spectateur pour le moment. Chaque dirigeant joue son tour, agit sur le monde et transmet la main au suivant. Les décisions doivent produire une histoire compréhensible et des conséquences visibles. À terme : Bronze, Antiquité, Moyen Âge, Industrie, Moderne, Futur, indépendamment pour chaque civilisation.

## Chantier en cours : capacités militaires par technologie

Règles `spectator-7` intégrées et poussées dans main (`77f0f0a`). Chantier actif : `codex/forecast-crises`, crises préparables sous règles v8.

### 2026-09-19 — Périmètre de livraison

- Consigné les lots et critères dans `docs/release-spectateur.md` : simulation spectateur locale, crises, infrastructures, diplomatie, lecture visuelle et accès fiable. Mode dieu conservé hors périmètre conformément au choix utilisateur.
- Fusion et push du lot militaire réussis. Branche dédiée aux crises créée.
- Prochaine action : prévision déterministe à trois manches, réaction locale versionnée et comparaison factuelle avant/après ; pas de nouvelles commandes à apprendre.

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

### 2026-09-14 — Capacités militaires par technologie

- Branche `codex/military-technology`, base `main` (`1ea13e5`). Nouveaux mondes créés en `spectator-7` par le serveur.
- Règles `spectator-7` : puissance d'attaque et défense des structures dérivées de l'âge, des recherches et des programmes de modernisation achevés (`militaryProfile`, multiplicateurs power/resilience). Les versions 1-6 conservent strictement leurs formules : replays inchangés.
- IA : les dirigeants reçoivent power/resilience par civilisation dans leur observation et comparent l'avantage réel avant de proposer la guerre (politique locale). Le spectateur affiche puissance et défense dans la fiche du dirigeant.
- Validation ré-exécutée : 5 tests dédiés (profil pur, dégâts v6=3 vs v7=4, replay v7 déterministe, observation v7/v6), 540 tests passent, typecheck et build OK. Mêmes 6 échecs environnementaux que précédemment (suite de publication ENOMEM tsx sous Windows, 1 timeout flaky discovery).
- Limites : silhouettes militaires existantes (pas de nouvelle géométrie), pas encore de réseau électrique géographique ni de pollution ; multiplicateurs à équilibrer sur plusieurs graines.
- Prochaine action : campagne v7 avec le conseil Nous distant, puis équilibrage des profils militaires et visualisation des forces relatives.

### 2026-09-19 — Validation du lot militaire

- Suite globale après ajustement des deux délais : 547 tests réussis, TypeScript et build réussis. Après correction de la compatibilité diplomatique v6, les six tests militaires moteur/observation réussissent, dont la nouvelle régression.
- L'audit délégué confirme des chantiers distincts : fiabilité des campagnes distantes longues, infrastructures/énergie, distribution autonome. Ses constats historiques de publication sont dépassés par la validation locale de ce jour.
- Les simulations locales et un conseil v6 réel ne constituent pas une preuve de campagne distante v7 complète. Cette limite reste ouverte.
- Prochaine évolution : crises annoncées, préparation et lecture des conséquences ; puis infrastructures localisées et diplomatie avec obligations.

### 2026-09-19 — Correctif de la prévision après la fin de campagne

- Revue DeepSeek : la prévision pouvait être émise après la fin de campagne. Correctif du worker DeepSeek : condition `forecast && !over` et textes d'avertissement restants corrigés.
- Racine vérifiée : diff contrôlé et 4 tests climatiques réussis ; build en cours de reconstruction.
- Mode de travail : la racine orchestre, DeepSeek implémente/revient/corrige ; écritures via `exec_command`, pas via `apply_patch`.

### 2026-09-20 — Projection visuelle des infrastructures (lot rendu)

- `world-projection.ts` : signature etendue `projectWorld(year, history, ages?, sites?)`, retrocompatible — sans argument, la projection archivee est identique (verifie par egalite structurelle). Les sites ne se posent que sur une ville existante (`City.id`), dans un ordre canonique fixe et dedoublonne, a six emplacements fixes en bord de parcelle, echelle 0.24 ; le modele de ville est legerement reduit (0.82 au lieu de 0.92) uniquement quand la ville accueille des sites. Villes inconnues ou uniquement futures ignorees.
- `world-scene.ts` : le catalogue de chargement etend `WORLD_ASSETS` par `INFRASTRUCTURE_ASSETS` ; le prefixed `infra_` est detecte avant le chargeur GLTF et les geometries procedurales sont mises en cache puis disposees par le chemin normal (`disposeParts`).
- Tests `apps/player/test/infrastructure-projection.test.ts` : les six types sur la ville correspondante, immuabilite des entrees, ordre stable + doublons, projection anterieure identique sans sites, ville inconnue ou future sans rendu, reduction du modele de ville conditionnee aux sites.
- Validation : 16 tests cibles verts (world-projection, infrastructure-models, infrastructure-projection) et vue-tsc player OK. TypeScript global reste bloque par le module moteur en cours d'ecriture par le worker domaine (`packages/world/src/infrastructure.ts` + son test) — hors perimetre.
- Limite : l'appelant UI n'est pas encore branche aux sites ; rien n'est committe ni pousse. Prochaine action : brancher l'appelant UI une fois le contrat moteur stabilise.

### 2026-09-20 — Livraison v9 et chantier des choix IA réalisables

- Commit `0d150a2` (v9) poussé et fusionné fast-forward dans `origin/main` ; branche actuelle : `codex/feasible-ai-orders`.
- Validation : 592 tests complets, typecheck, vérification de saison et build racine passés.
- Vérification API racine sur `infrastructure-local-42` : spectator-9, 1041 actions, 13 sites, 1042 entrées d'historique, `error: null`.
- Conseil distant v9 réel : l'infrastructure autorisée est choisie, mais d'autres ordres (plan/unités) sont rejetés → rapport `valid: false`.
- Inspection d'image non supportée et auth navigateur indisponible : seul un PNG 1400×900 généré.
- Choix IA réalisables délégués (DeepSeek) en cours, ni implémentés ni vérifiés ; la racine orchestre.
- Reste à faire : obligations diplomatiques et qualité de sortie.

### 2026-09-21 — Revue du lot infrastructures v9 (session parallèle)

- Revue menée depuis un worktree isolé (`codex/revue-infrastructure-v9`, base `f79fcf3`), sans écrire une seule fois dans l'arbre de travail du chantier. Rapport : `docs/reports/revue-infrastructure-v9.md`.
- Vérifié : suite complète verte — 62 fichiers, 597 tests, 30,6 s. Les six échecs « environnementaux » du journal (`aevum-release.test.ts` en ENOMEM, flaky `discovery`) **ne se reproduisent pas** dans un worktree neuf ; ils tenaient au poste, pas au code.
- Vérifié : W4 est couvert par `stateSignature`, qui hache l'état spectateur entier (`sites`, `queues`, `pollution`), et non par `fingerprint()` qui n'est jamais appelé sur une campagne spectateur. Refus enregistrés sans réécriture, versions antérieures intactes, pas de non-déterminisme.
- Trois hypothèses de défaut réfutées à la mesure, écrites pour éviter qu'on les refasse : le resserrement d'options de `f79fcf3` n'est pas une tutelle (sur 7 093 tours-unité, 96 unités reçoivent une liste vide et **aucune** n'avait de case atteignable selon `unitPath`) ; `borders.ts` n'est pas dans le chemin spectateur ; une ville ne peut pas être fondée sur une rivière.
- Corrigé : `queueInfrastructure` et les deux `tick*` improvisaient un état sur le contexte temporaire du caller. Le coût aurait été prélevé sur le stock partagé et la file jetée avec le contexte, sans erreur. `records(ctx)` lève désormais ; test ajouté qui vérifie que la réserve reste intacte.
- Corrigé : `packages/metrics` entre dans `boundaries.test.ts` (non-déterminisme et interdiction d'importer le lecteur) — le trou que `CLAUDE.md` documentait depuis l'origine. Paragraphe de `CLAUDE.md` mis à jour.
- Mesuré : la pollution n'est pas binaire comme je l'avais d'abord écrit. Montée sur 234 tours (730 → 964), bandes intermédiaires peuplées (76/80/78), mais **zéro retour sous le plafond** sur les 77 tours suivants, et une seule ville touchée sur 24 602 observations ville-tour.
- Limites : aucun appel distant, aucun contrôle visuel, une seule campagne v9 archivée (graines 7 et 123 absentes du disque). La preuve distante du lot vaut toujours **un** appel, et le « zéro rejet » des trois graines vient de dirigeants locaux.
- Prochaine action : série distante multi-graines avec part servie affichée, pour trancher les points 1 et 3 du rapport. Elle dépense du quota et attend un feu vert.

### 2026-09-21 — Points ouverts de la revue v9, mesurés

- Douze graines simulées localement (`scripts/infrastructure-seeds-probe.ts`, aucun quota) : **5 graines sur 12 construisent**, 92 sites au total, part de la civilisation dominante à **83,3 % en médiane** (min 29,4, max 92,3), aucun site avant l'action 617. Le système v9 est tardif et concentré ; trois graines n'étaient pas un échantillon atypique.
- Pollution sur ces douze graines : 4 atteignent le plafond, **aucune n'en redescend**. La règle le permet pourtant dès que le solaire couvre la moitié de la demande fossile. Le levier existe et la politique locale ne s'en sert pas — résultat sur les dirigeants, pas défaut du moteur. Je corrige au passage ma propre formule : la montée est graduelle sur 234 tours, pas binaire.
- **Série distante** (`scripts/v9-remote-series-probe.ts`, rapport `docs/reports/v9-remote-series.json`) : 5 conseils sur les graines 42/7/1/17/314, chauffe locale gratuite, correction bornée incluse — donc entre 5 et 10 appels modèle. **Servi par le modèle lui-même : 4/5 (80 %)**, au-dessus de la barre des 70 %. **Conseils valides : 3/5**. Aucun repli silencieux : la graine en échec est rapportée `unavailable`.
- Deux modes d'échec distincts : graine 1, tout le conseil refusé pour un `plan.targetTech` d'énumération invalide alors que `plan` est déjà `nullable().optional()` — contraire au point 5 de CLAUDE.md, qui dit de ne pas jeter une bonne décision pour une question de forme ; graine 17, « Aucun colon ne peut atteindre ce site », c'est-à-dire ce que `settlementPlanSites` devait rendre impossible.
- Vérifié : 62 fichiers, 599 tests, `tsc` et `vue-tsc`. `aevum-release.test.ts` et `discovery.test.ts` repassent aussi isolément — les échecs ENOMEM du journal ne se reproduisent pas.
- Limites : un seul modèle distant, cinq graines, aucun contrôle visuel, campagne distante longue toujours non prouvée.
- Prochaine action : décision à prendre sur la tolérance d'un champ de plan malformé, et sur le caractère absorbant du plafond de pollution. Rien de tout cela n'est du code tant que la décision n'est pas prise.

### 2026-09-21 — Suites de la revue : trois correctifs et une leçon de mesure

- **Un plan malformé ne coûte plus le conseil entier** (`packages/agents/src/council.ts`). Mesuré : un conseil distant sur cinq était refusé en entier parce que `plan.targetTech` portait une valeur hors énumération, alors que ses ordres étaient légaux — contraire au point 5 de CLAUDE.md. Le plan est **retiré**, jamais mis à `null` : `null` annulerait le plan en cours, une décision que le dirigeant n'a pas prise. Seules les anomalies dans `plan` sont pardonnées ; un ordre malformé coule toujours la réponse. Honnêteté sur la preuve : l'erreur n'est pas réapparue aux tirages suivants, la correction est démontrée par test, pas sur le terrain.
- **Le lecteur nomme enfin une absence comme une absence.** `try_files` renvoie la page de l'application en 200 avec du HTML pour un JSON manquant ; `replay-loading.ts` portait la parade mais seules les batailles s'en servaient, si bien qu'un monde non servi s'affichait en « Unexpected token '<' ». La garde est partagée (`fetchServedJson`) et le chargement de monde la traverse.
- **Garde ajoutée sur les sites de fondation annoncés** (`advertised-plan-sites.test.ts`). Deux tirages distants échouent sur une cible de plan refusée par le validateur ; il fallait savoir si le conseil annonçait des sites invalides. Il n'en annonce pas — `foundationTiles` applique exactement les règles de `planIssue`. Le refus vient du modèle, qui sort de ses options annoncées, et le moteur a raison de le refuser.
- **Leçon de mesure, et elle réfute mon propre chiffre.** Second tirage distant sur les mêmes cinq graines et les mêmes ticks : 5/5 servis, 4/5 valides, contre 4/5 et 3/5 au premier. La validité n'est pas une propriété de la graine — la graine 1 a échoué au schéma, puis rendu un JSON illisible, puis réussi, sur trois exécutions du même tick. Agrégat des dix conseils : **9/10 servis par le modèle lui-même (90 %)**, **7/10 valides (70 %)**. Un `valid: true` unique ne mesure rien ; il faut répéter le même tick.
- Vérifié : 64 fichiers, 609 tests, `tsc`, `vue-tsc` et build du lecteur.
- Limites inchangées : un seul modèle distant, cinq graines, aucun contrôle visuel, campagne distante longue toujours non prouvée.
- Prochaine action : décider si le plafond de pollution doit rester absorbant, et faire dire à `docs/infrastructure-v9-design.md` §8 quel mécanisme garantit le rejeu (`stateSignature`).

### 2026-09-21 — Ce qu'un build statique publie réellement

- Vérifié sur le `dist` reconstruit : les trois catalogues résolvent entièrement. Quatre batailles annoncées, quatre livrées ; deux mondes annoncés, deux livrés ; les rapports aussi. **Le mode bataille fonctionne donc sur un hébergeur statique**, contrairement à ce que `CLAUDE.md` affirmait depuis longtemps. Le seul absent est `worlds/status.json`, et c'est normal : il décrit un monde entretenu, pas une archive.
- `apps/player/test/published-catalogue.test.ts` garde ce fait au lieu de le promettre : chaque entrée des trois catalogues doit pointer vers un fichier publié. Les trois conventions d'adresse diffèrent (racine du site pour un monde, relatif à `replays/` pour une bataille, `slug` pour un rapport), ce qui est exactement le détail qu'on casse en déplaçant un fichier.
- Le piège rendait la panne invisible : avec `try_files`, une adresse absente répond 200 avec la page de l'application, donc `res.ok` est vrai et seul `res.json()` échoue, loin de la cause.
- `CLAUDE.md` corrigé sur ce point.
- Vérifié : 65 fichiers, 613 tests, `tsc`, `vue-tsc` et build du lecteur.

- Vérification en service réel, sur le `dist` servi par `vite preview` (même repli SPA que la production) : `replays/index.json`, une bataille, `worlds/index.json`, un monde et `reports/index.json` reviennent tous en **200 `application/json`**. `worlds/status.json`, le seul réellement absent, revient en **200 `text/html`** avec `<` en premier caractère — le piège reproduit en direct, et c'est précisément ce que la garde partagée intercepte par ses deux mécanismes.
- Contrôle visuel toujours impossible sur ce poste : le navigateur Playwright n'est pas installé et le serveur MCP pointe vers un chemin Linux. Aucune capture n'est revendiquée.

### 2026-09-21 — Distribution autonome (lot `codex/distribution-autonome`)

- Chantier choisi pour ne pas croiser Astra : son `docs/release-spectateur.md` annonce « reste à livrer : diplomatie suivie (lot 4) », et range la distribution autonome hors de son périmètre. La diplomatie lui revient.
- `npm run package` produit `dist-app/`, un dossier qui n'exige plus rien de la machine : site déjà construit, serveur réduit à un fichier par esbuild, copie de l'interpréteur Node à côté. **67 fichiers, 101,2 Mo**, dont 99 Mo pour l'interpréteur et 2,4 Mo pour le site ; aucun `node_modules` livré. Le lanceur actuel exigeait quatre choses — Node installé, un `npm ci` avec Internet, un build Vite à l'exécution, et `tsx` — et chacune pouvait échouer chez l'utilisateur.
- L'empaqueteur **vérifie ce qu'il produit** et refuse de rendre un paquet qui échoue : disposition complète, aucun secret (motifs de `scripts/secrets.ts`, paquet détruit en cas de trouvaille), démarrage réel sur un port libre, site effectivement servi, redémarrage après fermeture brutale. Relevé dans `dist-app/manifest.json`.
- **Défaut trouvé par cette vérification, et corrigé** : sous Windows, fermer la fenêtre du lanceur termine le serveur sans signal ni `exit`, donc le verrou du monde survivait à chaque fermeture normale et le lancement suivant échouait. `scripts/launch.mjs` savait s'en sortir, mais le paquet démarre le serveur directement et ne traversait pas cette connaissance. `reclaimStaleLock` la place dans le serveur, sans céder sur l'intention de `lockWorld` : seul un verrou dont le propriétaire est vérifiablement mort (`ESRCH`, jamais `EPERM`) est repris, et la reprise est annoncée. Six tests bornent ce qu'on accepte d'effacer.
- Le port cesse d'être figé (`AEVUM_PORT`, 5174 par défaut) : un conflit de port transformait le démarrage en un clic en échec sans recours, et aucune vérification ne pouvait tourner sans prendre la place d'une instance ouverte. La liste d'origines autorisées suit le port réel.
- Vérifié : 66 fichiers, 619 tests, `tsc`, `vue-tsc`, build du lecteur, et le paquet démarré pour de bon.
- **Non livré, et dit comme tel** : la signature (elle demande un certificat qui n'a rien à faire dans un dépôt — `manifest.json` porte `signed: false`) ; la préservation des sauvegardes à la mise à jour, car les campagnes vivent dans `worlds/` **à l'intérieur** du paquet et un remplacement de dossier les effacerait ; installateur, désinstallation et mise à jour automatique ; les plateformes autres que Windows.
- Prochaine action : sortir les données du dossier d'installation avant de parler d'installateur. C'est ce qui bloque le critère « mises à jour et sauvegardes préservées ».

### 2026-09-21 — Les parties sortent du dossier d'installation

- Suite immédiate de l'entrée précédente, dont l'action suivante annoncée était précisément celle-ci. Le paquet gardait ses campagnes dans son propre dossier : mettre à jour l'application, c'est-à-dire remplacer ce dossier, aurait effacé les parties. Le critère « mises à jour et sauvegardes préservées » était perdu par construction, et aucun soin apporté à un futur installateur ne l'aurait rattrapé.
- `AEVUM_DATA` les en sort (`dataRoot()` dans `spectator-server.ts`, utilisé par le répertoire des campagnes **et** par le verrou). Sans la variable, rien ne change : le dépôt et les tests continuent de résoudre `worlds/` depuis le répertoire courant, et les tests passaient déjà un répertoire explicite. Le lanceur du paquet la place dans `%LOCALAPPDATA%\Aevum`.
- La vérification ne le suppose pas : l'empaqueteur démarre le paquet, crée une vraie partie par `POST /api/demo`, puis contrôle **les deux moitiés** — la partie est bien arrivée dans le dossier de données, et l'installation ne contient aucune donnée. C'est la seconde moitié qui autorise à dire qu'un remplacement de dossier n'emporte rien. `savesLandOutsideInstall` et `installHoldsNoSaves` au manifeste.
- Les quatre critères du backlog sont donc atteints et vérifiés. Seul le mot « signée » ne l'est pas, et ne peut pas l'être depuis un dépôt : `manifest.json` porte `signed: false`.
- Vérifié : 66 fichiers, 619 tests, `tsc`, `vue-tsc`, et le paquet reconstruit puis démarré.
- Reste hors périmètre : installateur, désinstallation, mise à jour automatique, plateformes autres que Windows.

### 2026-09-21 — Travail A de la passation : modèles civils raccordés

- Repris sur `codex/civilian-integration`, depuis `origin/main` (`b3c9328`) avec `codex/civilian-age-models` (`f928768`) fusionné en avance rapide. Les trois fichiers du worker étaient committés et poussés, mais **non branchés** : rien ne les appelait.
- **Le défaut que la passation demandait de vérifier est réel.** `world-projection.ts` faisait `const role = unit.role === "settler" ? "merchant" : unit.role`, puis utilisait ce rôle replié pour choisir la silhouette. La raison du repli est textuelle — `UNIT_NAMES` n'a pas de clé `settler` — mais il avait débordé sur le visuel : l'étiquette disait « Colons » pendant que le modèle dessinait un marchand. `unitAsset(role, age)` tranche désormais sur le rôle réel ; seul le nom affiché garde son repli.
- Raccordement : la projection émet `civilian_{age}_{role}` pour les cinq rôles civils quand l'âge de la civilisation est connu, et `world-scene.ts` route le préfixe `civilian_`. **Cette branche précède celle des âges**, pour la même raison que `infra_` : le premier segment n'est pas un âge, le nom tomberait donc dans le chargeur GLTF et ferait échouer tout le chargement de la scène sur un fichier absent.
- **Sans contexte d'âge, rien ne change** : nom de rôle nu, colon toujours replié sur marchand. Les projections archivées ne se réécrivent pas parce qu'on a ajouté des modèles.
- Séparation du bundle préservée, et mesurée : le module de projection n'importe que les **métadonnées** (`civilian-assets.ts`, sans Three). Bundle initial **280,57 Ko** contre 280,49 avant — +0,08 Ko. Les builders atterrissent dans le chunk 3D paresseux, 90,31 → 98,35 Ko. Le couplage que la passation redoutait (280 → 491 Ko) ne s'est pas produit.
- Sept tests ajoutés (`civilian-projection.test.ts`), dont la garde qui compte : **aucun nom produit par la projection ne peut manquer au catalogue chargeable**. C'est exactement le piège ci-dessus, et il ne se voit pas à la compilation.
- Vérifié : 68 fichiers, 630 tests, `tsc`, `vue-tsc`, build du lecteur.
- Limite inchangée : **aucun contrôle visuel**. Le navigateur Playwright n'est pas installé sur ce poste. Des builders et une projection testés ne sont pas une preuve de rendu.
- Prochaine action : travail B, la diplomatie v10, dont la conception est un brouillon avec huit points à corriger avant de coder.

### 2026-09-21 — Travail B, étape 1 : conception diplomatique corrigée, et un piège désamorcé

- La passation listait huit points à revoir dans `docs/diplomacy-v10-design.md` avant de coder. Le brouillon tenait sur l'essentiel — état additif, offres bornées, ids déterministes, rejeu préservé ; cinq points étaient de vrais défauts, un était déjà correct, et un était vérifiable immédiatement.
- **Le piège des deux chiffres était déjà armé.** `council.ts` composait la provenance d'un conseil local avec `state.rules.slice(-1)` : sous « spectator-10 » cela aurait donné « 0 », et un conseil v10 se serait annoncé **v0** — un mensonge silencieux dans le seul champ qui dit d'où vient une décision. `rulesNumber()` lit le nombre après le tiret, quelle que soit sa longueur. Trois tests, dont un qui vérifie que la provenance réelle d'un conseil local ne finit jamais par `-v0`.
- Corrections portées à la conception, chacune avec le défaut qui l'a demandée : **échange réellement bilatéral** (`give`/`receive`, solvabilité des deux côtés, application atomique) au lieu d'un don à sens unique ; **`accept` ne peut plus être refusé parce qu'une offre existe** — accepter l'exige, la règle du brouillon rendait toute acceptation impossible ; **`accept`/`decline` désignent l'offre par `offerId`** et non par cible + type, sinon une offre remplacée pouvait être acceptée à la place d'une autre ; **l'accord se règle avant toute dépense du tour**, seule position qui empêche de dépenser deux fois la même réserve ; **la mort dissout sans blâme _ni prime_**, et `dissolveOnDeath` passe avant `tickPacts` pour qu'un pacte dissous ne soit pas ensuite compté comme accompli.
- Point confirmé plutôt que corrigé : un `agreement` malformé coule la réponse. La tolérance ajoutée sur `plan` ne s'y étend pas, et le document dit pourquoi — un plan est une annotation, un accord est un engagement qui déplace des ressources.
- Point rétabli : « `stateSignature` couvre v10 sans toucher `campaign.ts` » est **faux**. Les énumérations de `CampaignSchema` et de `SpectatorStateSchema` sont littérales ; sans extension, une campagne v10 ne se parse pas, donc ne se rejoue pas.
- Vérifié : 69 fichiers, 633 tests, `tsc`, `vue-tsc`.
- Prochaine action : implémenter `packages/world/src/agreements.ts` et ses tests contre les quinze invariants du §10, puis l'intégration moteur. **Aucun code v10 n'est écrit à ce jour.**

### 2026-09-21 — Travail B, étape 2 : le module d'accords

- `packages/world/src/agreements.ts` : schémas zod, règles et helpers purs, sur le modèle d'`infrastructure.ts`. Aucune dépendance au spectateur, ni horloge ni aléatoire. Ids déterministes `agreement-v1:<round>:<from>:<to>:<kind>:<seq>`.
- Il implémente la conception corrigée, et chaque règle porte le défaut qui l'a demandée : échange **bilatéral** (`give`/`receive`, les deux côtés vérifiés avant que rien ne bouge, application atomique) ; acceptation bloquée seulement par un **pacte actif**, jamais par l'existence d'une offre ; `accept`/`decline` par **`offerId`** ; `dissolveOnDeath` sans blâme **ni prime**, à exécuter avant `tickPacts`.
- Refus nommés, jamais de réécriture silencieuse : quatorze motifs explicites. Une offre refusée survit jusqu'à son expiration au lieu d'être consommée.
- `records(ctx)` lève plutôt que d'improviser un état — la leçon de la revue v9, reprise telle quelle.
- **22 tests** (`packages/world/test/agreements.test.ts`). Un a d'abord échoué et c'était mon fixture, pas le code : mes offres de remplissage partageaient une paire, donc `propose` les remplaçait au lieu de les empiler. Corrigé sur douze paires ordonnées réellement distinctes, ce qui a permis de fixer au passage un comportement utile : **à saturation, remplacer sa propre offre reste possible**, puisque le remplacement ne fait pas grandir la file.
- Trois invariants du §10 ne sont **pas** ici, et le fichier de test le dit : budget partagé sur un tour, régression des rejeux v1 à v9, et « un seul accord par tour » se mesurent à l'intégration moteur.
- Vérifié : 70 fichiers, 655 tests, `tsc`, `vue-tsc`.
- **Rien n'est encore branché** : `spectator.ts` ignore ce module, aucune règle `spectator-10` n'existe, aucun contrat IA ne porte `agreement`. Prochaine action : l'intégration moteur, avec l'extension des énumérations de version que la conception §9 détaille.

### 2026-09-21 — Travail B, étape 3 : v10 branchée au moteur

- **La cause de la répétition, traitée avant d'ajouter une 93ᵉ occurrence.** Les gardes de version étaient écrites en clair — `["spectator-6", …, "spectator-9"].includes(state.rules)` — 92 fois dans le dépôt, sous **sept formes qui sont toutes le même seuil**. `SPECTATOR_RULES` + `atLeast(rules, plancher)` le disent une fois : 29 listes et 9 comparaisons exactes converties dans le moteur, et le schéma de campagne partage désormais le même catalogue que l'état. Refactor **neutre, vérifié** : 655 tests inchangés avant/après.
- v10 branchée dans `resolveCouncil`, dans l'ordre fixé par la conception : expiration des offres en début de tour, **l'accord réglé avant toute dépense**, la diplomatie héritée inchangée derrière, puis `dissolveOnDeath` **avant** `tickPacts`. Une guerre que le moteur accepte rompt le pacte ; une guerre refusée par une trêve ne passe jamais par là.
- Huit types d'événements ajoutés à l'union de `events.ts`. Vérifié que les consommateurs filtrent par type au lieu d'exhausiver : un type ajouté n'efface rien.
- **Sept tests d'intégration**, dont les trois invariants que le module seul ne pouvait pas prouver : aucune réserve en négatif après un échange qui vide une ressource (W6), rejeu v10 à l'identique (W4), et une campagne v9 qui traverse le moteur modifié **sans gagner un champ ni changer de signature**.
- Le test de rejeu a d'abord échoué, et c'était **mon test** : j'enrichissais les réserves après la création alors qu'un rejeu repart d'un monde neuf. W4 l'a signalé au premier tour — exactement son rôle. Corrigé en dimensionnant l'échange sur les réserves initiales.
- Vérifié : 71 fichiers, 662 tests, `tsc`, `vue-tsc`.
- **Reste pour rendre v10 utilisable par un modèle** : le contrat IA (schéma fournisseur, consigne) et l'observation (`councilOptions`), puis le panneau spectateur. Sans eux, aucun dirigeant distant ne peut proposer quoi que ce soit.

### 2026-09-21 — Travail B, étape 4 : le contrat IA et l'observation

- Même traitement que pour le moteur : les gardes de version de `packages/agents` passent au seuil (20 listes et 5 comparaisons exactes converties). Sans cela, v10 aurait hérité de **rien** — ni plan, ni modernisation, ni infrastructures — et rien ne l'aurait signalé.
- `AGREEMENT_COUNCIL_JSON_SCHEMA` : le contrat v9 plus la commande d'accord, plate et à champs nuls. `offerId`, `give` et `receive` sont exigés dans la forme.
- Observation : `agreements` porte offres entrantes et sortantes avec leurs identifiants, pactes et manches restantes, confiance de l'acteur, et les **options légales** calculées par la couche qui détient les règles — pas redites dans l'observation. C'est la leçon de `settlementPlanSites` : une liste qui annonce ce que le moteur refuse ensuite est pire que pas de liste.
- Consigne v10 explicite sur ce qui coule une réponse, sur les deux contributions d'un échange, et sur le fait qu'une offre remplacée voit son identifiant refusé.
- **Sept tests**, dont celui qui compte pour la confidentialité : les réserves d'une rivale ne fuient pas dans l'observation. Une offre dit ce qu'elle demande, jamais ce que l'autre possède.
- Vérifié : 72 fichiers, 669 tests, `tsc`, `vue-tsc`.
- Reste : le panneau spectateur, puis une sonde de rejeu et un échantillon distant borné.

### 2026-09-21 — Travail B, étape 5 : le panneau spectateur

- `AgreementsPanel.vue` : pactes actifs et manches restantes, propositions reçues et émises **avec leurs deux contributions**, confiance qualifiée (bonne / neutre / abîmée) plutôt qu'un nombre nu, faits récents. Branché dans la fiche du dirigeant, sous le panneau d'infrastructures.
- **Strictement en lecture.** Un test vérifie qu'aucun `<button>`, `<input>`, `<select>` ni `<form>` n'est rendu : le choix du projet est « spectateur uniquement », et un contrôle ici le trahirait sans qu'on s'en aperçoive.
- Un autre test vérifie qu'une offre entre deux tiers n'apparaît pas dans la fiche d'une troisième civilisation.
- **Le même piège trouvé côté lecteur, et corrigé** : `Spectator.vue` gardait `["spectator-9"].includes(...)`, qui aurait **masqué les infrastructures en v10**. Quatre listes converties au seuil ; l'aperçu de démonstration passe en `spectator-10`.
- Bundle initial 280,57 → **285,12 Ko** (+4,5 Ko) pour le panneau et le module d'accords. Build vert.
- Vérifié : 73 fichiers, 674 tests, `tsc`, `vue-tsc`, build du lecteur.
- Reste : une sonde de rejeu v10 et un échantillon distant borné, puis le bilan du lot 4 dans `release-spectateur.md`.

### 2026-09-21 — Travail B, étape 6 : la diplomatie se produit vraiment

- **Un module testé ne prouve pas qu'une campagne en fera usage.** `localCouncil` ne s'engageait jamais : la fonctionnalité aurait existé dans le moteur et nulle part ailleurs, et le parcours sans clé — la démonstration — aurait toujours affiché « aucune promesse échangée ». La politique locale répond désormais à ce qu'on lui propose, et ne propose qu'à défaut.
- `scripts/agreements-probe.ts` joue six campagnes locales complètes, compte les événements réels puis **rejoue chaque campagne**. Résultat : **6 rejeux sur 6 vérifiés** (W4 tient sous v10), 99 offres, 86 acceptées dont **60 pactes et 26 échanges**, 10 refusées, 27 pactes menés à terme, **zéro accord refusé par le moteur**.
- **Deux corrections que la mesure a imposées**, et je les écris parce qu'elles disent quelque chose. Premier relevé : 84 offres, 84 acceptées, **0 échange** — la politique ne proposait jamais de commerce, donc le chemin bilatéral n'était exercé que par des tests unitaires. Elle commerce maintenant une fois ses pactes signés. Second : le rapport annonçait « 6 accords refusés », ce qui était **faux** — la sonde comptait tous les rejets du tour. Deux compteurs distincts désormais, et le vrai chiffre est zéro.
- Limites écrites dans `docs/reports/diplomatie-v10.md` : ni rupture, ni dissolution, ni expiration observées en campagne — les trois chemins sont bornés par des tests mais ne se produisent pas, donc la confiance n'est jamais descendue. Et **aucun modèle distant n'a joué la v10**.
- Lot 4 de `docs/release-spectateur.md` marqué livré, avec ses chiffres et ses limites.
- Vérifié : 73 fichiers, 674 tests, `tsc`, `vue-tsc`.

### 2026-09-21 — Travail B, étape 7 : un dirigeant distant répond à une offre

- La question concrète que la conception posait : un modèle **recopie-t-il** l'identifiant qu'on lui annonce, ou en fabrique-t-il un ? Un identifiant inventé est refusé, et c'est voulu — mais si aucun modèle ne sait en copier un, le choix de `offerId` serait joli et inutilisable.
- `scripts/v10-remote-probe.ts` : chauffe locale gratuite jusqu'au premier tour où l'acteur a une offre à traiter, puis **un seul** appel par graine. Trois conseils demandés : **2 servis par le modèle lui-même, 2 valides, 0 rejet, et 2 sur 2 ont recopié l'identifiant exact** — `accept` avec tous les autres champs à `null`, la forme plate tient. La troisième graine a expiré côté transport et est rapportée `unavailable`, jamais remplacée en silence.
- Limites écrites : trois appels ne font pas un taux, et le chemin `propose` avec deux contributions n'a pas encore été emprunté par un modèle — seul `accept` l'a été. Aucune campagne distante longue sous v10.
- `CLAUDE.md` corrigé une troisième fois : il affirmait que `branding.test.ts` scanne l'arbre de travail entier, fichiers non suivis compris. C'est faux depuis qu'il demande sa liste à `git ls-files` — il ne voit que ce qui est suivi.
- `docs/release-spectateur.md` à jour : lot 4 livré avec ses chiffres, et la ligne « reste à livrer » ne l'annonce plus.
- Vérifié : 73 fichiers, 674 tests, `tsc`, `vue-tsc`.

### 2026-09-21 — Clôture de la reprise

- `PASSATION_AGENT.md` versé dans le dépôt. Il n'était **pas suivi par git** et aurait disparu avec le dossier de travail d'Astra. Conservé tel qu'écrit, avec un en-tête d'état : ses travaux A et B sont faits, et une session qui les suivrait referait du travail livré.
- Vérification finale de bout en bout : **73 fichiers, 674 tests**, `tsc`, `vue-tsc`, et le paquet autonome reconstruit puis **démarré pour de vrai** — disposition complète, zéro secret, site servi, sauvegardes hors de l'installation, redémarrage après fermeture brutale avec reprise du verrou.
- État des lots de `docs/release-spectateur.md` : 1, 2, 3 et **4 livrés**. Restent 5 (lecture et identité) et 6 (accès et fiabilité).
- Les trois limites qui traversent tout le projet, et qu'aucune mesure locale ne lèvera : **aucune campagne distante longue** n'a jamais été jouée, sous aucune version ; **aucun contrôle visuel** n'est possible sur ce poste, le navigateur n'étant pas installé ; le paquet **n'est pas signé**, faute de certificat.

### 2026-09-21 — Lot 5, première pièce : décision, action, conséquence

- La navigation par moments importants existait déjà côté spectateur ; ce qui manquait au lot 5 est le **lien entre une décision et ce qu'elle a produit**.
- `packages/world/src/plan-history.ts` reconstitue l'histoire des plans d'une civilisation **sans rien ajouter à l'état**. Le moteur ne garde que le plan courant ; son passé n'a pas besoin d'exister, puisqu'une campagne conserve tous ses états et que le rejeu les reproduit à l'identique (W4). Zéro octet de plus dans la signature de rejeu.
- **Deux voix, jamais mélangées.** `rationale` est ce que le dirigeant a écrit, mot pour mot ; `detail` est ce que le moteur a mesuré — « Colons à 3 case(s) de l'objectif », « La case de fondation est indisponible ». Le lecteur compare une intention à son résultat sans qu'on lui souffle la conclusion, et rien n'invente un raisonnement que personne n'a tenu.
- Un chapitre par plan adopté. Un plan remplacé se referme sur le dernier état connu **sans qu'on lui invente une fin** : changer d'avis est un fait de l'histoire, pas une anomalie. Un pas n'est montré que s'il dit quelque chose de neuf.
- `PlanHistory.vue` : bilan (« 3 plans adoptés — 1 tenu, 1 bloqué, 1 abandonné »), puis chaque chapitre avec sa citation et ses constats. **Le panneau ne montre pas l'avenir du curseur** : il tronque l'histoire à la position du lecteur, sinon il divulguerait la fin d'une campagne qu'on parcourt.
- 7 tests sur la dérivation, 6 sur le panneau — dont l'absence de tout contrôle et le fait qu'une autre civilisation n'apparaît jamais.
- Vérifié : 75 fichiers, 687 tests, `tsc`, `vue-tsc`, build (bundle 285,12 → 288,34 Ko).

### 2026-09-22 — Lot 6 : la campagne distante longue, enfin mesurée

- C'était la limite recopiée dans chaque rapport depuis le début, et **elle n'avait jamais été mesurée** : toutes les preuves distantes tenaient en un appel ou une poignée, chacune dans son propre processus. `scripts/remote-campaign-probe.ts` joue des tours **consécutifs**, écrit l'archive à chaque tour, puis rejoue la campagne.
- Résultat, quatre exécutions : **10 tours distants joués, 10 servis par le modèle lui-même, zéro ordre rejeté, quatre rejeux vérifiés sur quatre.** Le contrat tient donc en conditions réelles, et W4 vaut aussi pour une campagne distante partielle.
- **Ce qui arrête la campagne n'est pas le contrat.** Trois exécutions sur quatre s'arrêtent au troisième conseil consécutif. Quatre hypothèses testées, toutes écartées : le modèle (le même pour les quatre dirigeants), la taille de la demande (celle qui échoue est **la plus petite** : 23 422 caractères contre 24 224), la cadence (15 s puis 60 s d'écart ne changent rien), le catalogue (six requêtes d'affilée, six 200 sous 500 ms). Reste le point d'inférence.
- **Deux défauts corrigés en chemin.** L'erreur ne nommait pas l'appel fautif — « Délai de réponse IA dépassé » couvrait catalogue et complétion indifféremment, ce qui rendait le diagnostic impossible ; les deux sont distingués et le message remonte jusqu'au rapport, qui dit maintenant `Délai dépassé sur la complétion Nous`. Et un corps de réponse n'était **jamais lu** quand le statut était en erreur : sous `undici` un corps non consommé garde sa connexion hors du pool, donc quelques refus suffisent à faire expirer tout le reste. Latent aujourd'hui, mais armé dès le premier 429.
- **Honnêteté sur ce correctif** : l'exécution suivante a atteint quatre tours au lieu de deux, puis celle d'après s'est arrêtée au troisième. Une exécution ne prouve rien, et attribuer ce gain au correctif serait lui prêter un résultat qui tient peut-être au hasard.
- `CLAUDE.md` gagne un dixième point réfuté : le palier n'est ni un simple budget d'appels ni un débit au sens habituel. Un script qui enchaîne des appels doit écrire son état à chaque tour et savoir repartir d'un processus neuf.
- Lot 6 marqué **partiellement livré** dans `docs/release-spectateur.md`, avec la part acquise et la part qui ne l'est pas.
- Vérifié : 75 fichiers, 687 tests, `tsc`, `vue-tsc`.

### 2026-09-22 — La reprise entre processus, et ce qu'elle a réfuté

- Mon propre rapport désignait la reprise comme la piste la moins chère : l'archive est écrite à chaque tour, il ne manquait que la relecture. `--resume` relit l'archive, **rejoue** la campagne pour retrouver l'état — la seule façon honnête, qui vérifie au passage ce qu'on reprend — et poursuit.
- **Et l'expérience a réfuté l'hypothèse qui l'avait motivée.** Les quatre premières exécutions donnaient « deux appels réussis puis l'arrêt », ce qui suggérait une limite par processus. Trois processus successifs avec reprise : le premier ajoute 2 tours, les deux suivants **échouent dès leur premier appel**. Un processus neuf n'obtient donc pas ses deux appels. Et le même conseil avait réussi une fois en troisième position.
- L'échec ne suit ni le rang de l'appel, ni la civilisation, ni le contenu : l'observation bloquée mesure 23 301 caractères, la **deuxième plus petite** des quatre, sans mémoire accumulée. Ce qui reste compatible est une allocation de compte sur une fenêtre de temps, que le fournisseur épuise en cessant de répondre plutôt qu'en refusant — **non établi**, et écrit comme tel.
- La reprise est conservée : elle est correcte, vérifiée par rejeu, et c'est la bonne architecture dès que les appels sont disponibles. Elle ne contourne simplement pas cette limite-ci. Rapport et `CLAUDE.md` corrigés en conséquence.
- **Suite de tests rendue fiable.** Cinq tests échouaient en parallèle et passaient seuls : ils rejouent des centaines de tours de moteur, et le délai par défaut de cinq secondes mesurait la charge de la machine, pas la correction. Défaut global porté à 30 s, et les deux tests qui portaient leur propre délai de 20 s relevés à 45 s — un délai propre l'emporte sur le défaut, ce qui expliquait qu'ils résistent au premier correctif. **687 tests verts, deux exécutions de suite.**

### 2026-09-22 — Le contrôle visuel, enfin fait — et ce qu'il a trouvé

- Le navigateur d'Orca rend le contrôle visuel possible : `orca tab create`, `snapshot`, `eval`. Campagne v10 de 480 tours ouverte sur un serveur local, fiche du dirigeant inspectée. Les trois panneaux rendent avec de vraies données : **Infrastructures avancées**, **Accords**, **Décisions et conséquences**.
- **Et il a trouvé un défaut qu'aucun test ne voyait.** Le panneau affichait pour amber une confiance de **−35 envers crimson** — exactement `TRUST_DELTAS.brokenByWar`. Un pacte avait donc été rompu par une guerre, alors que la sonde rapportait `broken: 0` et que le rapport écrivait « aucune rupture observée ».
- Cause : `breakPactsOnWar` consigne bien la rupture dans l'historique et fait chuter la confiance, mais les deux autres blocs v10 émettent leurs événements en relisant l'historique juste après leur propre appel. Celui-ci, logé dans le bloc diplomatie, n'émettait rien. **Une trahison par la guerre ne parvenait jamais à la chronique** — dans un projet dont le point est qu'une promesse rompue se voie.
- Corrigé par un helper partagé (`sayAgreements`) utilisé aux trois endroits, plus une régression qui exige **l'événement** et pas seulement l'entrée d'historique.
- Mesure refaite : **18 ruptures** là où elle en annonçait zéro. Le reste inchangé — 99 offres, 86 acceptées dont 60 pactes et 26 échanges, 27 menés à terme, 6 rejeux sur 6.
- Corrigé au passage un défaut de la sonde : `--write-demo` passé en troisième position était pris pour le chemin du rapport, qui partait donc dans un fichier nommé comme le drapeau. Les positionnels excluent désormais les drapeaux.
- Ajouté `--write-demo` à la sonde v10 : elle écrit `worlds/spectator/agreements-local-42.json`, une campagne regardable, jamais par-dessus une existante.
- Vérifié : 75 fichiers, 688 tests, `tsc`, `vue-tsc`.
- La leçon, qui vaut d'être gardée : deux mesures pouvaient dire vrai chacune à sa manière — l'historique portait la rupture, les événements ne la portaient pas — et c'est l'écart entre les deux, visible seulement sur la page, qui a révélé le défaut.

### 2026-09-22 — Le contrôle navigateur de la « Validation finale »

- Le navigateur d'Orca permet aussi de cocher, à l'écran, les items que le fichier de livraison réclamait sans preuve. Campagne v10 de 480 tours servie en local.
- **Reprise** : le lecteur restaure seul la dernière campagne visitée — ouvert sur `/`, il revient sur `?campaign=agreements-local-42`.
- **Navigation historique, et ma propre règle vérifiée en vrai.** Curseur déplacé de 480 à 120 : « 6 plans adoptés, 4 tenus, 2 bloqués » devient « 4 adoptés, 3 tenus, 0 bloqué » ; le plan `masonry`, _tenu_ à la fin, s'affiche **« en cours »** au tour 120 ; la confiance envers azure passe de 100 à 45. Le panneau montre donc l'état **connu à ce moment-là**, pas l'issue finale — exactement ce que le test affirmait, désormais constaté.
- **Bilan** : « 480 manches terminées · Dirigeants locaux déterministes », tableau comparant âge et parcours, habitants, villes, découvertes et plans accomplis. Ce sont les « forces comparables » du lot 5, vues et non plus seulement dérivées.
- Limite restante : la **vue 3D** n'a pas été inspectée, et le runtime du navigateur tombait par intermittence — la machine manquait de mémoire, au point de tuer le serveur une fois.

### 2026-09-22 — « Il manque un certificat » : ma propre affirmation, vérifiée et fausse

- J'avais écrit que le paquet autonome n'était pas signé parce qu'il manquait **un certificat**. Vérification sur le paquet réellement produit, avec `Get-AuthenticodeSignature` : `runtime/node.exe` est **déjà signé et valide, par l'OpenJS Foundation** — le resigner reviendrait à usurper son éditeur ; `Lancer Aevum.cmd` renvoie `UnknownError`, parce qu'un fichier batch **ne peut pas porter** de signature Authenticode ; et `signtool.exe` n'est pas dans le PATH.
- Autrement dit : **le paquet ne contient rien qui nous appartienne et qui soit signable.** Une application signée demande d'abord de produire notre propre exécutable — un binaire unique à la manière de Node SEA — puis un certificat, puis le SDK Windows. Trois choses, pas une.
- Corrigé aux deux endroits qui le disaient : `docs/reports/distribution-autonome.md` et la liste des limites de `docs/release-spectateur.md`. Le manifeste porte toujours `signed: false`, ce qui reste exact.
- La leçon est la même que celle des mesures réfutées plus haut : une limite énoncée sans la vérifier oriente le travail suivant vers la mauvaise dépense — ici, acheter un certificat n'aurait rien signé du tout.

### 2026-09-22 — La vue 3D regardée, et trois défauts que 688 tests ne voyaient pas

- **La campagne de démonstration ne se chargeait plus.** Le lecteur disait « Données invalides ou sauvegarde illisible » ; le fichier était sain, c'est le rejeu qui divergeait au tour 10. Cause : mon correctif de la trahison émet un événement de plus, et les événements d'un tour alimentent `state.memory` — le dirigeant trahi s'en **souvient** désormais, ce qui est le but, mais la mémoire est dans l'état, donc dans la signature. Vérifié dans les deux sens : le moteur d'avant rejoue la campagne, celui d'après non.
- **Corollaire écrit dans `CLAUDE.md` :** W4 vaut à l'intérieur d'une version. Changer le comportement d'un jeu de règles déjà joué invalide ses enregistrements ; la prochaine évolution d'un jeu livré prend un numéro. Portée réelle ici : un fichier local, régénéré ; rien de publié n'est en `spectator-10`.
- **La vue 3D rend, et rend juste.** Toile WebGL 1289 × 921, aucune erreur de console, aucun repli 2D. La preuve la plus nette est l'architecture : le bilan annonce Azur au **Moyen Âge** et les trois autres à l'**Antiquité** ; sur la carte, le territoire d'Azur porte des **tours de pierre à toit conique**, partout ailleurs des **temples à colonnes**. Les modèles suivent les âges, et on le voit au lieu de le déduire. Mine avec ses rails, champs labourés, bannières de faction, silhouettes civiles.
- **Limite honnête :** au zoom maximum une unité civile fait treize pixels. Le rôle se lit sur l'étiquette, pas sur la silhouette — le correctif « le colon n'est plus dessiné en marchand » reste prouvé par le test, pas par l'œil.
- **Six seuils de version recopiés en clair.** La conversion vers `atLeast` en avait manqué six, et aucune ne fait échouer un test : une liste périmée ne casse rien, elle **retire une capacité en silence**. Sous `spectator-10` : le rapport climatique disparaissait entièrement ; le bilan comptait des tours en les appelant « manches » ; le serveur consultait **les quatre dirigeants au lieu du seul acteur** — quatre appels distants par tour au lieu d'un, dans un projet dont le principe est l'inverse ; un dirigeant injoignable était passé au lieu d'être redemandé ; le compte à rebours des crises partait du mauvais compteur ; la limite tombait à 1000 tours au lieu de 1200.
- **Démonstration à l'écran de la plus visible.** Avant : « Manche 480 », « Chronique terminée ». Après : « Manche 121 », « Ambre à son tour ». L'horizon est de 300 manches : le lecteur déclarait la campagne finie **à 40 % de son parcours**.
- **La garde qui aurait coûté zéro** est désormais dans `boundaries.test.ts` : aucun fichier hors `spectator.ts` ne peut énumérer deux `"spectator-N"` à la suite. Plus deux régressions de comportement — rapport climatique en v10, manches et non tours. Les trois ont été contrôlées en réintroduisant le défaut : elles échouent bien.
- Vérifié : `tsc`, `vue-tsc`, **691 tests** sur 75 fichiers. Rapport complet dans `docs/reports/controle-navigateur.md`.

### 2026-09-23 — Les autres écrans, et le contrôle qui ne contrôlait plus rien

- Écrans restants regardés : chronique d'archive, batailles en 2D et en 3D, règles, « À propos », observatoire à d'autres largeurs. Batailles, règles et « À propos » rendent proprement.
- **La feuille de l'observatoire écrasait la chronique d'archive.** `spectator.css` est non scopée, et `main.ts` importait les deux racines statiquement : `.civilizations { position: absolute }` sortait le tableau comparé de la chronique de son flux, 295 px par-dessus le titre. Présent depuis l'arrivée de l'observatoire (12 septembre). Corrigé à la racine : seule l'application montée est chargée, et chacune n'apporte que sa feuille — mesuré, `Spectator.css` n'est plus demandé sur une page d'archive. Test `entry-isolation.test.ts`.
- **Les panneaux flottants de l'observatoire se recouvraient**, mesuré rectangle par rectangle par Chrome en CDP : la prévision de crise couvrait la barre d'outils entre 721 et 1100 px (jusqu'à 303 × 51 px, « Carte 2D », « Ordres », « + » cachés) ; bulletin et outils sous les contrôles de 3 et 6 px entre 1101 et 1250 ; bulletin sur les outils de 13 px sous 720 ; outils sous les contrôles de 41 px sous 411. Invisible jusqu'ici en v10 pour une raison précise : le bulletin n'y existait pas, le rapport climatique ayant disparu avec les seuils de version. Corrigé par empilement ; aucun chevauchement de 360 à 1440 px, chaque frontière de palier des deux côtés.
- **Un 404 à chaque ouverture du monde par défaut** : le lecteur devinait le chemin de la courbe d'apprentissage quand l'index n'en donnait pas, alors que l'indexeur ne l'écrit que si un fichier valide existe. On ne devine plus que hors index.
- **`qa:browser` ne pouvait plus passer depuis trois semaines**, et personne ne le voyait parce qu'il ne tournait jamais ici : aucun chemin Windows pour Chromium ; `process.kill(-pid)` n'arrêtait jamais Chrome sous Windows (neuf processus vivants après un passage) ; le profil verrouillé levait `EPERM` au nettoyage, qui remplaçait le verdict ; il ouvrait `/`, devenu l'observatoire ; il attendait « ARCHIVES », renommé « Archives ». Réparé, il a aussitôt trouvé le 404. **36 contrôles verts.**
- Même réparé, il ne mesurait pas le recouvrement, donc aucun défaut de mise en page. Ajouté : les blocs de la chronique ne se recouvrent pas — sur l'ancien `main.ts`, échec aux trois largeurs, « stage × civilizations : 351 × 185 px ».
- **Un contrôle retiré parce qu'il ne pouvait pas échouer.** Le non-recouvrement des panneaux de l'observatoire, ajouté à `qa:browser`, passait sur l'ancienne feuille défectueuse : sans API, l'observatoire n'y montre que son aperçu initial, sans bulletin. Remplacé par `npm run qa:observatory`, contre le vrai serveur et une vraie campagne : **14 largeurs sur 18 en échec** sur l'ancienne feuille, chaque défaut retrouvé. Lui-même avait un défaut de mesure — il mesurait parfois l'aperçu avant le rejeu, le bulletin semblant absent à huit largeurs sur dix-huit d'une même partie ; il attend désormais la fin de l'aperçu et dit quand le bulletin manque.
- `CLAUDE.md` décrivait encore une seule racine choisie par `?view=` : corrigé, c'est cette phrase qui aurait envoyé la prochaine session sur la mauvaise page.
- Au passage : la sonde distante ne consultait que l'acteur et ne passait pas par le serveur ; le bug « quatre dirigeants » ne touchait donc que le jeu v10 à distance via l'application, et la mesure publiée tient.
- Vérifié : `tsc`, `vue-tsc`, **693 tests** sur 76 fichiers, `qa:browser` 36/36, `qa:observatory` 18/18.

### 2026-09-23 — La campagne longue a eu lieu ; l'exécutable est à nous ; et l'hypothèse d'hier était fausse

- **Fournisseurs.** Le code en connaît cinq ; seul Nous a une clé ici — relevé par le serveur, qui ne dit que « configuré ou non ». Catalogue Nous : 7 modèles gratuits sur 409. `step-3.7-flash` et `solar-pro4` refusent toute requête (« missing tags ») ; `longcat` et `laguna-s-2.1` répondent.
- **Campagne distante longue : 39 tours consécutifs** avec `laguna-s-2.1`, tous servis par le modèle lui-même, 45 requêtes dont 4 relances récupérées, médiane 14,5 s, rejeu vérifié. Arrêt au 40ᵉ sur un **HTTP 429** explicite. 19 ordres rejetés, dont 18 constructions : rejouée, la campagne montre qu'**aucune** ne figurait dans les options proposées — c'est le modèle qui lit mal, pas le contrat.
- **La cause du blocage de `longcat` est établie, et l'hypothèse d'hier réfutée.** Même compte, même jour : `longcat` bloque encore au même conseil — ce n'est pas une allocation de compte. Sur la graine 7, il passe le troisième et bloque au cinquième — ce n'est pas le rang de l'appel. Le conseil bloquant rejoué avec quatre minutes de délai : **132,9 s, 6 000 jetons de sortie, `finish_reason: length`, zéro caractère.** Il raisonne jusqu'au plafond et ne répond jamais ; `effort: "none"`, `"low"`, `enabled: false` et un plafond de raisonnement sont tous ignorés. La reprise échouait « au premier appel » parce qu'elle rejouait le même état.
- **La faute de méthode, écrite pour qu'elle serve** : « le modèle ? non, les quatre dirigeants partagent le même » avait été rangé parmi les hypothèses écartées. Partager un modèle ne l'innocente pas ; en essayer un autre, si. Rapport de campagne distante annoté plutôt que réécrit, `CLAUDE.md` corrigé en deux endroits.
- **Groq gratuit exclu par le calcul** : un conseil fait 9 197 jetons d'entrée, sa limite est de 8 000 par minute. Mistral, déjà dans le code, offrirait un débit largement suffisant — il faut une clé. Modèle par défaut inchangé : c'est un choix de produit.
- **Signature : notre propre exécutable.** `Aevum.exe` (`node --build-sea`) remplace `runtime/node.exe`, le serveur `.mjs` et le `.cmd`. Deux défauts trouvés en route : `--build-sea` laisse l'en-tête désigner l'ancienne table de signature, désormais au milieu d'une section — Windows exécute, mais refuse de signer (« pas une application Win32 valide ») ; `pe-signature.ts` la retire, seulement si elle est entière en fin de fichier, testé sur des en-têtes fabriqués. Et dans l'exécutable, `import.meta.url` est indéfini dans le module chargé à la demande : la garde du serveur concluait « pas lancé directement » et le paquet se terminait, code 0, en silence — démarrage rendu explicite (`startServer()`).
- Signé sans SDK, par `Set-AuthenticodeSignature`. Éprouvé de bout en bout avec un certificat jetable, supprimé ensuite : l'empaqueteur signe, puis démarre l'exécutable signé, sert le site et redémarre après une fermeture brutale. Manque un certificat reconnu : il s'achète. La recherche de secrets lit désormais le code serveur **avant** qu'il soit scellé dans le binaire — sans quoi il serait sorti du contrôle en silence.
- **« À propos » débordait sur téléphone** : 864 px pour 375. En émulation mobile c'est la fenêtre qui s'élargissait, si bien qu'aucun élément ne dépassait. Grille à une colonne implicite ; `minmax(0, 1fr)`, comme au-delà de 1000 px. Les trois vues d'archive sont désormais mesurées par `qa:browser` : **63 contrôles**.

### 2026-09-23 — Le banc des modèles gratuits : un modèle stable et propre, sans clé

- **`npm run bench:models`** : les mêmes six situations, reproduites par le dirigeant local, soumises à chaque modèle par le chemin du produit — même prompt, même correction, même délai de 45 s ; seule la destination change. Puis `--consecutive=20`, vingt tours réellement joués. Seize modèles appariés : 5 chez Nous, 8 chez Kilo, 3 en local.
- **Trouvé, et écarté** : OVH anonyme répond 429 dès la première requête ; LLM7 n'est plus sans clé ; les modèles gratuits d'OpenCode Zen sont réservés à l'application OpenCode (403) — exclus sans contournement ; OpenCode Go est l'abonnement d'Hermes, « conçu pour les agents de code » et surveillé : aucune requête de jeu n'y a été envoyée, c'est une décision qui revient à l'utilisateur.
- **Kilo** sert ses modèles `:free` sans clé, et c'est documenté (200 requêtes/h par IP). `dots-3-note-preview` : 6/6 en situations, **20/20 en durée, 19 valides du premier coup, un rejet**. Second choix, `nex-n2.5-mini` : 20/20, 13 valides.
- **Une situation isolée ne suffit pas.** `ling-3.0-flash-sante` : zéro rejet sur six situations, quinze en vingt tours réels — le même grenier refusé redemandé quatorze fois. `longcat`, le plus soigneux quand il répond, perd 3 tours sur 20, relances comprises.
- **Local** : Ollama installé, `qwen2.5:7b`, `ministral-3:8b`, `gemma3:12b` avec un contexte porté à 16 384 — sans quoi le prompt de 9 200 jetons aurait été tronqué en silence. `gemma3:12b` : 20/20 en durée, entièrement en mémoire graphique, mais 13 rejets. Le seul qui ne peut pas tomber ; loin derrière en propreté.
- **Kilo ajouté au produit** (`kilo:`), anonyme pour ses seuls modèles `:free` : un modèle payant ne part jamais sans clé, aucun autre fournisseur ne devient anonyme. `AEVUM_COUNCIL_MODEL` choisit le modèle des conseils chez n'importe quel fournisseur.
- **La première campagne par le produit s'est arrêtée au premier tour**, là où le banc réussissait vingt fois. `RemoteProvider` n'envoyait jamais `reasoning: { effort: "none" }` ; même conseil, seul ce champ changeant : plus de 45 s sans, 6 s avec. `REASONING_OFF_MODELS`, pour les seuls modèles mesurés.
- **Relancée : 40 tours sur 40, 40 requêtes sans une relance, un seul ordre rejeté, 5,2 s de médiane, rejeu vérifié.** Le modèle par défaut reste `longcat` : en changer est un choix de produit.
- Vérifié : `tsc`, `vue-tsc`, **707 tests**. Rapport : `docs/reports/banc-modeles.md`.

### 2026-09-24 — Tout le catalogue gratuit, et seuls les stables retenus

- La partie à quatre modèles s'était arrêtée avec la session (54 tours) ; reprise en processus Windows indépendant, puis **arrêtée à 66 tours sur décision** : elle mettait délibérément deux modèles instables en jeu, et partageait avec le banc la limite de Kilo par adresse IP. Archive conservée.
- **Critères écrits avant toute mesure** — crible, banc apparié de six situations (5 réponses, 3 valides du premier coup, 20 s), durée de vingt tours (20/20, 14 valides, 4 rejets au plus, 15 s).
- **Crible : 25 modèles gratuits au catalogue du jour**, 17 répondent. Six nouveaux au banc, plus les deux qui imposent le raisonnement — une option `--raisonnement-impose` les laisse raisonner, sans quoi le banc les déclarait morts à tort : **aucun ne passe**. Les 429 de `laguna` sur Kilo viennent de son fournisseur en amont, pas de notre limite.
- **Durée, seconde mesure un jour après** : `dots-3-note` 20/20, 18 valides, 0 rejet — 37/40 sur deux jours ; `nex-n2.5-mini` 20/20, 15 valides — 28/40, pile au seuil de 70 %, retenu de justesse et écrit comme tel.
- **La sélection vit dans `stable-models.ts`**, chaque modèle avec sa mesure ; le défaut des quatre dirigeants en découle : **`dots-3-note-preview` remplace `longcat-2.0`**. `stable-models.test.ts` rend bruyant tout retour à un modèle non retenu, et vérifie que chacun est servi comme il a été mesuré.
- Un test du serveur supposait qu'une partie distante sans clé tombe en panne ; avec un défaut sans clé, **il envoyait une vraie requête sur le réseau**. Il vérifie désormais ce chemin sur un modèle qui exige une clé.
- L'espacement du banc vers Kilo passe de 4 à 18 s : la limite de 200 requêtes par heure vaut pour l'adresse, pas par modèle.
- Nouvelle partie de 480 tours avec les seuls modèles retenus, en processus indépendant.
- **Relevé au passage, non corrigé** : l'observatoire crée ses nouvelles parties en `spectator-9`. La diplomatie livrée en `spectator-10` n'y est donc jamais activée.
- Vérifié : `tsc`, `vue-tsc`, **711 tests**.

### 2026-09-24 — Les autres plateformes gratuites

- **KiloStats**, mesure indépendante et horaire des modèles gratuits de Kilo (79 passages en deux semaines) : `dots-3-note` disponible 95 % du temps sur sept jours, `nex-n2.5-mini` 90 %. Nos deux retenus sont parmi les plus disponibles ; les modèles que nous avons écartés y sont aussi les plus fragiles.
- **Sans clé** : OVH fermé pour notre adresse (429 en 0,1 s, deux jours de suite) ; LLM7 sert quatre modèles sans compte payant, **0/6 chacun** au banc (sa limite de 60 requêtes par heure, réponses hors format, délais). Le JavaScript obfusqué renvoyé par `GLM-5.3-Flash`, déplié sans exécution, se réduit à une phrase d'exemple : le modèle recrache ses données, rien d'injecté.
- **Avec un compte** : Mistral et OpenRouter sont les deux qui valent l'effort. Aucune de ces clés n'existe ici — chez Hermes, `OPENROUTER_API_KEY` est une ligne commentée et vide.
- Le banc mesure désormais OpenRouter et Mistral, envoie à chaque fournisseur sa propre clé, et s'arrête avec un message clair si elle manque. La sonde et le banc lisent aussi un `.env` local, comme le serveur : une clé qui y était posée restait jusqu'ici invisible pour eux.

### 2026-09-24 — OpenRouter et Mistral mesurés : deux entrées de plus

- Les clés posées par `setx` n'étaient pas vues : le chargeur des variables Windows ne lisait que celles de Nous. Il lit désormais aussi Kilo, Mistral et OpenRouter, sans jamais les imprimer.
- **Crible de 26 modèles**, second essai à 90 s pour les délais et les 429. Quatre modèles Mistral (`small`, `medium`, `magistral` ×2) sont **fermés à cette clé** — `x-ratelimit-limit-req-minute: 0` — et non saturés.
- **Banc** : quatre passent sur treize. **Durée** : `codestral` 20/20, 19 valides, 0 rejet ; `dots-3-note` par OpenRouter 20/20, 17 valides, 1 rejet. `nex-n2.5-mini` par OpenRouter 7/20 contre 13 et 15 par Kilo : même modèle, autre hébergeur, autre candidat. `nemotron-3-super` 5/20.
- **Le contrôle par le produit a trouvé un défaut** : `openrouter:…` partait tel quel et OpenRouter refusait l'identifiant, pendant que le banc, qui retire le préfixe, mesurait 20/20. `parseModelRef` accepte le préfixe ; ensuite 12/12 pour chacun, rejeu vérifié.
- `stable-models.ts` : quatre entrées, chacune avec sa clé et ses conditions de mesure (schéma natif, raisonnement bridé), que le test confronte à ce que le produit envoie. Le principal reste sans clé.
- Limite : la gratuité de Mistral tient au compte, non vérifiée côté facturation ; `codestral` n'a qu'un jour de mesure.

### 2026-09-24 — La partie de 480 tours avec les seuls modèles retenus

- Terminée : **479/480 tours servis par le modèle lui-même**, un tour remplacé et compté, 43 ordres rejetés dont 0 pour crimson, médiane 4,7 s, rejeu vérifié. Les quatre dirigeants sont classables (`docs/reports/partie-modeles-stables.json`). La précédente, avec `longcat-2.0`, s'était arrêtée à 66 tours.

### 2026-09-24 — Les parties en direct, en spectator-10, avec les modèles retenus

- **Le direct** : le serveur joue une partie seul, page ouverte ou non, et la reprend après un redémarrage. Un tour distant toutes les 18 s au plus (Kilo : 200 requêtes par heure pour l'adresse). Un dirigeant muet est redemandé après 2, 30, 60 puis 120 s, jamais remplacé ; au dixième échec le direct se suspend et la page dit pourquoi. La case « Tours automatiques », qui vivait dans la page, devient « En direct ».
- **La page suit toute partie qui avance**, par un état léger interrogé toutes les 1,5 s : jusqu'ici elle ne rechargeait que pendant un tour qu'elle avait elle-même demandé, et une partie jouée par un autre processus restait figée à l'écran.
- **Les parties neuves naissent en `spectator-10`**, lu dans la liste des règles et non plus écrit en clair : la diplomatie livrée n'était jamais active depuis l'observatoire.
- **Défaut trouvé en créant la première partie** : l'observatoire proposait `longcat-2.0` aux quatre dirigeants. La variable Windows `NOUS_MODEL`, héritée du temps où Nous était le seul fournisseur, passait devant la liste des modèles retenus. Elle ne choisit plus rien. Le formulaire propose désormais les modèles retenus appelables ici.
- Vérifié en vrai, dans le navigateur d'Orca : partie créée depuis la page, quatre modèles retenus sur quatre fournisseurs (dots par Kilo, nex-mini, codestral, dots par OpenRouter), direct coché ; chaque tour servi par le modèle demandé. 716 tests, `tsc`, `vue-tsc`, `qa:browser`, `qa:observatory` (18 largeurs) verts.

### 2026-09-24 — Un site qu’on peut exposer : l’observatoire en lecture seule

- **Le constat.** Le site est un site : `Aevum.exe` n’en est que l’emballage, avec le service local qui tient les clés. Mais la racine exigeait ce service — sur un hébergeur statique, elle affichait « Service local indisponible ». Seules les archives w8 se montraient.
- **Deux sources, un affichage** (`campaign-source.ts`) : le service local s’il répond, sinon les parties publiées dans `public/campaigns/`. Le site public ne déclenche rien : aucun appel de modèle, aucune clé, aucun quota exposé. Détection vérifiée contre le piège des hébergeurs statiques (`/api/health` qui répond la page HTML en 200).
- **La page rejoue elle-même, incrémentalement** (`extendReplay`) : le serveur lui envoyait 31,5 Mo d’états pour une partie de 480 tours dont le fichier fait 0,8 Mo, et le direct rechargeait tout à chaque tour. Rejeu complet : 1 s à 480 tours ; un tour de plus : le seul nouveau tour, signature vérifiée (W4).
- **`npm run publish:campaigns`** publie, retire, et avec `--watch` republie les parties en direct ; le conteneur Docker monte le répertoire. Trois parties publiées : les 480 tours des modèles retenus, la partie à quatre modèles en cours, la première chronique Nous.
- **Vérifié dans un navigateur** : build servi statiquement sans API — partie de 480 tours rejouée, « Lecture seule », liste des parties à 390 px, aucune erreur console ; mode local sur la partie en direct inchangé.
- **Appris du direct** : au tour 112, dix échecs d’Ambre (`dots` par Kilo). Ce n’était pas « réponse vide » mais un HTTP 400 intermittent d’AtlasCloud, l’hébergeur du modèle, sur un conseil de 12 141 jetons ; relancé, le direct a passé ce tour. La route OpenRouter de `dots` aboutit au même hébergeur : elle n’est pas un secours contre lui. Le message d’erreur dit désormais ce que le fournisseur a répondu.
- **La refonte w8 du 25 août est suspendue** : l’observatoire est devenu le produit ; ses exigences transverses y sont appliquées.

### 2026-09-24 — La 3D montre ce que les dirigeants construisent

- Les cinq bâtiments de ville (grenier, atelier, marché, remparts, académie) et le chantier en cours n’apparaissaient pas : la ville suivait l’âge de sa civilisation et ignorait ses bâtiments. Ils ont chacun une silhouette procédurale, en deux époques (jusqu’au Moyen Âge, puis industrielle et au-delà) ; auvents et bannières prennent la couleur de la civilisation ; les remparts entourent la case.
- Une vue archivée, sans âges, ne change pas.
- **Atelier 3D** (`apps/player/lab.html`, `npm run player:dev` puis `/lab.html`) : une ville par âge projetée par le code du jeu, avec l’éclairage de la scène. Il a montré ce qu’aucun test ne voyait : des bâtiments trop petits, à moitié cachés derrière des remparts trop hauts, et des bastions qui débordaient sur la case voisine. Vite ne construit que `index.html` : l’atelier ne part pas sur le site.

### 2026-09-24 — Le site en ligne, et le conseil qui ne passait plus

- **Site public sur Vercel : https://aevum-eosin.vercel.app**, projet relié au dépôt, republié à chaque poussée sur `main` (`vercel.json`). Vérifié : la page, la 3D, les parties publiées ; un fichier absent répond 404, jamais la page HTML.
- **Le direct se suspendait sur `dots-3-note`** (tours 112 puis 132) : l'hébergeur du modèle refusait le conseil. Renvoyé tel quel et allégé, en alternance sur l'état exact : **0/10 contre 10/10**. Trois redondances retirées de l'invite : liste des infrastructures envoyée deux fois, infrastructures verrouillées détaillées ville par ville, histoire diplomatique sans limite (six derniers faits). Contrat de réponse gardé, mesuré inutile à retirer.
- **Remesuré** : les quatre modèles retenus passent le banc (5, 5, 4 et 5 valides du premier coup sur 6), le principal passe la durée (20/20, 16 valides, 2 rejets). Par le produit, le conseil qui avait échoué dix fois passe 3 fois sur 3 ; le direct est passé du tour 132 au tour 201 sans un échec.
- Ce qu'on ne sait pas : pourquoi l'hébergeur refusait — un texte neutre de même longueur passait toujours.

### 2026-09-24 — Regarder depuis le wifi, en lecture seule

- `npm run start:lan` ouvre le service au réseau local **en lecture** : tout appareil d'un réseau privé ou de Tailscale regarde, direct compris ; créer, avancer ou mettre en direct reste réservé à la machine, qui tient les clés (403 sinon). La page le sait par `/api/health` et remplace le formulaire par la liste des parties.
- Vérifié : appel réel depuis l'adresse wifi de la machine — lecture 200, trois modifications 403 (test, sauté si la machine n'a pas de réseau) ; page ouverte par `http://192.168.1.102:5180` à 390 px, partie en direct affichée, « En direct · lecture seule », aucune erreur.
- Défaut évité en route : un correctif appliqué par `String.replace` contenait « $` », que JavaScript lit comme « le texte avant la correspondance » — le fichier du serveur avait doublé (1 028 lignes au lieu de 664). Restauré depuis le dépôt et réappliqué avec une fonction de remplacement ; les correctifs antérieurs ne contenaient pas la séquence.

### 2026-09-24 — Aevum.exe reconstruit, et le site qui suit les parties en direct

- `Aevum.exe` reconstruit et vérifié réellement : page servie, partie créée et jouée en direct, données hors de l'installation, `--lan` qui laisse le réseau regarder et lui refuse la création (403). Toujours non signé.
- **Le site public suit les parties en cours sans être reconstruit** : `npm run publish:campaigns -- --push` publie dans la branche `campagnes` (un seul commit, remplacé à chaque fois), que le site lit sur GitHub avant ses parties livrées. Retard maximal : dix minutes d'intervalle, plus cinq de cache. Vercel ignore la branche ; la CI n'y tourne pas, la branche ne contenant pas le workflow.
- Le garde-fou « JSON seulement » n'exige plus `application/json` — GitHub sert du `text/plain` — mais refuse toujours une page HTML, ce qui était son objet.

### 2026-09-24 — La diplomatie et la guerre sur la carte

- Les relations étaient dans les panneaux, nulle part sur le monde. Désormais, en 3D comme en 2D : un **pacte** relie les capitales d’un arc d’or portant deux anneaux aux couleurs des alliés, une lueur le parcourt ; un **commerce** les relie d’un arc vert d’eau que remontent des caravanes ; une **guerre** allume les frontières communes, ou relie par un arc rompu, deux lames croisées au sommet, des capitales qui ne se touchent pas ; une **conquête** plante le drapeau du vainqueur, avec de la fumée, et des flammes si c’était une capitale. Immobile quand le système demande moins de mouvement.
- Tout vient de l’état rejoué (`relations-projection.ts`, testé) : les conquêtes se lisent dans la différence entre deux tours, parce que les noms de lieux ne sont pas uniques et qu’un événement ne porte pas sa case.
- Une légende ne montre que ce qui est sur la carte. **Mesuré avant de livrer** : posée dans la barre d’outils, elle chevauchait le bulletin de crise de 1 101 à 1 440 px et le panneau des dirigeants à 721 px (`qa:observatory`) ; déplacée dans la ligne d’instructions, aucun chevauchement sur trois parties à dix-huit largeurs. Un passage a signalé une largeur en échec sur la partie en direct, non reproduit ensuite : la partie avait changé entre deux passages, sans que la cause soit établie.
- Réglé sur de vraies cartes, pas seulement dans l’atelier : sur son plateau de 5 × 5, des arcs deux fois plus fins semblaient suffire ; sur une carte de 13 × 13 vue de loin, ils ne se voyaient pas.
- Constat en passant : les dirigeants distants ne conquièrent rien — aucune conquête dans les trois parties longues ; trois déclarations de guerre dans la plus ancienne.

### 2026-09-25 — Pourquoi aucune guerre, le climat sur la carte, le paquet du Store

- **Aucune conquête** en trois parties longues gouvernées par des modèles, contre 84 pour le dirigeant local : le moteur n’y est pour rien. Les modèles ne recrutent presque jamais de colon (1 en 480 tours, 0 en 1 075), donc ne fondent presque pas de villes, donc leurs frontières ne se touchent jamais.
- **Hypothèse réfutée** : le modèle de réponse écrivait `"recruitSettler":false`. Mesuré A/B sur 8 situations réelles, deux modèles : aucun écart (0/8 et 1/8 des deux côtés). La consigne n’est pas modifiée.
- **La vraie cause, mesurée** : la population croît identiquement pour les quatre civilisations quoi qu’elles décident ; le logement ne limite jamais ; les vivres s’accumulent. Proposition de rééquilibrage en `spectator-11`, **non appliquée** : c’est une décision de conception (`docs/reports/pourquoi-pas-de-guerre.md`).
- **Le climat sur la carte** : l’hiver givre les cases et fait tomber la neige, la sécheresse les jaunit sous la poussière, la récolte dore les plaines. Défaut trouvé en regardant : en caméra orthographique, three.js lit la taille des particules en pixels — la neige faisait un cinquième de pixel.
- **Paquet MSIX** pour le Microsoft Store, qui le signe gratuitement ; une icône, rendue à toutes les tailles et servant d’icône d’onglet au site. Installation non vérifiée localement : il faudrait le mode développeur, qui demande des droits d’administrateur.
- `scripts/campaign-report.ts` : le bilan d’une partie, civilisation par civilisation, part servie par le modèle lui-même en tête.

### 2026-09-25 — Les grands moments sur la carte, et un lien vers un moment

- Un **nouvel âge** fait monter une colonne de lumière de la capitale, avec un anneau qui s’étend ; une **fondation** marque la ville nouvelle d’un anneau aux couleurs de sa civilisation. Lus, comme les conquêtes, dans la différence entre deux tours et dans `ageTransitions` ; légende complétée. Mesuré à dix-huit largeurs sur deux parties : aucun chevauchement.
- **`?at=N`** ouvre une partie à l’action N : un lien peut désigner un moment plutôt que la partie entière. Le paramètre est lu avant le chargement, qui réécrit l’adresse.
- **Le site n’avait pas besoin d’être allégé** : mesuré, la partie de 480 tours pèse 49 Ko transférés (0,8 Mo avant compression), celle de 1 144 tours 90 Ko ; la bibliothèque 3D 141 Ko. L’inquiétude d’« un méga-octet par partie » oubliait la compression.

### 2026-09-25 — La partie à quatre modèles, terminée

- **1 200 actions, 300 manches, chacune jouée par le modèle demandé** (300/300 pour les quatre), rejeu vérifié. Deux suspensions du direct sur Ambre avant l’allègement du conseil, aucune après.
- Des styles très différents, des résultats voisins : Azur (`nex-n2.5-mini`) mène 46 plans et se trompe le plus (61 ordres rejetés) ; Pourpre (`codestral`) reste 300 tours « équilibré », un plan, un rejet ; Sylve (`dots` par OpenRouter) mise sur la croissance et reste au Moyen Âge quand Ambre (`dots` par Kilo) atteint le futur. Aucune guerre, aucune conquête, aucune famine.
- Écrit comme ce qu’il est : une partie, pas un classement (`docs/reports/quatre-modeles-bilan.md`). Les résultats se ressemblent aussi parce que le monde ne sépare pas les décisions (`pourquoi-pas-de-guerre.md`).

### 2026-09-26 — spectator-11 : une économie où quelque chose manque

- Logement qui borne (110 par ville, 15 par case), croissance selon les réserves (0,4 à 2 %), réserves qui se gâtent au-delà de dix tours de besoin. Seulement en `spectator-11` : le monde continu et les quinze parties existantes rejouées à l’identique. Les dirigeants reçoivent leur logement dans l’observation, et la règle dans la consigne.
- Mesuré sans modèle (`scripts/economy-probe.ts`) : l’écart de population entre civilisations passe de 116–262 à 245–700, aucune famine en six parties.
- Défauts attrapés par la garde de frontière en écrivant la mesure : une comparaison de version en clair, puis une liste de versions recopiée — l’une et l’autre interdites parce qu’elles ont déjà retiré des fonctions en silence.
- Partie appariée lancée : mêmes modèles, même monde que la partie de référence, sous `spectator-11`.

### 2026-09-26 — nex-n2.5-mini disparaît, guide du Store, points vérifiés

- `nex-n2.5-mini` a quitté les catalogues gratuits de Kilo et d’OpenRouter (HTTP 404) : retiré des modèles retenus. La partie appariée `spectator-11` est relancée avec `dots-3-note` à sa place.
- `docs/microsoft-store.md` : le guide de création du compte (vérifié sur la documentation de Microsoft), la fiche, la justification de `runFullTrust`, trois captures 1920 × 1080.
- Mistral : les en-têtes de quota ne nomment pas l’offre ; quatre modèles fermés à la clé (0 requête par minute) indiquent l’offre gratuite, ce qui reste un indice et non une preuve.
- Branche d’Astra : entièrement contenue dans `main`, 42 commits de retard ; ses trois fichiers non enregistrés sont des notes du 21 septembre, dépassées par leurs versions de `main`. Non modifiée.

### 2026-09-26 — Identité Microsoft Store

- Compte développeur créé et nom réservé par l’utilisateur. Identité attribuée : `Egarian.Aevum`, éditeur `CN=88813437-8A56-46DC-9F9A-3ABCFE6139DD`, affiché « Egarian ». Écrite dans `package-msix.ts` (elle est publique, portée par le paquet) ; `dist-msix/Aevum.msix` reconstruit avec elle, 41 Mo, prêt à soumettre.

### 2026-09-26 — spectator-11 face aux modèles : la contrainte mord, personne ne s’étend

- Partie appariée (même graine que la partie de référence) coupée à 975 actions, servie à 100 % par les modèles demandés. Les quatre populations sont à leur logement exact, et s’étalent désormais de 156 à 600 au lieu de 568 à 612 : les décisions se paient.
- Mais **un seul colon recruté**, contre zéro : les modèles voient le plafond et répondent par la recherche, pas par une ville. Toujours aucune frontière commune, aucune guerre. Écrit dans `pourquoi-pas-de-guerre.md`, avec ses limites (une paire, Azur a changé de modèle).
- `scripts/rules-compare.ts` (`npm run rules-compare`) : deux parties d’une même graine, au même nombre d’actions, part servie en tête.
- Store : soumission complétée dans l’espace partenaire (tarif, propriétés, classification PEGI 3 / ESRB E10+, paquet validé, fiche française, justification de `runFullTrust`). Envoyée en certification le 26/09 (produit 9PJSQW8DS42D), publication automatique si elle passe.
- Mistral : l’offre gratuite confirmée par l’utilisateur dans la console.
