# Aevum — observatoire des civilisations

## Lancer l'application

```sh
npm install
npm start
```

Ouvrir http://127.0.0.1:5174/. `npm start` compile le site et démarre son service local. Pour travailler avec le rechargement à chaud, lancer `npm run spectator:server` puis `npm run player:dev` dans deux terminaux et ouvrir http://127.0.0.1:5173/.

Les liens contenant `world=` restent des archives historiques. Le nouvel observatoire est à la racine, sans ce paramètre, ou avec `campaign=` pour une partie sauvegardée.

## Site public

Le même site, construit (`npm run player:build`), peut être servi par n'importe quel hébergeur statique. Sans service local, l'observatoire montre les **parties publiées** et les rejoue dans le navigateur, avec le moteur même qui les a vécues. Rien n'y déclenche un appel de modèle : aucune clé, aucun quota exposé.

```sh
npm run publish:campaigns -- <id>[=Titre] …   # ajouter une partie de worlds/spectator
npm run publish:campaigns -- --remove=<id>    # la retirer
npm run publish:campaigns -- --watch=30       # republier les parties jouées en direct
```

Les parties vont dans `apps/player/public/campaigns/`, avec `index.json`. Une partie publiée doit se rejouer : le script le vérifie, et `published-catalogue.test.ts` aussi. `--watch` sert un hébergeur qui lit le disque — le conteneur de `docker-compose.yml` monte ce répertoire, si bien qu'une partie jouée en direct avance à l'écran sans reconstruire. Un hébergeur qui ne sert qu'un build figé montre l'état publié à son dernier déploiement.

## Parcours spectateur

Créer un monde en choisissant une graine et la gouvernance. Le mode local est une politique déterministe explicitement signalée, utilisable sans clé ni réseau. Le mode distant consulte les quatre dirigeants avec les modèles configurés.

« Résoudre le tour suivant » collecte les décisions sur le même état initial et résout un tour commun. « En direct » confie la partie au service : il la joue seul, tour après tour, que la page soit ouverte ou non, et la reprend après un redémarrage. Une partie distante avance d'un tour toutes les 18 s au plus — la limite de Kilo, 200 requêtes par heure pour l'adresse. Un dirigeant qui ne répond pas est redemandé après 2, 30, 60 puis 120 s, jamais remplacé ; au dixième échec d'affilée le direct se suspend et la page dit pourquoi. Décocher arrête le direct sans annuler un conseil déjà commencé. La page suit toute partie qui avance, qu'elle soit jouée en direct ou par un autre processus, et reste sur le tour qu'on regarde si l'on relit le passé. « Lire l'histoire » parcourt uniquement les tours déjà enregistrés et ne fait aucun appel IA. Le curseur permet de revoir le passé ; revenir au présent avant de faire avancer la simulation.

Choisir une civilisation à gauche pour voir ses ressources, villes, recherche et objectif. Choisir une unité à droite pour voir son ordre, sa justification, son statut et son itinéraire prévu en pointillés. Les onglets Événements et Relations montrent les effets du tour, les rejets et les accords diplomatiques. Les événements mondiaux affichés sont connus avant le prochain conseil.

## IA et clés

Créer un fichier `.env` à la racine en s'appuyant sur `.env.example`, puis redémarrer le service après modification. Sous Windows, le service lit aussi les clés (NOUS_API_KEY, KILO_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY) dans les variables utilisateur, puis système si elles sont absentes du processus. Aucune copie de la clé n’est écrite dans le projet. Les clés restent exclusivement côté serveur et ne doivent jamais être mises dans une variable `VITE_`, une URL ou un journal de partie.

Références des modèles : identifiant OpenRouter nu se terminant par `:free`, ou `groq:IDENTIFIANT`, `nvidia:IDENTIFIANT`, `mistral:IDENTIFIANT`, `nous:IDENTIFIANT`. Les identifiants disponibles sont à vérifier auprès du fournisseur ; aucun modèle distant n'est sélectionné implicitement. Un fournisseur absent ou une réponse invalide est signalé comme indisponible. Les ordres encore valides continuent ; aucune décision locale n'est substituée en prétendant venir d'une IA distante.

Variables reconnues : `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `MISTRAL_API_KEY`, `NOUS_API_KEY`.

Sous Windows, le service complète aussi `NOUS_API_KEY`, `KILO_API_KEY`, `MISTRAL_API_KEY` et `OPENROUTER_API_KEY` depuis les variables d’environnement Windows : portée utilisateur en priorité, puis système. Les valeurs déjà présentes et non vides dans le processus (ou chargées depuis `.env`) restent prioritaires. Cela permet de retrouver une configuration ajoutée après l’ouverture du terminal. Cette lecture ciblée reste en mémoire, sans journalisation ni création de fichier contenant la clé. Redémarrer le service après modification. Les autres variables Windows ne sont pas importées par ce mécanisme. `NOUS_MODEL` ne choisit plus le modèle des dirigeants : le défaut est le principal des modèles retenus (`packages/agents/src/stable-models.ts`), et un choix délibéré passe par `AEVUM_COUNCIL_MODEL` ou `AEVUM_COUNCIL_MODELS`.

OpenRouter est limité aux références `:free`. Pour Nous, le catalogue `/v1/models` doit confirmer des prix d'entrée et de sortie nuls pour le modèle demandé, sinon l'appel est refusé. L'offre gratuite est décrite sur https://portal.nousresearch.com/ ; la disponibilité et les quotas peuvent changer. Chez Groq, NVIDIA et Mistral, la gratuité dépend du compte, pas d'un suffixe de modèle : utiliser un compte sans facturation active pour rester à zéro euro. Aucun achat ni abonnement n'est effectué par l'application.

Les réponses distant/local/indisponible, le modèle demandé et les informations de service effectivement retournées sont conservés. Les tests du fournisseur utilisent des réponses simulées : sans clé configurée, ils ne prouvent pas la disponibilité d'un modèle réel.

## Règles du moteur

Le format de campagne `spectator-1` encapsule les données de civilisation et utilise sa propre résolution ; il ne change pas les ticks w8 ou w10 des archives.

- Ordres : déplacement, défense, attaque, retraite, exploration, escorte et fondation. Un ordre porte sur une unité détenue par le dirigeant et une case valide. Les missions persistent et sont interrompues si l'unité disparaît.
- Déplacements : une case cardinale par tour, frontières respectées et traversées de rivière ralenties avant l'ingénierie. Les arrivées opposées sont bloquées symétriquement ; les échanges de positions adverses ne traversent pas gratuitement une armée.
- Combat : les pertes sont calculées à partir d'un même état et appliquées ensemble. Une armée ne marche pas puis n'attaque une seconde case dans le même tour. Plusieurs prétendants hostiles empêchent une attribution arbitraire du territoire. La défense tient compte du terrain et des remparts. L'attrition limite les opérations loin des terres amies.
- Développement : constructions payées à l'avance, durées de chantier, recherche à prérequis, consommation, salaires, stockage, croissance et famine. Les colons fondent des villes suffisamment éloignées des implantations existantes.
- Diplomatie : commerce et paix nécessitent deux propositions concordantes. La guerre est unilatérale hors trêve. Les modèles ne voient pas les ordres privés adverses avant de décider.
- Événements : sécheresse, hiver rigoureux et récolte exceptionnelle, communs aux quatre dirigeants. Ils durent trois tours et sont déterminés par la graine. Les technologies et les greniers atténuent les mauvaises récoltes. Les douze premiers tours sont protégés.
- Mémoire : objectif persistant et douze conséquences récentes propres à chaque civilisation, transmises au prochain conseil.

## Sauvegarde et reprise

Les campagnes vivent dans `worlds/spectator/`. Chaque réponse de dirigeant est enregistrée avant de poursuivre. En cas d'interruption, un nouveau tour demandé reprend les réponses manquantes du conseil. Chaque tour possède une signature de l'état intégral ; le chargement rejoue les décisions et refuse un résultat divergent. L'export contient le journal, sans clés.

Le remplacement des fichiers est atomique. Un verrou empêche deux services de modifier simultanément les parties. Après un arrêt forcé, `worlds/spectator/server.lock` peut rester présent : vérifier que le PID indiqué n'existe plus avant de supprimer ce seul fichier. Les sauvegardes sont conservées. Le service écoute seulement sur l'interface locale et rejette les origines web étrangères. Il n'est pas conçu pour une exposition publique sans authentification.

## Vérification

```sh
npm test
npm run typecheck
npm run player:build
npm run verify-season-1
npm run spectator:probe
```

La campagne hors ligne de 12 graines sur 300 tours vérifie les invariants du monde et le rejeu intégral. Son rapport est `docs/reports/spectator-probe.json`. Les tests couvrent aussi les ordres illégaux, collisions, missions persistantes, réponses distantes simulées, absence de fuite de clé, création HTTP, idempotence du tour et reprise après redémarrage.

## Périmètre actuel

Service local mono-utilisateur, site public en lecture seule ; limite de 1 000 tours par campagne. Le plateau est public pour les dirigeants, tandis que les missions et objectifs adverses restent privés. Les travailleurs représentent des équipes et la production est encore agrégée par civilisation. Les escortes suivent la position connue de l'unité protégée ; elles ne forment pas un convoi atomique. Les armées amies peuvent partager une case. Le commerce est un accord économique, pas un système de contrats détaillés. Les alliances militaires, un brouillard de guerre complet, les villes avec économie entièrement individuelle et le mode « dieu » restent hors de cette version.

Les performances stratégiques de vrais modèles et leur équilibrage restent à mesurer avec des clés configurées. La validation locale ne doit pas être présentée comme une compétition réelle entre LLM.

## Direction visuelle

La référence Project Napoleon concerne la mise en scène : monde plein écran, intentions et ordres dans le paysage, panneaux superposés et caméra d'observation. Aevum conserve sa propre identité, sobre et accordée au terrain ; aucune image de la référence n'est réutilisée.

Le mode immersif est réservé au nouvel observatoire. Le rendu des archives demeure indépendant. Les reliefs périphériques sont un décor ; le territoire jouable et les positions restent ceux du moteur. Les étiquettes d'ordres utilisent les identifiants réels des unités. À distance, leur nombre est limité pour préserver la lisibilité ; la sélection donne priorité à l'unité choisie.

La lecture animée d'un déplacement ne change pas le résultat d'un tour. Le journal reste la source des positions, des objectifs et des conséquences. Les préférences de réduction des mouvements sont respectées. Les polices sont auto-hébergées et leurs licences figurent dans apps/player/public/fonts/.

## Pilote Nous réel

`node scripts/nous-pilot.mjs` crée une campagne distante de 50 tours avec quatre modèles gratuits vérifiés dans le catalogue Nous. `node scripts/nous-pilot.mjs IDENTIFIANT` reprend une campagne existante. Le service doit être lancé. Les réponses indisponibles ne sont jamais remplacées par une politique locale. Les quatre premiers essais et les ajustements de format sont conservés dans le journal du pilote ; ce rapport mesure donc aussi les erreurs d’intégration initiales. Le fichier `docs/reports/nous-pilot.json` est actualisé après chaque tour.

Le pilote utilise l’API de modèles directement ; Hermes Agent n’est pas nécessaire à cette boucle de décisions structurées.
