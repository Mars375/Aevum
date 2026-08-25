# Aevum Observatory — spécification de refonte

**Date :** 2026-08-25  
**Statut :** design validé par Loïc, implémentation non commencée  
**Projet :** Aevum

## 1. Intent

Transformer le lecteur actuel en un **observatoire lisible d’un monde vivant**.
Le site doit expliquer rapidement ce qui se passe, permettre d’explorer la carte
et la chronique, puis exposer les preuves sans confondre faits du moteur,
décisions de modèles et narration.

Le produit reste local-first : les données affichées proviennent des artefacts
`worlds/`, des replays et des rapports produits par le moteur déterministe.
Aucune illustration générée ne doit être présentée comme une observation réelle.

## 2. Principes non négociables

- Le modèle décide ; le moteur tranche.
- La carte, les événements et les métriques sont dérivés des données rejouables.
- Les états `ok`, `degraded`, `failed` et l’absence de données sont visibles.
- Aucune information importante ne dépend uniquement de la couleur.
- Les vues 2D et 3D sont deux représentations du même état du monde.
- La narration est explicitement séparée des faits et des décisions.
- Les erreurs de chargement JSON ne doivent jamais être masquées par un fallback HTML.
- Aucun appel Higgsfield ou autre fournisseur distant n’est requis pour le runtime.

## 3. Architecture d’information

### 3.1 Accueil — état du monde

L’accueil doit présenter :

- le nom et le statut du monde courant ;
- l’année atteinte et la date de dernière progression ;
- le nombre de civilisations vivantes ;
- les indicateurs de décisions, crises, pertes et progression ;
- un aperçu visuel de la carte ;
- un CTA `Explorer le monde` ;
- une indication claire si le monde n’est pas servi ou si son état est dégradé.

### 3.2 Vue Monde

- carte 2D comme représentation par défaut ;
- bascule explicite `2D / 3D` ;
- filtres indépendants pour reliefs/eaux, territoires, capitales,
  implantations, réserves, conflits, diplomatie, avancées, pertes et événements ;
- sélection d’une civilisation avec panneau de détails ;
- zoom, déplacement, vue entière et navigation temporelle ;
- données chargées depuis `worlds/index.json`, `worlds/status.json` et les
  journaux d’ère référencés ;
- erreur de données visible et exploitable, jamais remplacée silencieusement
  par la page HTML de l’application.

### 3.3 Chronique

- timeline par épisodes d’observation ;
- événements datés et décisions datées ;
- changements de doctrine et extinctions ;
- lien vers l’année concernée ;
- lien vers le rejeu fondé sur seed, règles et empreinte ;
- distinction visuelle et textuelle entre fait du moteur, décision du modèle et
  narration dérivée.

### 3.4 Preuves et rapports

- accès aux métriques et rapports reproductibles ;
- seeds, version de ruleset, fingerprints et taux de décisions servies ;
- affichage séparé des limites et des hypothèses ;
- aucune conclusion d’« émergence » sans protocole contrefactuel et preuve de
  rejeu.

## 4. Direction visuelle

- thème sombre observatoire : navy/noir, surfaces ardoise et bordures discrètes ;
- cyan pour les données et liens ; ambre pour activité, progression et alertes ;
  rouge uniquement pour pertes, erreurs ou états critiques ;
- contraste minimum WCAG AA pour le texte courant ;
- titres distinctifs mais lisibles, données dans une police technique ;
- cartes sobres, hiérarchie claire, densité progressive ;
- icônes SVG cohérentes, jamais d’emoji comme icônes d’interface ;
- transitions de 150–300 ms, respect de `prefers-reduced-motion` ;
- états de focus visibles et cibles tactiles d’au moins 44 px ;
- vérification responsive à 375, 768, 1024 et 1440 px ;
- aucune esthétique cyberpunk ou effet glow ne doit dégrader la lisibilité.

## 5. 3D et Higgsfield

### 5.1 Vue 3D

La 3D est une seconde lecture du monde réel : territoires, reliefs, capitales,
événements et temporalité doivent être reliés aux mêmes données que la carte
2D. Elle peut être introduite après la refonte de la structure et ne doit pas
bloquer l’accueil ou la chronique.

### 5.2 Higgsfield

Higgsfield n’est pas une dépendance runtime. Il peut fournir, après validation
séparée :

- une image d’ambiance pour l’accueil ;
- des visuels d’épisodes ;
- une courte bande-annonce.

Ces assets seront statiques, identifiés comme illustrations et séparés des
preuves. Aucun appel automatique à Higgsfield ne sera ajouté au lecteur sans
besoin explicite, credentials vérifiés et plan de coût.

## 6. Phasage

### Phase 1 — structure et lisibilité

- shell de navigation et accueil observatoire ;
- cartes de statut et métriques ;
- hiérarchie de la vue Monde ;
- chronique par épisodes ;
- états de chargement, erreur et monde non servi ;
- responsive et accessibilité de base.

### Phase 2 — représentation avancée

- vraie vue 3D du monde w8 ;
- synchronisation temporelle 2D/3D ;
- contrôles de caméra et exploration des territoires ;
- éventuels assets Higgsfield statiques, après validation de leur rôle.

## 7. Critères d’acceptation

- `npm test`, typecheck et build du lecteur passent ;
- les JSON du monde répondent avec `application/json` et ne tombent pas sur le
  fallback HTML ;
- l’accueil identifie clairement le monde, son année et son état ;
- la carte 2D affiche les données d’un monde w8 réel ;
- les filtres, la sélection d’une civilisation et la navigation temporelle sont
  vérifiés ;
- la chronique affiche au moins un épisode avec faits, décisions et liens de
  rejeu ;
- les modes desktop et mobile sont parcourus ;
- console navigateur et requêtes réseau ne présentent pas d’erreur inattendue ;
- une capture visuelle de référence est produite ;
- aucune donnée de production, clé ou artefact hors périmètre n’est écrasé ;
- aucun push, tag, release ou déploiement supplémentaire n’est effectué sans
  validation explicite de Loïc.

## 8. Hors périmètre immédiat

- génération automatique d’images ou de vidéos par Higgsfield ;
- apprentissage ou modification des poids des modèles ;
- refonte du moteur déterministe ;
- authentification utilisateur ;
- déploiement multi-environnements ;
- publication d’une nouvelle release avant validation dédiée.

## 9. Décision

Le design **Observatoire scientifique sombre** est validé. La prochaine étape
est de convertir cette spécification en plan d’implémentation, puis de créer un
graphe Kanban explicite `implémentation → review → QA → consolidation` avant de
modifier le code.
