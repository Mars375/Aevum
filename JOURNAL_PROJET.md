# Aevum — journal de référence

Ce fichier est la référence de reprise. Le lire avant toute intervention et le mettre à jour à chaque modification, même petite : changement, validation, limite et prochaine action. Ne jamais présenter un travail prévu comme terminé.

## Objectif

Créer une simulation de civilisations gouvernées par IA, exclusivement spectateur pour le moment. Chaque dirigeant joue son tour, agit sur le monde et transmet la main au suivant. Les décisions doivent produire une histoire compréhensible et des conséquences visibles. À terme : Bronze, Antiquité, Moyen Âge, Industrie, Moderne, Futur, indépendamment pour chaque civilisation.

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

Branche : `codex/civilization-ages`.

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
