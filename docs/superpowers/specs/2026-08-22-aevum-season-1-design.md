# Aevum — Living World Season 1

Statut : **specification de design à relire**  
Date : 2026-08-22  
Projet source : `ai-battle-simulator`  
Release de départ : `v0.2.0`  
Nom produit retenu : **Aevum — Chronique des mondes**

## 1. Décision produit

Aevum est une expérience d'observation de civilisations gouvernées par des
modèles de langage. Le visiteur ne joue pas et ne reçoit pas un score opaque :
il observe une ère, suit les décisions des dirigeants, voit les conséquences
résolues par un moteur déterministe et peut remonter aux preuves.

### Promesse

> Quatre modèles gouvernent des mondes qui continuent sans eux. Aevum conserve
> ce qu'ils ont décidé, ce que le monde leur a répondu et les signes observables
> d'une adaptation — sans prétendre qu'un modèle s'est entraîné pendant la
> simulation.

### Tension éditoriale

Chaque tournant est raconté dans cet ordre :

1. **Situation** — ce que le monde rendait visible au dirigeant ;
2. **Intention** — la doctrine, les mots et la décision du modèle ;
3. **Résolution** — ce que le moteur a accepté et appliqué ;
4. **Conséquence** — les événements et variations observables ;
5. **Adaptation** — ce que les décisions suivantes permettent ou non d'inférer ;
6. **Preuve** — journal, graine, version de règles, modèle réellement servi et
   lien partageable.

Une extinction, une famine ou une stratégie incohérente est un résultat valide.
Le produit ne doit pas corriger le récit pour rendre une civilisation héroïque.

## 2. Ce qui existe déjà et reste verrouillé

- `@abs/engine` et `@abs/world` restent déterministes et sans réseau.
- Le principe **« le modèle décide, le moteur tranche »** reste non négociable.
- Les batailles tactiques `v1` et `v2` restent des archives rejouables.
- `w8` est la base de compatibilité actuelle ; un changement de règles demande
  une version de monde explicite.
- La 2D reste complète et par défaut ; la 3D est une projection optionnelle.
- Les fournisseurs, replis, erreurs, 429 et absence de réponse sont visibles,
  jamais transformés en décision inventée côté client.
- Aucun secret ne passe dans un journal, un prompt, un replay, une URL ou un
  rapport.

## 3. Objectifs de Living World Season 1

### Objectifs principaux

1. Donner à chaque civilisation une identité, une doctrine et un historique
   persistants, dérivés de faits enregistrés.
2. Faire émerger des événements de vie : crise, expansion, découverte, rupture,
   alliance, famine, reprise ou effondrement.
3. Publier une première ère reproductible et lisible comme un épisode complet.
4. Exposer une **courbe d'adaptation comportementale** pour chaque modèle,
   appuyée sur les décisions et les conséquences réelles.
5. Renommer proprement le produit en Aevum sans casser les anciens replays.
6. Livrer une expérience web qui ressemble à un atlas vivant, pas à un tableau
   de bord générique.

### Hors périmètre

- Prétendre qu'un LLM met à jour ses poids pendant une ère.
- Entraînement, fine-tuning ou optimisation automatique des modèles.
- Joueur humain, comptes, abonnement ou classement social.
- Score unique appelé « intelligence ».
- Jury LLM présenté comme mesure objective.
- Terrain décoratif non représenté par les contrats du moteur.
- Streaming temps réel obligatoire.
- Changement simultané non mesuré de toutes les règles économiques.

## 4. Modèle du monde vivant

### 4.1 Identité persistante

Chaque civilisation possède une identité versionnée et rejouable :

- nom et thème éditorial ;
- valeurs déclarées ;
- doctrine courante ;
- priorités économiques et militaires ;
- relations connues ;
- héritage des tournants précédents ;
- mémoire bornée des événements pertinents ;
- niveau de confiance ou d'incertitude quand une information manque.

L'identité est une représentation du journal et de la configuration publique.
Elle ne doit pas être inventée après coup par une narration.

### 4.2 Doctrine

La doctrine est observable à travers :

- posture ;
- parts de travail ;
- revendication territoriale ;
- objectifs déclarés ;
- seuils de tolérance ;
- réponses aux événements ;
- changements de stratégie.

Une doctrine n'est pas un label esthétique : au moins une partie de ses champs
doit influencer les décisions ou être présentée comme purement déclarative.

### 4.3 Événements

Un événement possède :

- un identifiant stable ;
- un tour ou une année ;
- une catégorie ;
- les entités concernées ;
- l'état avant ;
- l'action ou la décision pertinente, si elle existe ;
- l'état après ;
- un degré d'attribution : `direct`, `observed-after`, `engine-only` ou
  `unknown`.

Le degré `observed-after` est obligatoire lorsque le journal montre une
conséquence après une décision sans prouver qu'elle a été causée par cette
seule décision.

### 4.4 Progression

Un progrès ouvre une possibilité, jamais une réussite automatique. Chaque
progrès doit préciser :

- la condition objective d'acquisition ;
- la modification réellement appliquée par le moteur ;
- ce que le dirigeant peut désormais tenter ;
- le coût ou le compromis associé ;
- la version de monde dans laquelle il est valide.

## 5. Courbe d'apprentissage comportemental des LLM

### 5.1 Définition honnête

Dans Aevum, **apprentissage** signifie :

> changement observable de comportement décisionnel après des conséquences,
> dans les conditions où le modèle reçoit effectivement l'information et peut
> l'utiliser.

Cela ne signifie pas que le modèle a modifié ses paramètres. Le produit doit
employer les termes suivants :

- **adaptation observée** : les décisions suivantes changent dans une direction
  mesurable après un événement ;
- **signal d'apprentissage** : plusieurs indices concordants, comparés à une
  ligne de base ;
- **absence de preuve d'adaptation** : comportement inchangé ou données
  insuffisantes ;
- **non classable** : modèle trop peu servi, trop de replis, ou exposition
  inégale ;
- **apprentissage des poids** : affirmation interdite par défaut, sauf protocole
  d'entraînement externe documenté.

### 5.2 Ce qui doit être enregistré

À chaque point de décision, le journal doit permettre de relier :

- modèle demandé ;
- modèle réellement servi ;
- fournisseur réellement servi ;
- statut de repli ;
- contexte visible au dirigeant ;
- état des ressources et relations ;
- événement ou conséquence récente ;
- doctrine avant la décision ;
- décision produite ;
- justification fournie ;
- état du monde après résolution ;
- décision suivante du même dirigeant ;
- tokens, latence et erreurs, si disponibles sans secret.

Les prompts peuvent être conservés uniquement s'ils ne contiennent aucun secret
et si leur rétention est explicitement prévue. Les métriques doivent fonctionner
sans afficher le prompt complet.

### 5.3 Indices mesurables

Aevum ne fusionne pas ces indices en une note unique par défaut.

#### A. Correction après conséquence

Après un événement négatif clairement visible, mesurer si le dirigeant modifie
la décision pertinente lors des tours suivants :

- même erreur répétée ;
- erreur abandonnée ;
- correction partielle ;
- correction maintenue ;
- correction abandonnée après un nouveau contexte.

#### B. Sensibilité aux conséquences

Comparer la décision suivante avec les changements réels de :

- population ;
- nourriture ;
- richesse ;
- soldats ;
- territoire ;
- relations ;
- progrès ;
- menace documentée.

Une réponse cohérente avec une conséquence observée est un indice, pas une
preuve d'intelligence générale.

#### C. Adaptation de doctrine

Mesurer si la stratégie change lorsque ses hypothèses deviennent fausses :

- posture conservée malgré une perte répétée ;
- posture changée après un seuil critique ;
- allocation de ressources ajustée ;
- cible territoriale abandonnée ou maintenue ;
- alliance créée, tenue ou rompue selon les événements.

#### D. Fidélité intention → action

Comparer ce que le dirigeant affirme vouloir faire avec :

- la décision émise ;
- la décision acceptée ;
- le résultat effectif.

Une civilisation peut être fidèle mais inefficace, ou efficace sans justification
fidèle. Ces dimensions restent séparées.

#### E. Résultat sous exposition appariée

Pour comparer des modèles, utiliser des graines, positions, doctrines initiales
et fenêtres appariées. Ne pas comparer des moyennes de courses indépendantes
comme si elles avaient vécu le même monde.

#### F. Robustesse et répétition

Un signal n'est présent que s'il survit à :

- plusieurs graines ;
- plusieurs positions initiales ;
- au moins une fenêtre courte et une fenêtre longue ;
- un contrôle de disponibilité fournisseur ;
- un contrôle du taux de repli.

### 5.4 Construction de la courbe

La courbe d'apprentissage contient au minimum quatre séries par modèle :

1. **Conséquence reconnue** — part des décisions suivantes compatibles avec les
   événements réellement observés ;
2. **Correction d'erreur** — part des erreurs répétées qui cessent après un
   retour de conséquence ;
3. **Cohérence doctrinale** — stabilité ou changement de posture selon les
   objectifs déclarés et le contexte ;
4. **Fidélité du récit** — part des affirmations postérieures confirmées par le
   journal.

Chaque point doit afficher :

- la fenêtre d'observation ;
- le nombre de décisions ;
- le taux de réponses du modèle lui-même ;
- le taux de replis ;
- la variance entre graines ;
- un lien vers les événements sources.

La visualisation doit montrer une bande d'incertitude ou le nombre de courses,
plutôt qu'une ligne lisse qui donnerait une fausse précision.

### 5.5 Lecture dans l'interface

Dans la page d'une civilisation :

- une courbe principale sélectionnable ;
- marqueurs verticaux pour famine, guerre, perte de capitale, progrès et rupture
  d'alliance ;
- annotation « adaptation observée » seulement quand les critères sont remplis ;
- annotation « données insuffisantes » sinon ;
- bouton `Voir les décisions sources` ;
- comparaison entre modèles désactivée si le taux de service est sous le seuil ;
- affichage séparé des résultats de simulation et de la disponibilité du modèle.

Le titre ne doit jamais être « intelligence du modèle ». Exemples acceptables :

- `Réponse aux conséquences`
- `Correction des erreurs observées`
- `Cohérence de doctrine`
- `Fidélité du récit au journal`

## 6. Architecture technique proposée

### Packages

- `@abs/contracts` : schémas versionnés des identités, événements et métriques ;
- `@abs/world` : résolution déterministe, aucune requête réseau ;
- `@abs/agents` : appels distants, statut de service et décisions ;
- `@abs/metrics` : calcul pur des indices et courbes ;
- `@abs/cli` : génération d'ères, indexation et rapports ;
- `@abs/player` : carte, chronique, profils et courbes.

La création de `@abs/metrics` est recommandée pour empêcher que la logique de
mesure se retrouve dans Vue ou dans l'orchestrateur réseau.

### Flux de données

```text
état initial + graine
        ↓
monde déterministe
        ↓
point de décision
        ↓
contexte public → modèle
        ↓
ordre + justification + métadonnées de service
        ↓
résolution du moteur
        ↓
journal versionné
        ↓
metrics pures + chronique + courbes
```

### Compatibilité

Les anciens journaux doivent rester ouvrables comme archives. Les nouvelles
ères portent une version de monde et une version de métriques. Une métrique
corrigée ne réécrit jamais silencieusement une métrique publiée : elle produit
une nouvelle version de rapport.

## 7. Direction visuelle Aevum

### Principes

- atlas nocturne, pas cockpit SaaS ;
- carte comme scène, texte comme voix éditoriale ;
- cuivre pâle pour la chronologie et les repères ;
- ivoire froid pour la lecture ;
- bleu-noir profond pour le champ ;
- formes, libellés et motifs en complément des couleurs ;
- typographie de chronique sans blackletter copiée ;
- absence de particules ou de décorations non causées par les données ;
- mouvement bref et désactivable ;
- aucune police distante obligatoire.

### Écrans de Season 1

1. **Entrée de l'ère** — nom d'Aevum, statut du monde, année, population,
   civilisations vivantes et carte immédiatement visible.
2. **Atlas** — territoire, frontières, capitales, événements et timeline.
3. **Acte** — situation, décision, résolution, conséquence et preuve.
4. **Civilisation** — identité, doctrine, historique, courbes d'adaptation et
   décisions sources.
5. **Chronique** — épisodes éditorialisés, avec lien vers chaque journal.
6. **Archives** — batailles `v1`/`v2`, rapports et ancienne identité du projet.
7. **Méthode** — déterminisme, limites, disponibilité des modèles et protocole
   de mesure.

## 8. Renommage Aevum

Le renommage se fait en deux couches.

### Couche publique

- titre, sous-titre, favicon et métadonnées ;
- README et documentation ;
- changelog et notes de release ;
- textes de l'interface ;
- rapports et liens publics ;
- nom de l'image Docker et procédure de preview ;
- dépôt GitHub et URL canonique, si le slug est disponible.

### Couche technique

- package racine et workspace player ;
- variables de nom non sensibles ;
- scripts et dossiers de déploiement ;
- références de CI ;
- tests qui vérifient le branding ;
- remote Git local après renommage GitHub.

Les identifiants internes `@abs/*`, les chemins historiques de replays et les
schemas existants ne sont pas renommés dans la même opération sans carte dédiée.
Cela évite de confondre branding et migration de contrats.

## 9. Découpage Kanban proposé

```text
A0  Gate — approuver le nom Aevum et le design Season 1
A1  Contrats — identité, doctrine, mémoire et événements
A2  Moteur — progression et événements de vie déterministes
A3  Métriques — courbes d'adaptation et protocole d'équité
A4  UI — profils, courbes, annotations et sources
A5  UI — atlas détaillé et épisodes de chronique
A6  Génération — produire une ère publique reproductible
A7  Rename — migration publique et package metadata
A8  Integration — campagne complète + replays + rapports
A9  QA — navigateur, accessibilité, performance et sécurité
A10 Release — version, tag, CI, notes et publication
```

Dépendances :

```text
A0 → A1, A2, A3, A7
A1 + A2 → A4
A1 + A2 → A5
A2 + A3 → A6
A4 + A5 + A6 → A8
A7 + A8 → A9
A9 → A10
```

Les cartes indépendantes pourront être parallélisées uniquement dans des
worktrees séparés. Le moteur, les contrats et l'interface ne doivent jamais
être modifiés simultanément dans le même worktree.

## 10. Critères de réussite

### Produit

- [ ] Un visiteur comprend Aevum et son rôle en moins d'une minute.
- [ ] Une ère complète possède un début, des tournants, des conséquences et un
      état final lisible.
- [ ] Chaque civilisation possède une identité et une doctrine persistantes.
- [ ] Au moins une courbe d'adaptation est visible avec ses décisions sources.
- [ ] Aucune page ne présente un score d'intelligence sans protocole et
      incertitude.

### Technique

- [ ] Le moteur reste déterministe et sans réseau.
- [ ] Les anciens journaux restent lisibles.
- [ ] Les métriques sont calculées hors de Vue et testées offline.
- [ ] Les replis et taux de service sont distincts des résultats.
- [ ] Les secrets ne figurent dans aucun artefact publié.

### Expérience

- [ ] 2D complète et accessible par défaut.
- [ ] Mobile 375 px, desktop 1440 px et reduced-motion vérifiés.
- [ ] Courbes lisibles sans dépendre de la couleur seule.
- [ ] Chaque annotation ouvre une preuve.
- [ ] Les états « données insuffisantes » et « modèle non classable » sont
      explicites.

### Release

- [ ] Rename public et metadata vérifié par recherche exhaustive.
- [ ] Version et lockfile cohérents.
- [ ] Tests, typecheck, build, healthcheck, probe monde et CI verts.
- [ ] Une ère publique reproductible est publiée.
- [ ] Changelog et rapport de méthodologie livrés.
- [ ] Tag et release GitHub créés uniquement après preuves fraîches.

## 11. Risques et garde-fous

- **Faux apprentissage** : utiliser adaptation comportementale, jamais
  apprentissage des poids sans preuve externe.
- **Biais de disponibilité** : afficher taux de service, replis et latence.
- **Bruit de plateau** : utiliser des courses appariées et plusieurs horizons.
- **Survivorship bias** : conserver aussi les civilisations éteintes.
- **Narration causale abusive** : utiliser `observed-after` quand l'attribution
  n'est pas prouvée.
- **Renommage destructif** : conserver anciens chemins, replays et redirects.
- **Scope explosion** : une carte = un livrable vérifiable ; pas de refonte
  simultanée du moteur, de la mesure et du branding.

## 12. Décisions en attente de revue

1. Confirmer que l'« apprentissage » signifie bien adaptation comportementale
   observable et non entraînement des poids.
2. Confirmer les quatre séries initiales de la courbe : conséquences reconnues,
   correction d'erreur, cohérence doctrinale et fidélité du récit.
3. Confirmer que `@abs/*` reste interne pendant la première migration Aevum.
4. Confirmer que la première ère publique est une campagne reproductible avant
   d'ajouter plusieurs mondes.
