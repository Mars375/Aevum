# Aevum — journal de référence

Ce fichier est la référence de reprise. Le lire avant toute intervention et le mettre à jour à chaque modification, même petite : changement, validation, limite et prochaine action. Ne jamais présenter un travail prévu comme terminé.

## État actuel

- Objectif : simulation de civilisations gouvernées par IA, exclusivement spectateur, du Bronze au Futur, indépendamment pour chaque civilisation.
- Chantier actif : `codex/feasible-ai-orders` ; lot v9 infrastructures localisées livré (commit `0d150a2` poussé et fusionné fast-forward dans `origin/main`). Choix IA réalisables délégués en cours : ni implémentés ni vérifiés.
- Validation v9 : 592 tests complets, typecheck, vérification de saison et build racine passés.
- Conseil distant v9 réel : l'infrastructure autorisée (centrale thermique) est choisie, mais d'autres ordres (plan/unités) sont rejetés → rapport `valid: false` ; ni validation distante complète ni fonctionnalité complète globale revendiquées.
- Vérification API racine `infrastructure-local-42` : spectator-9, 1041 actions, 13 sites, 1042 entrées d'historique, `error: null`.
- Aperçu `docs/previews/infrastructure-v9.png` (1400×900) généré uniquement ; inspection d'image non supportée et auth navigateur indisponible → aucun contrôle visuel.
- Reste à faire : obligations diplomatiques et qualité de sortie (fiabilité de la publication).
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
