# Release R1 — brief produit et expérience

Statut : décision de produit · Date : 2026-08-22

## Comment lire ce document

Chaque affirmation normative porte un statut. Cette distinction évite qu'une
contrainte du moteur, un choix d'expérience et une hypothèse à vérifier soient
traités comme une seule chose.

- **[Fait observé]** : présent dans le dépôt, les données ou l'interface au
  22 août 2026. Les faits portant sur la référence publique proviennent du
  relevé fourni avec cette tâche ; aucun nouvel accès réseau n'a été effectué.
- **[Décision R1]** : choix à implémenter pour considérer R1 comme livrée.
- **[Inconnu]** : information non établie. Elle ne doit ni être affirmée dans le
  produit ni bloquer R1, sauf si un critère d'acceptation le demande.

Sources relues : `CLAUDE.md`, `README.md`, `docs/spec/mvp.md`,
`docs/spec/visual-identity.md`, `docs/spec/world-w8.md` et les composants de
`apps/player/src`.

## La promesse

**[Décision R1]** La phrase de promesse est :

> Quatre modèles gouvernent un monde qui continue sans eux. Lisez ce qu'ils ont
> décidé, voyez ce que le moteur en a fait, et rejouez chaque année pour le
> vérifier.

**[Fait observé]** Le produit n'est plus principalement une bataille tactique.
Le mode `w8` est un monde continu ; les batailles `v1` et `v2` sont gelées et
restent consultables comme archives. Le modèle décide uniquement aux points de
décision et le moteur déterministe résout toutes les autres années.

**[Décision R1]** R1 vend une **chronique vérifiable**, pas un jeu, un direct, un
chat entre IA ni une promesse d'apprentissage. Le visiteur ne commande rien. Il
doit comprendre les trois idées suivantes sans ouvrir les règles :

1. le monde vit année après année ;
2. un dirigeant intervient seulement quand une décision est nécessaire ;
3. le journal permet au navigateur de recomposer exactement l'histoire.

**[Décision R1]** La tension éditoriale est « intention contre conséquence ».
Chaque moment important met côte à côte, dans cet ordre : la situation, les
mots du dirigeant, sa décision mécanique, la résolution du moteur et les effets
mesurés. Une extinction ou un serment rompu est une issue valable, jamais une
erreur à excuser.

## Public et résultat attendu

### Public principal

**[Décision R1]** La personne curieuse des modèles, sans connaissance préalable
du dépôt. Elle arrive depuis un lien et veut savoir en moins d'une minute ce qui
s'est réellement passé. Sa réussite est de pouvoir formuler une observation du
type : « Crimson a choisi la pression à l'an 148 ; le moteur lui a fait prendre
une terre au prix de soldats. »

### Public secondaire

**[Décision R1]** Le praticien, chercheur ou journaliste qui veut contrôler la
preuve. Il doit atteindre depuis le même moment le modèle effectivement servi,
le retard éventuel, les événements produits, les règles applicables et un lien
permanent vers l'année.

### Non-public

**[Fait observé]** Le MVP exclut le joueur humain et le temps réel.

**[Décision R1]** R1 ne crée ni commandes de civilisation, ni compte, ni score
global qui confondrait victoire, qualité de décision et disponibilité d'un
fournisseur. Les batailles ne reprennent pas la place de produit principal.

## Le contrat de la première minute

**[Décision R1]** Aucun splash screen, bouton « entrer », tutoriel modal ou son
automatique ne sépare le visiteur du monde. L'entrée est théâtrale par sa
composition et sa progression, pas par une barrière.

### 0 à 5 secondes — situer

Au premier écran, même avant toute interaction, apparaissent :

- le nom `AI Battle Simulator` ;
- la promesse courte « Un monde gouverné par quatre modèles, rejouable à
  l'identique » ;
- le statut honnête du monde : nom, ère, dernière année vécue, nombre de
  civilisations encore vivantes et date de dernière avancée si elle est connue ;
- les accès permanents `Chronique`, `Règles`, `À propos` et `Archives` ;
- une portion significative de la carte, et non une rangée de cartes KPI.

Si le monde est ancien ou si la dernière passe a échoué, l'état d'exploitation
est visible dans ce premier écran. Si aucun statut n'est servi, l'interface dit
« dernière avancée inconnue » plutôt que de suggérer que le monde est à jour.

### 5 à 20 secondes — voir vivre

La carte constitue la scène principale. Une entrée non bloquante de 600 ms au
maximum révèle successivement le territoire, les frontières, les capitales et
le curseur temporel. Le visiteur peut immédiatement :

- lancer ou arrêter le déroulé des années ;
- revenir au dernier tournant ou à la dernière année ;
- parcourir l'ère avec un contrôle natif ;
- identifier chaque civilisation autrement que par sa seule couleur.

Avec `prefers-reduced-motion: reduce`, la scène complète est présente dès la
première image, sans révélation séquencée.

### 20 à 40 secondes — comprendre un tournant

Le premier contenu narratif proposé est le dernier tournant significatif, pas
simplement la dernière ligne du journal. Son bloc répond sans jargon à cinq
questions :

| Question | Contenu affiché |
| --- | --- |
| Quand et pour qui ? | année, civilisation, type de crise ou d'arbitrage |
| Pourquoi maintenant ? | faits ayant levé le point de décision |
| Qui a réellement répondu ? | modèle servi ; repli et retard explicités |
| Qu'a-t-il décidé et dit ? | posture, répartition, terre, serment ou credo ; raison citée sans la réécrire |
| Qu'a fait le moteur ? | événements et variations observables entre avant et après |

Le bloc offre `Voir cette année` et `Copier le lien`. Si aucun dirigeant n'a
encore répondu, il dit « monde vécu sans décision de dirigeant » et montre un
événement du moteur ; il n'invente pas de narration.

### 40 à 60 secondes — vérifier ou approfondir

Depuis le tournant, un lien `Comment le vérifier` révèle la bande de preuve :
graine, version des règles, modèle demandé et servi, latence, nombre d'essais,
retard et principe de relecture locale. Les accès `Règles` et `À propos`
restent visibles sans retour en haut. Le visiteur peut continuer à lire la
chronique sans avoir dû ouvrir cette couche technique.

## Architecture de l'information

**[Décision R1]** L'ordre visuel de la page `Chronique` est le suivant :

1. **Mât de navigation.** Marque, statut condensé et quatre destinations. Il ne
   dépasse pas 96 px de haut sur ordinateur et devient une barre compacte sur
   téléphone.
2. **Scène du monde.** Carte, année active, lecture/pause, vitesse, accès au
   dernier tournant et frise de possession. C'est la surface dominante.
3. **Acte de l'année.** Tournant sélectionné, parole du dirigeant, décision puis
   réponse du moteur. C'est le coeur éditorial.
4. **État des civilisations.** Quatre fiches comparables, dont les chiffres
   détaillent la scène sans la précéder.
5. **Trajectoires.** Part du monde et une métrique sélectionnable dans le temps.
6. **Registre.** Événements et décisions exhaustifs, repliés au chargement mais
   accessibles au clavier et indexables dans la page.

**[Décision R1]** Les destinations globales ont des responsabilités nettes :

| Destination | Rôle R1 | Contenu principal |
| --- | --- | --- |
| `Chronique` | expérience par défaut | monde continu, tournants, paroles, conséquences |
| `Règles` | expliquer la causalité | ce que décide un dirigeant, ce que résout le moteur, déterminisme |
| `À propos` | établir la confiance | promesse, méthode, relecture locale, limites, accès aux rapports |
| `Archives` | préserver l'histoire du projet | batailles v1/v2, grille 2D par défaut, décisions et journaux |

Les rapports mesurés appartiennent à `À propos` sous l'entrée `Mesures et
rapports`, plutôt qu'à une cinquième destination de même poids. Les URLs
profondes vers un rapport restent valables.

**[Fait observé]** L'interface actuelle offre `Chronique`, `Archives`, `Règles`
et `Rapports`, charge la chronique et la 3D à la demande, encode déjà le monde,
l'année, la bataille, le tour et le point de vue dans l'URL. Elle expose une
carte, deux graphiques, quatre fiches, les décisions, les événements, la
télémétrie, un lecteur de bataille et ses rapports audités.

**[Décision R1]** Ces capacités sont conservées. R1 change leur priorité et leur
mise en récit ; elle ne crée pas une seconde visualisation concurrente. La vue
3D reste une option des archives et n'entre pas dans le chargement initial de la
chronique.

## Direction visuelle — l'atlas nocturne vivant

### Intention

**[Décision R1]** La page ressemble à un atlas d'observation qui s'écrit encore,
posé dans une salle nocturne. Elle combine une grande scène cartographique, des
inscriptions éditoriales et des marques de preuve précises. Elle ne ressemble ni
à un cockpit SaaS, ni à une carte de jeu de stratégie, ni à un parchemin
historique.

La référence publique fournie emploie une entrée théâtrale, une typographie de
display forte, une scène sombre, une narration mêlée aux données et un accès
immédiat à la simulation, aux règles et à la présentation. **[Décision R1]** R1
retient ces principes de rythme et de hiérarchie, mais pas ses signes : aucune
blackletter, iconographie impériale, silhouette de soldat, texture, formulation,
asset, identité ou code de cette référence.

### Composition

**[Décision R1]** La scène rompt la succession actuelle de rectangles de même
poids :

- la carte occupe environ deux tiers de la largeur utile sur écran large ;
- le titre d'année, très grand, se place dans l'espace négatif de la scène ;
- les contrôles restent sur un rail bas, jamais superposés aux lieux utiles ;
- le tournant prend la forme d'une annotation reliée à la frise, pas d'une
  notification flottante ;
- les fiches de civilisation sont séparées par des filets et des rythmes
  typographiques, avec au plus un fond de panneau commun ;
- la monospace est réservée aux nombres, identifiants, statuts et preuves.

### Couleur, matière et forme

**[Décision R1]** Le fond reste bleu-noir, mais n'est pas un aplat uniforme : un
léger champ radial et un grain procédural CSS de très faible contraste donnent
de la profondeur sans asset. Le texte principal est ivoire froid ; le cuivre
pâle sert à l'action et aux repères temporels. Les quatre couleurs de
civilisation existantes restent stables entre carte, frise, courbes et archives.

Les frontières sont les marques les plus nettes de la carte. Le terrain reste
procédural et ne représente que des propriétés réellement présentes dans le
moteur. Un événement peut produire une brève marque géométrique localisée, mais
jamais fumée, relief, météo ou troupe que les données ne justifient pas.

La couleur ne porte jamais seule une civilisation ou un état : nom court,
forme, motif, trait ou libellé la doublent. Les coins sont peu arrondis ; aucun
halo néon, verre flou généralisé, gradient violet-bleu ni pluie de particules.

### Typographie

**[Décision R1]** Trois voix maximum :

- **display éditorial** pour la marque, l'ère et l'année, avec une serif à forts
  contrastes mais sans forme blackletter ;
- **texte** pour les explications et paroles, optimisé pour le français à
  16 px minimum ;
- **monospace système** pour la preuve et les contrôles temporels.

Une fonte distante est interdite. Une éventuelle fonte display est auto-hébergée
et sous licence redistribuable ; à défaut, une pile serif système explicite est
la solution R1 conforme. La page reste utilisable et stable avant le chargement
de cette fonte.

### Mouvement et son

**[Décision R1]** Le mouvement sert trois relations : révéler la géographie,
faire sentir le passage du temps et relier une décision à son effet. Il n'anime
ni les chiffres en boucle ni les surfaces décoratives. Les changements d'année
durent 180 à 320 ms ; l'entrée dure au plus 600 ms ; aucune animation d'ambiance
ne tourne en permanence.

**[Fait observé]** Les archives disposent déjà d'un son Web Audio synthétisé,
coupé par défaut, et d'un mode réduit qui supprime l'interpolation.

**[Décision R1]** R1 ne joue aucun son à l'ouverture. Si le son est étendu à la
chronique, il reste synthétisé, activé explicitement, accompagné d'un libellé
d'état et non indispensable à la compréhension. Son absence est acceptable pour
R1.

## Voix et contenu

**[Décision R1]** La voix du produit est celle d'un chroniqueur exact : phrases
courtes, verbes concrets, dates et causalité. Elle peut être grave, jamais
grandiloquente. Elle ne transforme pas une sortie de modèle en vérité.

Règles d'écriture :

- dire « le dirigeant écrit » ou « le modèle répond », jamais « l'IA pense »,
  « apprend » ou « veut » hors d'une citation ;
- distinguer systématiquement l'intention (`décide`, `promet`, `convoite`) du
  résultat (`le moteur accorde`, `rejette`, `retire`) ;
- conserver la raison du modèle mot pour mot, signalée comme citation ;
- traduire les enums dans le récit, et garder leur forme brute uniquement dans
  la couche de preuve ;
- dire « modèle servi » et signaler le repli ; ne jamais attribuer une décision
  au seul modèle demandé ;
- préférer « an 148 : la frontière se ferme » à « événement majeur détecté » ;
- nommer explicitement les absences : « sans explication », « statut inconnu »,
  « non vérifiable », « décision différée de 3 ans » ;
- ne jamais qualifier une civilisation de bonne, mauvaise, intelligente ou
  stupide. Décrire son choix et son coût suffit.

**[Décision R1]** Les textes indispensables sont intégrés au produit et non
placés dans des infobulles : promesse, état du monde, sens du contrôle temporel,
différence entre décision et résolution, origine d'une citation et message
d'erreur. Les infobulles ne donnent que des détails supplémentaires.

## Responsive et accessibilité

### Mise en page

**[Décision R1]** Trois états sont spécifiés, sans détection de terminal :

| Largeur CSS | Disposition attendue |
| --- | --- |
| `≥ 1100 px` | scène en deux colonnes carte/acte ; contenu jusqu'à 1440 px |
| `700–1099 px` | carte pleine largeur, acte dessous ; navigation sur une ligne si possible |
| `< 700 px` | flux unique : statut, carte, contrôles, acte, civilisations, trajectoires, registre |

À 320 px, aucun défilement horizontal de page. Les tableaux larges défilent dans
leur propre conteneur. La carte reste carrée ou presque carrée ; les courbes
changent de proportions au lieu d'être écrasées. Le contrôle de l'année et les
actions principales restent visibles sans précision de pointeur.

### Accès universel

**[Décision R1]** Le niveau visé est WCAG 2.2 AA pour les parcours R1 :

- contraste d'au moins 4,5:1 pour le texte courant et 3:1 pour le grand texte,
  les composants et leurs états ;
- cible interactive d'au moins 44 × 44 px, sauf liens intégrés à une phrase ;
- ordre de tabulation identique à l'ordre visuel et focus toujours visible ;
- navigation complète au clavier, y compris lecture, année, graphiques et
  contenus repliés ;
- un seul `h1`, régions `header`, `nav`, `main`, `aside` et `footer` cohérentes ;
- nom accessible pour chaque contrôle, état actif exposé et changement d'année
  annoncé dans une région `aria-live="polite"` sans relire toute la page ;
- résumé textuel utile pour chaque SVG ; la preuve et les valeurs restent
  disponibles sous forme textuelle ;
- aucune information par couleur, survol, animation ou son seuls ;
- zoom navigateur à 200 % sans perte de contenu ni chevauchement ;
- `prefers-reduced-motion` supprime entrée séquencée, interpolations et
  défilements animés ;
- `prefers-contrast: more` renforce fonds, frontières, curseurs et focus sans
  changer la signification.

**[Fait observé]** Le player actuel possède déjà des cibles de 44 px globales,
un focus visible, des libellés textuels doublant les couleurs, des résumés ARIA
pour plusieurs SVG, une règle `prefers-reduced-motion`, une grille 2D complète
et une dégradation explicite sans WebGL.

**[Inconnu]** Aucun rapport d'audit complet au clavier, avec lecteur d'écran,
à 200 % de zoom et sous `prefers-contrast: more` n'a été observé dans les sources
relues. La présence d'attributs ARIA ne vaut pas validation de parcours.

## Budget d'assets, de dépendances et de performance

**[Fait observé]** La direction actuelle est procédurale et sans texture, sprite
ou modèle importé. Le document d'identité mesure 48 Ko compressés pour le bundle
2D et 121 Ko supplémentaires pour la 3D chargée à la demande. Vue 3D, chronique,
règles et rapports sont déjà découpés dynamiquement.

**[Décision R1]** Budgets de transfert, compression Brotli ou gzip mesurée sur
les fichiers de production :

| Ressource | Budget R1 |
| --- | ---: |
| shell + chronique initiale, JS et CSS | ≤ 85 Ko |
| données nécessaires au premier monde | ≤ 250 Ko ; au-delà, chargement progressif requis |
| fonte display optionnelle, un fichier `woff2` | ≤ 45 Ko |
| vue 3D des archives, chunk différé | ≤ 140 Ko |
| image, texture, vidéo ou audio téléchargé au chargement | 0 Ko |
| total initial hors journal du monde | ≤ 130 Ko |

Le cache navigateur doit pouvoir conserver les assets immuables. La carte et
les ornements sont SVG/CSS/Canvas déterministes ; aucun asset de la référence
publique n'entre dans le dépôt.

**[Décision R1]** Aucune nouvelle dépendance d'exécution n'est autorisée pour la
mise en page, les icônes, les graphiques, le grain, les transitions ou le son.
Vue, SVG, CSS et Web Audio couvrent le besoin. Une dépendance ne peut être
ajoutée que si elle remplace davantage de code livré qu'elle n'en ajoute et si
son coût, sa licence, son chargement différé et son alternative native sont
documentés avant intégration.

**[Décision R1]** Sur un profil mobile médian, le contenu textuel et la carte
doivent apparaître avant toute fonte optionnelle et rester interactifs pendant
la recomposition. L'animation ne doit provoquer ni décalage de mise en page ni
tâche longue perceptible pendant le déplacement du curseur d'année.

**[Inconnu]** La taille réelle du journal public R1, les métriques LCP/INP/CLS du
build de production et la licence de l'éventuelle fonte display ne sont pas
établies ici. Les budgets sont des portes de sortie, pas des mesures déjà
atteintes.

## États à concevoir, pas à subir

**[Décision R1]** Chacun de ces états reçoit un contenu spécifique et conserve
l'accès aux `Règles` et à `À propos` :

- chargement du journal : structure stable et message « Recomposition du monde » ;
- aucun monde servi : explication publique du manque de données, sans commande
  destinée uniquement au mainteneur comme action principale ;
- journal invalide : fichier nommé, raison lisible, aucun état partiellement
  présenté comme fiable ;
- règles archivées : le monde est annoncé comme archive et n'est jamais rejoué
  sous une version différente ;
- dernière passe échouée ou ancienne : date et arrêt visibles près du statut ;
- aucune décision : années vécues par le moteur, sans attribuer de choix à un
  modèle ;
- réponse de repli : modèle demandé et modèle servi distincts ;
- civilisation éteinte : date conservée, ligne temporelle arrêtée, paroles
  historiques toujours accessibles ;
- JavaScript ou WebGL limité : la chronique et les archives 2D restent le
  parcours de référence ; la 3D n'est jamais nécessaire.

## Hors périmètre de R1

**[Décision R1]** Ne font pas partie de cette release : nouveaux mécanismes du
moteur, nouvelles décisions de modèle, génération d'images, narration vocale,
musique, temps réel, commandes humaines, comptes, commentaires, classement
global, terrain décoratif non simulé, refonte de la vue 3D ou traduction
multilingue.

## Inconnues à résoudre sans inventer

Ces points doivent être tranchés pendant l'implémentation ou consignés comme
limites ; aucun ne permet une affirmation marketing implicite.

- **[Inconnu]** Quel monde et quel tournant exacts seront servis au lancement.
- **[Inconnu]** Si les données actuelles contiennent, pour chaque point de
  décision, une forme directement affichable de tous les faits déclencheurs et
  un avant/après assez précis pour le bloc « réponse du moteur ».
- **[Inconnu]** Si `À propos` mérite un composant propre ou peut composer les
  contenus existants de `Règles` et `Rapports` sans duplication.
- **[Inconnu]** Quelle serif display locale satisfait à la fois identité,
  accents français, licence et budget ; la pile système reste le défaut sûr.
- **[Inconnu]** Le seuil à partir duquel la recomposition d'une très longue ère
  doit passer dans un worker ou être segmentée. Il doit être mesuré sur le
  journal R1, pas deviné.
- **[Inconnu]** La compréhension réelle de « recomposé dans votre navigateur »
  par le public principal ; un test utilisateur court doit vérifier la formule,
  mais R1 ne prétend pas que ce test a déjà eu lieu.

## Critères d'acceptation binaires

R1 est acceptable seulement si chaque ligne suivante vaut **oui** sur le build
de production et les données de release.

### Promesse et première minute

- [ ] L'URL racine ouvre la chronique d'un monde, jamais les archives ni une
  page vide, lorsqu'un monde est servi.
- [ ] À 1440 × 900, la première vue montre marque, promesse, statut, quatre
  destinations et une partie lisible de la carte sans défilement.
- [ ] À 390 × 844, marque, statut, navigation et carte commencent dans le
  premier écran ; aucun modal ou écran d'entrée ne les masque.
- [ ] Sans interaction, la page dit explicitement que les modèles décident aux
  points de décision et que le moteur résout le reste.
- [ ] En trois actions au plus depuis l'URL racine, on atteint un tournant, la
  citation du dirigeant, le modèle servi et la conséquence du moteur.
- [ ] `Chronique`, `Règles`, `À propos` et `Archives` sont accessibles depuis
  chaque destination sans ouvrir de menu à plusieurs niveaux.

### Fidélité et auditabilité

- [ ] Chaque parole de dirigeant affichée provient du journal et est visuellement
  marquée comme citation ; aucun texte généré par l'interface ne lui est mêlé.
- [ ] Chaque décision montre le modèle réellement servi ; un repli ou un retard
  ne peut pas être confondu avec une réponse native et immédiate.
- [ ] Chaque tournant relie une année, un fait déclencheur, une décision et au
  moins un résultat du moteur, ou nomme explicitement la donnée manquante.
- [ ] Un lien copié vers un monde et une année recharge le même moment ; un lien
  vers une bataille, un tour, un point de vue ou un rapport existant reste
  fonctionnel.
- [ ] Un journal archivé sous d'anciennes règles est présenté comme archive et
  n'est pas recomposé sous les règles courantes.
- [ ] L'interface n'emploie nulle part « IA qui apprend » ni « direct » pour
  décrire le monde.

### Direction et contenu

- [ ] La carte est la plus grande surface de la première vue sur ordinateur ;
  aucune rangée de KPI ne la précède.
- [ ] La monospace n'est pas utilisée pour les paragraphes narratifs ni les
  citations.
- [ ] Aucun asset, texte, nom, symbole, code ou trait identitaire de la référence
  publique n'est présent ; aucune blackletter ni imagerie napoléonienne n'est
  utilisée.
- [ ] Aucun terrain, effet ou entité absent du moteur n'est représenté comme un
  fait du monde.
- [ ] Les états vide, chargement, erreur, archive, retard, repli et extinction
  ont chacun un libellé explicite testé avec une fixture ou une donnée dédiée.

### Responsive et accessibilité

- [ ] Les parcours `Chronique → année → décision → preuve`, `Règles`, `À propos`
  et `Archives → tour` sont entièrement réalisables au clavier.
- [ ] Les contrôles visibles ont un focus perceptible et une cible de 44 × 44 px
  ou sont des liens textuels intégrés.
- [ ] À 320 px et à 200 % de zoom, la page ne défile pas horizontalement et
  aucun contenu ni contrôle ne se chevauche ou disparaît.
- [ ] Un contrôle automatisé et une vérification manuelle ne trouvent aucun
  contraste inférieur aux seuils AA sur les éléments du parcours principal.
- [ ] Avec `prefers-reduced-motion: reduce`, aucune entrée séquencée,
  interpolation de carte ou animation de défilement ne se produit.
- [ ] Avec les couleurs remplacées par des niveaux de gris, civilisation,
  sélection, alerte, extinction et état de décision restent identifiables.
- [ ] Avec un lecteur d'écran, chaque graphique annonce son sujet, son intervalle
  et un résumé ; les mêmes valeurs et tournants sont disponibles en texte.
- [ ] Le changement d'année est annoncé une seule fois sans déplacer le focus.

### Poids et robustesse

- [ ] Le rapport de build mesure et respecte chacun des budgets de transfert du
  tableau ci-dessus.
- [ ] Aucun appel vers une fonte, image, script, analytics ou média tiers n'est
  effectué au chargement ou à l'interaction.
- [ ] Aucun son ne joue avant une activation explicite et son état est annoncé
  en texte.
- [ ] La vue 3D et les rapports ne figurent pas dans le chunk initial de la
  chronique.
- [ ] Sans WebGL, la grille 2D des archives reste complète et un message explique
  la dégradation ; la chronique ne dépend pas de WebGL.
- [ ] Une erreur de données ne produit ni écran blanc ni erreur console non
  gérée ; elle affiche l'état prévu et ne présente aucune valeur partielle comme
  vérifiée.

## Définition finale de R1

**[Décision R1]** R1 n'est pas « le dashboard actuel avec une meilleure police ».
Elle est livrée quand un visiteur voit d'abord un monde, rencontre ensuite une
décision et sa conséquence, puis peut descendre jusqu'à la preuve sans changer
de produit. Le spectacle vient de l'histoire réellement produite ; la confiance
vient de la possibilité de la rejouer.
