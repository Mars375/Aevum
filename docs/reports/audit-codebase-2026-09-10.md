# Audit technique Aevum — 10 septembre 2026

Analyse du checkout local, sans modification du code applicatif. Les dépendances verrouillées ont été installées avec `npm ci --ignore-scripts`, puis les contrôles et des reproductions en mémoire ont été exécutés. Aucun fournisseur IA n'a été appelé.

## Avis général

L'architecture est cohérente : les règles déterministes, les appels aux modèles, les métriques et le lecteur sont séparés. Le projet dispose de nombreux tests d'invariants et d'une documentation expliquant les choix. Le rejeu du monde livré reproduit effectivement son empreinte.

Les principaux défauts concernent toutefois une promesse centrale du produit : interrompre puis reprendre une expérience sans altérer son histoire. Une reprise de bataille v2 recommence la bataille ; une reprise du monde perd ses décisions en attente. À cela s'ajoutent des sauvegardes non atomiques et une collecte incomplète des preuves de service. Ces points méritent d'être traités avant de lancer de longues campagnes ou de tirer des conclusions comparatives sur les modèles.

Cet audit couvre l'architecture, les flux principaux de simulation et de reprise, les contrats, la mesure, le chargement du lecteur, la CI et le déploiement. Il ne constitue pas une preuve d'absence de défaut dans chaque ligne, ni une validation du service de production.

## Architecture et fonctionnement

| Module | Responsabilité | Observation |
| --- | --- | --- |
| `packages/contracts` | Schémas Zod, types, règles communes de bataille | Base partagée utile ; certains contrats du monde et des métriques vivent ailleurs. |
| `packages/engine` | Déplacement, combat, diplomatie, visibilité, victoire | Résolution déterministe, phases explicites, nombreux invariants testés. |
| `packages/world` | Économie, territoire, événements, doctrine, chroniques | Moteur w8 par défaut ; w9 existe au niveau de l'état et des progrès, mais le journal reste limité à w8. |
| `packages/agents` | Fournisseurs, prompts, réponses, orchestration | Dépendances injectables et chemins scriptés ; plusieurs implémentations de requête ont divergé. |
| `packages/metrics` | Observations, taux de service, indicateurs d'adaptation | Sépare correctement absence de preuve et mauvais résultat ; dépend de preuves que le flux réel ne remplit pas. |
| `packages/cli` et `scripts` | Exécution, sauvegarde, indexation, publication | Zone où se concentrent les risques de reprise et de portabilité. |
| `apps/player` | Lecteur Vue, rapports, monde, batailles 2D/3D | Interface statique ; pas de serveur métier ni de base de données. |

Le monde avance par `tickWorld`, détecte les situations nécessitant un arbitrage, interroge les dirigeants via `askRuler`, applique les doctrines et conserve un journal. `replay` et `chronicle` reconstruisent l'histoire à partir de l'origine et des décisions. Le lecteur exécute lui aussi ce moteur pour afficher le monde.

Les batailles v1 et v2 ont des orchestrateurs distincts. Cette séparation protège la compatibilité, mais implique que les fonctionnalités opérationnelles, notamment la reprise, doivent être implémentées et testées dans les deux chemins.

Le build Vite produit des fichiers servis par Nginx. Compose monte les répertoires `worlds` et `replays` du poste par-dessus les données de l'image. Le timer systemd fait avancer le monde avec un script Bash : ce chemin d'exploitation vise Linux.

## Contrôles exécutés

| Contrôle | Résultat local |
| --- | --- |
| Installation verrouillée | 83 paquets ajoutés ; npm a signalé 0 vulnérabilité parmi les 91 paquets audités. Ce résultat ne couvre pas les images Docker. |
| `npm run typecheck` | Réussi, dans le périmètre du tsconfig actuel. |
| `npm run player:build` | Réussi, 97 modules transformés. |
| `npm test` | 27 fichiers passent, 1 échoue ; 435 tests passent, 8 échouent, 1 est ignoré. Une suite échoue aussi lors de son initialisation. |
| `npm run verify-season-1` | Échec sur l'empreinte de la fixture, expliqué par les fins de ligne CRLF du checkout. Les contrôles suivants ne sont donc pas validés. |
| Rejeu indépendant du journal livré | Empreinte finale identique à celle enregistrée. |
| `npm run world:probe -- 300` | 56 points de décision contre 1 200 consultations systématiques, soit un facteur 21,4 pour ce scénario. |
| `npm run qa:browser` | Échec de découverte du navigateur ; le script ne trouve pas Chrome installé sous Windows. Aucune validation visuelle complète n'est revendiquée. |
| Docker / systemd | Configuration examinée ; exécution non validée sur ce poste. |

Les tests sont substantiels : invariants de bataille, rejeu, règles du monde, normalisation des réponses, métriques, chargement et comportements Vue. Les tests de composants ne remplacent cependant ni un contrôle de types des composants, ni un parcours dans un navigateur.

## Défauts et risques prioritaires

### 1. P1 — La reprise v2 recommence et écrase la bataille

**Reproduit.** `packages/cli/src/main.ts:95` charge le replay demandé par `--resume`, mais la branche v2 à la ligne 112 ne transmet aucun état de reprise. `runBattleV2` ne propose pas cette option et initialise une bataille neuve. Les écritures utilisent le même fichier.

Une bataille scriptée v2 de deux tours, suivie de `--resume --turns 3`, a changé de `battleId` et de date de création. Le nouveau run a remplacé le précédent. Avec des modèles distants, les appels seraient refaits et les décisions pourraient changer.

**Action :** refuser immédiatement `--resume` en v2 tant que la reconstruction du combat, des alliances, des connaissances et des compteurs n'est pas implémentée. Vérifier aussi que les options de reprise correspondent au manifeste existant.

### 2. P1 — Le monde perd les décisions en attente entre deux sessions

**Reproduit.** `packages/agents/src/live.ts:119` initialise `pending` à chaque appel. Le journal ne conserve pas cette file. Une décision différée qui dépend d'un événement ponctuel peut disparaître lors d'une reprise.

Reproduction : monde de graine 42, fournisseur simulé donnant une réponse tous les trois appels, 60 années. Une exécution continue produit l'empreinte `5088f86b`. La même exécution coupée après 8 années, avec la même instance de fournisseur conservée, produit `8276c063`. Les deux journaux comptent 9 décisions.

Il ne s'agit pas d'un défaut du rejeu déterministe : chaque journal décrit sa propre histoire. Le défaut est que la coupure change l'orchestration et donc l'histoire obtenue.

**Action :** conserver les décisions en attente et le contexte nécessaire à leur reprise. Définir également la reprise d'une année interrompue entre deux dirigeants : la sauvegarde actuelle peut être écrite après une seule décision, puis la reprise avance directement à l'année suivante.

### 3. P1 — Les sauvegardes réécrivent directement l'unique journal

**Risque établi par lecture, sans provoquer de corruption.** `scripts/live.ts:230` et `packages/cli/src/main.ts:107` écrivent directement dans le fichier final. Une interruption pendant l'écriture peut laisser un JSON tronqué. Le lecteur peut également recevoir une écriture partielle.

Le verrou `flock` de `scripts/tend-world.sh:25` protège les passages de ce script, mais pas deux invocations directes du CLI. Deux processus peuvent lire le même état puis remplacer leurs résultats respectifs.

**Action :** écriture temporaire dans le même répertoire, remplacement atomique et verrou par journal partagé par tous les points d'entrée. Ajouter un contrôle de concurrence ou de version avant remplacement. Adapter la durabilité disque au niveau de garantie recherché.

### 4. P2 — Les preuves de service ne sont pas collectées dans le monde réel

**Reproduit dans le flux d'orchestration.** `packages/agents/src/rule.ts:190` conserve un nom de modèle, mais la ligne 195 écrit systématiquement `service: null`. `liveWorld` n'enrichit pas ce champ. `packages/metrics/src/observations.ts:30` classe donc ces observations comme inconnues et leur attribue `modelId: null`.

Une simulation de 60 années avec 13 décisions acceptées produit 13 preuves inconnues et une courbe `UNRANKED`. Le refus de classer est correct ; c'est la collecte qui manque. La campagne scriptée doit, elle, continuer à ne pas prétendre apporter une preuve de service distant.

**Action :** retourner un résultat structuré contenant modèle demandé, modèle servi, fournisseur, tentatives, replis et durée. Enregistrer ces informations lors de la décision. Éviter les accesseurs mutables `lastModel` si des appels concurrents sont ajoutés.

### 5. P2 — La validation de publication dépend des fins de ligne Git

**Reproduit.** `scripts/live.ts:118` calcule l'identité de la fixture sur ses octets. `scripts/verify-season-1.ts:39` fait de même. La fixture est en LF dans Git et en CRLF dans le checkout Windows ; aucune règle `.gitattributes` suivie ne fixe ce comportement.

L'empreinte des octets locaux ne correspond pas à celle du journal livré. En remplaçant CRLF par LF en mémoire, l'empreinte correspond exactement à la valeur enregistrée. Cela explique le blocage observé du vérificateur, sans remettre en cause le rejeu du monde.

**Action :** fixer explicitement les fins de ligne des artefacts dont les octets définissent l'identité. Préserver la signification des empreintes historiques ; une canonicalisation du contenu serait un changement de protocole à documenter.

### 6. P2 — Les tests de publication construisent des chemins invalides sur Windows

**Reproduit.** `apps/player/test/aevum-release.test.ts:11` utilise `new URL(import.meta.url).pathname` comme chemin natif. Le chemin obtenu devient `F:\F:\Projet\...`. Les fixtures deviennent introuvables et une invocation Git échoue aussi avec ce répertoire de travail.

**Action :** utiliser `fileURLToPath` ou `import.meta.dirname`. Ajouter Windows à la matrice CI si cet environnement doit être supporté. Le script de QA navigateur nécessite aussi une découverte et un arrêt de processus adaptés à Windows ; son nettoyage actuel utilise des groupes de processus POSIX.

### 7. P2 — Le typecheck ne couvre pas le lecteur

**Établi par configuration.** Le `include` de `tsconfig.json` couvre les paquets et scripts, pas `apps/player`. Le build du lecteur lance seulement `vite build`. Il n'existe pas de contrôle `vue-tsc` configuré pour les composants et leurs templates.

Le typecheck réussi ne prouve donc pas la cohérence des props, des événements et des templates Vue. Ce n'est pas la preuve d'une erreur de types actuelle, mais un angle mort de la validation.

**Action :** ajouter une configuration de typage du lecteur et l'intégrer au contrôle CI, avec les alias utilisés par Vite.

### 8. P2 — Des réponses réseau anciennes peuvent remplacer la sélection récente

**Établi par lecture ; scénario navigateur non exécuté.** Le chargement des mondes utilise un garde de requête. Les batailles dans `apps/player/src/App.vue:272` et les rapports dans `apps/player/src/components/Reports.vue:26` n'en utilisent pas.

Si A est sélectionné puis B et que A répond en dernier, son contenu remplace celui de B. Pour les batailles, l'adresse peut alors désigner B alors que l'écran montre A. Dans les rapports, l'URL est aussi réécrite après réception.

**Action :** réutiliser `createRequestGuard` dans ces deux flux, y compris pour leurs erreurs et les imports de fichiers qui peuvent entrer en concurrence.

### 9. P2 — Le lecteur ne vérifie pas l'empreinte du monde affiché

**Établi par lecture.** `apps/player/src/App.vue:171` vérifie la forme du journal puis le transmet à la chronique. `packages/world/src/chronicle.ts:25` rejoue les règles actuelles sans comparer le résultat à `journal.fingerprint`.

Le CLI sait refuser un monde dont l'état recalculé a dérivé ; le lecteur ne bénéficie pas de cette protection. Une modification accidentelle des règles sous la même version pourrait donc afficher une histoire différente sans diagnostic.

**Action :** vérifier l'empreinte finale après reconstruction, puis signaler clairement une divergence. Vérifier également l'identité du fichier de métriques : le lecteur compare principalement son nom de source, alors que le vérificateur de publication contrôle davantage de métadonnées.

### 10. P2 — Le CLI de bataille neutralise le plafond propre à chaque fournisseur

**Établi par lecture.** `packages/agents/src/endpoints.ts:33` fixe 2 000 jetons pour Groq. Pourtant `packages/cli/src/main.ts:86` transmet par défaut `maxTokens: 6000`, et `RemoteProvider.tokensFor` donne priorité à cette valeur globale.

Les batailles lancées depuis le CLI ne bénéficient donc pas de la configuration par fournisseur décrite dans le README. Cela peut augmenter les réservations de jetons et les attentes. L'effet chez les fournisseurs n'a pas été remesuré pendant cet audit.

**Action :** ne transmettre un plafond global que si l'utilisateur a explicitement défini la variable correspondante.

## Maintenabilité, performance et sécurité

Le plus gros fichier applicatif est `App.vue` avec 1 125 lignes, suivi de `Chronicle.vue` avec 892 lignes. Une partie importante est du CSS : ces nombres ne suffisent pas à justifier une réécriture. Les extractions utiles seraient les chargeurs de données, la validation des métriques et la synchronisation URL/état. Les règles métier doivent rester dans les paquets existants.

Les contrats des métriques sont répartis entre types TypeScript, schémas du script `learning-curve.ts` et gardes manuels dans `App.vue`. Cela favorise les divergences. Un contrat de publication partagé réduirait ce risque. Le test de frontières de `packages/contracts/test/boundaries.test.ts:85` omet aussi `packages/metrics` dans la liste des paquets contrôlés ; le contrôle de déterminisme ne le couvre pas.

Le rendu 3D est chargé à la demande, ce qui est approprié. Le build produit environ 170 ko de JavaScript principal, 51 ko pour la chronique et 478 ko pour la 3D, avant gzip. Aucun problème de taille bloquant n'a été démontré.

La chronique conserve un état complet par année en mémoire. Mesure indicative sous Node, sur le même petit monde : 1 000 années en environ 30 ms avec une variation de tas d'environ 10 Mio ; 5 000 années en environ 91 ms avec environ 32 Mio supplémentaires. Ce ne sont ni des mesures navigateur, ni un benchmark stabilisé. Le coût croît avec l'histoire ; pour de longues ères, envisager des points de contrôle, un calcul dans un worker ou une matérialisation partielle après mesure sur les appareils visés.

Les protections existantes sont utiles : URL de fournisseurs définies dans le code, clés envoyées dans l'en-tête d'autorisation, validation des décisions, scan des secrets en CI, exclusion des fichiers d'environnement du contexte Docker. Le rendu Markdown échappe le texte et restreint les liens produits ; l'emploi de `v-html` pour ces rapports ne suffit pas à démontrer une XSS. Aucune exploitation de sécurité n'a été établie pendant cet audit.

Les schémas du monde restent permissifs sur certaines relations : dimensions du plateau, nombre de cases, bornes temporelles et horizon de rejeu ne sont pas tous contrôlés ensemble. Avant d'accepter des journaux provenant de sources arbitraires, renforcer ces validations et borner le travail imposé au lecteur.

## Documentation et exploitation

- Le démarrage proposé par le README passe de `--silent` à une gouvernance distante sur le même monde. `assertExecution` dans `scripts/live.ts:166` refuse cette transition. Clarifier le parcours : nouveau monde, ou protocole explicite de changement de provenance.
- `CLAUDE.md` indique que les replays ne sont pas inclus dans un build statique, alors que des replays et un index sont maintenant suivis dans `apps/player/public/replays`. Mettre cette note à jour.
- Le monde w9 ne peut pas être créé avec `newJournal`, qui impose w8. Présenter w9 comme une capacité partielle tant que toute la chaîne n'est pas compatible.
- Le montage Compose expose l'ensemble du répertoire local `worlds`, indépendamment du filtrage du catalogue statique. Vérifier que cela correspond au périmètre de publication voulu.
- Le script nocturne reconstruit les rapports sur l'hôte, mais Compose ne monte pas leur répertoire dans le conteneur. Les rapports déjà intégrés dans l'image peuvent donc rester anciens jusqu'à une reconstruction de celle-ci.
- Nginx réserve `no-cache` aux replays, pas aux mondes et au statut. Définir explicitement la politique de revalidation des données vivantes.
- La CI est riche : tests, build, QA navigateur, rapports, vérification de publication, smoke test Docker. Elle tourne seulement sous Ubuntu, ce qui explique que les régressions Windows aient pu lui échapper.

## Ordre de traitement proposé

1. Protéger immédiatement les données : refus de reprise v2 non supportée, sauvegardes atomiques, verrou commun aux écritures.
2. Rendre la reprise du monde indépendante des interruptions : file d'attente et état d'une année partiellement traitée.
3. Réparer le parcours Windows : chemins natifs, fins de ligne des fixtures et contrôles CI adaptés.
4. Raccorder les preuves de service aux décisions réelles, puis vérifier une campagne distante courte avant tout classement.
5. Compléter la validation du lecteur : typage Vue, requêtes concurrentes, empreintes et identité des métriques.
6. Aligner documentation et déploiement, puis extraire les responsabilités de l'interface qui se répètent.

La structure générale peut être conservée. Les corrections prioritaires sont localisées et visent surtout à rendre les garanties opérationnelles aussi solides que les règles du moteur.
