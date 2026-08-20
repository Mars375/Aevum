# Monde continu — w6

Les règles v1 et v2 décrivent une **partie** : elle commence, elle se résout,
elle désigne un vainqueur. Celle-ci décrit un **lieu**. Rien ne s'y termine.

Ce n'est pas « v2 avec plus de tours ». Une partie a une fin, donc une mesure ;
un monde continu n'en a pas. Les conditions de victoire deviennent des jalons
qu'une civilisation franchit, pas des états où la simulation s'arrête.

v1 et v2 restent jouables et inchangés. w1 est un troisième mode, pas un
successeur.

## La contrainte qui dicte l'architecture

Un appel LLM par civilisation et par tour épuiserait le quota gratuit d'une
journée en quelques minutes — et un monde qui s'arrête faute de quota n'est pas
continu. D'où la règle qui commande tout le reste :

> **Le moteur simule en continu et gratuitement ; le modèle n'est consulté
> qu'aux points de décision.**

Un point de décision est levé quand le monde atteint un état auquel la doctrine
en place ne sait pas répondre : famine, mauvaise récolte sur des greniers déjà
courts, solde impayée, progrès atteint, frontière qui recule, ou simple dérive
(rien n'a demandé d'arbitrage depuis longtemps).

## Invariants

| | |
|---|---|
| **W1** | Un point de décision est une fonction de l'état et des évènements du tour, et de rien d'autre. Même monde, mêmes points, toujours. Pas d'horloge, pas d'aléatoire. |
| **W2** | Une civilisation éteinte n'est jamais consultée. Elle reste dans le monde comme ruine. |
| **W3** | Tout point levé porte les faits qui l'ont levé. Un dirigeant n'est jamais interrogé sans qu'on lui dise pourquoi, et un lecteur peut contester. |
| **W4** | Rejouer le journal à travers le moteur reproduit l'état exactement. Même contrat que les rejeux de bataille. |
| **W5** | Une seule question par civilisation et par tour, la plus urgente. Quatre questions simultanées coûtent quatre appels et reçoivent quatre réponses médiocres. |
| **W6** | Les stocks ne passent jamais en négatif. Une dette de vivres, c'est des morts ; une dette de solde, c'est des désertions. |

## Le journal

Un rejeu de bataille stocke chaque état parce qu'une bataille est courte. Un
monde qui ne finit pas ne le peut pas : 500 états feraient croître le fichier
sans borne, et le coût de relecture avec lui.

Le journal ne stocke donc que **le monde initial et les décisions**. Les tours
intermédiaires sont recalculés — le moteur est déterministe, donc c'est gratuit.
C'est W4 qui rend ce raccourci légitime.

## Ce qui évolue réellement

Les poids d'un modèle ne changent pas entre deux appels. Dire qu'on « regarde
une IA évoluer » serait promettre un apprentissage qui n'aura pas lieu. Ce qui
évolue est autre chose, et c'est déjà beaucoup :

- **l'état de la civilisation** — population, terres, stocks, progrès ;
- **sa doctrine héritée** — un texte que ses dirigeants écrivent sur elle-même
  et transmettent à leurs successeurs. Évolution culturelle, pas évolution du
  modèle ;
- **quel modèle la gouverne**, si le monde en change.

## Les bandits, et la fin d'une ère

Un monde dont la seule adversité est sa propre récolte se stabilise. Mesuré :
avec des doctrines figées, trois civilisations tenaient un équilibre gardé
pendant mille ans. Les bandits mettent la pression sans qu'aucune civilisation
ait à être l'agresseur.

Deux règles en font une pression et non une guillotine :

- **ils viennent pour la richesse.** La fréquence dépend de la richesse *par
  habitant* : une grande civilisation pauvre n'est pas une cible plus tentante
  qu'une petite riche, et une civilisation qui n'a rien à prendre est laissée
  tranquille ;
- **ils prennent une part, jamais un montant.** Au plus 6 % des habitants, 25 %
  du trésor, 20 % des vivres. Un village perd ce que perd un village et y
  survit ; le même raid sur un empire coûte ce que coûte un empire. Rien n'est
  détruit d'un coup, et un pillage seul ne peut pas éteindre une civilisation.

L'âge du monde augmente **la fréquence des visites, jamais la sévérité d'une
visite** — les plafonds sont absolus. Cette distinction a été apprise en la
ratant : faire monter la sévérité a broyé les quatre civilisations à vingt âmes
et les y a maintenues indéfiniment, une stagnation pire que celle qu'elle
devait guérir.

**Une ère se termine quand il ne reste qu'une civilisation.** Sans personne avec
qui commercer, que piller ou par qui l'être, ce qui reste n'est plus une
civilisation mais une patience. L'ère se ferme, une autre s'ouvre avec une
graine dérivée de la précédente, et les journaux des ères passées restent
lisibles : une civilisation tombée à l'ère 3 a bel et bien existé.

## L'équité face au quota

Le quota est partagé et injuste par nature : un modèle bridé gouvernerait moins
qu'un autre, et sa civilisation prendrait du retard pour une raison qui n'a rien
à voir avec le monde. Deux règles l'empêchent :

- **le monde avance en pas verrouillé.** Toutes les civilisations vivent la même
  année en même temps ; aucune ne court en avant parce que son modèle a répondu
  plus vite. Les décisions de l'année N sont toutes tentées avant l'année N+1 ;
- **une décision qu'on ne peut pas servir est différée, jamais abandonnée.** Elle
  reste en tête de file et repart dès qu'un modèle répond. Une civilisation
  bridée est gouvernée *en retard*, pas *pas du tout* — et `deferredBy` note
  l'attente dans le journal, parce qu'être gouverné dix ans trop tard n'est pas
  la même chose qu'être gouverné à l'heure.

Le tableau imprimé en fin de course (consultée / gouvernée / différée par
civilisation) rend l'écart visible comme un nombre plutôt que comme une
impression.

## Mesures

Mesuré hors ligne par `scripts/world-probe.ts`, sans dépenser un seul appel —
même méthode que `scripts/balance.ts` pour les règles de bataille. 500 tours,
4 civilisations, doctrines figées (pire cas : une civilisation qui ne s'adapte
jamais traverse plus de crises).

| version des règles | appels si on demandait chaque tour | points levés | économie |
|---|---|---|---|
| rendements initiaux | 2000 | 44 | 45,5x — mais **toutes mortes au tour 12** |
| rendements corrigés | 2000 | 1576 | 1,3x — soit aucune économie |
| + délai entre décisions | 2000 | 56 | 35,7x — mais 79 % de simple dérive |
| + saisons déterministes | 2000 | 92 | 21,7x |
| + terre finie, bandits, délai long pour les situations | 2000 | **107** | **18,7x** |

Trois de mes hypothèses ont été réfutées par cette mesure, et chacune a laissé
une règle derrière elle :

1. **Un paysan produisait moins qu'une bouche ne mange** (0,9 contre 0,8 par
   habitant). Les quatre civilisations mouraient au tour 12. L'« économie » de
   45x était celle d'un monde vide.
2. **La règle de famine se redéclenchait à chaque tour** sur un état que son
   propre dirigeant venait de traiter — 1576 appels. Une question déjà posée ne
   redevient pas une question parce qu'un tour est passé : d'où `MIN_GAP_TICKS`,
   contourné seulement par une famine qui tue déjà.
3. **Un monde sans adversité n'a pas d'histoire** : 79 % des réveils disaient
   « rien ne s'est passé depuis quarante tours ». Les saisons viennent d'un
   hash pur de `(seed, tick)` et non de `Math.random()`, sans quoi W4 tomberait.

### Ce que le premier monde vivant a appris

Faire vivre un monde avec de vrais dirigeants a réfuté deux choses de plus,
qu'aucune mesure hors ligne n'aurait pu montrer :

4. **La reprise se déduisait des décisions.** Un monde de 120 ans où aucun
   dirigeant n'avait eu à trancher repartait silencieusement de l'an 0. Le
   journal doit dire jusqu'où le monde a vécu (`livedTo`) : les décisions ne le
   disent pas, et des siècles sans décision sont des siècles réels.

5. **Mon schéma supposait un seul encodage.** Les dirigeants répondaient très
   bien, mais imbriquaient les parts sous `shares`, puis sous `employment`.
   Neuf décisions de suite ont été jetées avant que le rejet ne soit rendu
   visible — un silence sans motif ressemble à une panne réseau alors que
   c'était une panne de validation. La lecture cherche désormais les cinq
   nombres où qu'ils soient, plutôt que de courir après les noms d'enveloppe.
   Même leçon que `CompositionChoiceSchema` : on lit ce que les modèles
   envoient, on ne répare pas ce qu'ils auraient dû envoyer.

Après correction : **20 décisions retenues sur 25 consultations** contre 6 sur
18 avant, sur un monde de 60 ans, les cinq échecs restants étant des HTTP 429
— du quota, pas un défaut.

### La terre est finie

Quatre civilisations qui ne se voient jamais ne font pas une civilisation, elles
font quatre solitudes. Ce qui les met en contact n'est pas un système
diplomatique, c'est une contrainte : **le monde a 80 terres, pas une de plus**.
Tant qu'il en reste, chacune grandit sans rencontrer personne ; le jour où il
n'en reste plus, chaque arpent gagné est un arpent perdu par un voisin, et une
politique étrangère devient nécessaire.

Trois postures, tenues jusqu'à ce qu'un dirigeant en change :

- **TRADE** enrichit, mais seulement si un voisin commerce aussi — on ne
  s'enrichit pas en déclarant sa bonne volonté à qui s'arme contre soi ;
- **GUARD** ne prend rien à personne et rend cher à attaquer ;
- **PRESSURE** prend une terre par la force si les soldats dépassent nettement
  la défense adverse, et coûte des soldats même quand elle réussit — sans quoi
  ce serait la seule posture rationnelle.

La posture appartient à la doctrine et non à côté : comme les parts de travail,
c'est une politique permanente qui tient jusqu'à révision. Une seule posture, et
non une par voisin : W5 existe précisément parce que quatre questions posées
d'un coup reçoivent quatre réponses médiocres.

La même mesure hors ligne, doctrines figées, donne maintenant 116 points pour
500 tours (17,2x) — et **toutes les civilisations s'éteignent à l'an 192**,
étouffées par une terre qu'elles ne peuvent plus prendre. C'est le pire cas
assumé : une civilisation qui n'adapte jamais sa doctrine meurt quand le monde
se referme. Les dirigeants existent pour ça.

À 92 points pour 500 tours, un quota gratuit d'environ 350 appels par jour fait
vivre à peu près **1900 tours de monde par jour**. C'est ce chiffre qui décide
si le projet tient, et il est mesuré, pas supposé.

## La chronique

Le monde n'existait que dans un terminal. La chronique le rend lisible, et elle
le fait d'une façon qui découle directement de W4 : **le lecteur recompose le
monde dans le navigateur avec le moteur qui l'a vécu**. Rien n'est stocké d'un
rendu ; si le graphe et les fiches contredisaient le monde, ce serait le moteur
qui aurait tort, et c'est exactement ce qu'on veut pouvoir constater.

Trois échelles de lecture, parce qu'une civilisation ne se lit pas à une seule :

- **le siècle** — quatre courbes, les mêmes quatre couleurs de faction que la
  grille et la vue 3D. Une divergence ne se voit pas dans un tableau ; une ligne
  qui décroche, si. Une civilisation éteinte cesse d'avoir une ligne plutôt que
  de tomber à zéro et de mentir à plat jusqu'à la fin de l'ère ;
- **l'année** — les fiches des quatre civilisations, les évènements notables, et
  les décisions prises cette année-là avec le modèle qui a répondu et, le cas
  échéant, le retard pris à cause d'un quota ;
- **ce que les dirigeants ont dit** — toutes les explications, de la plus récente
  à la plus ancienne. C'est le vrai récit de l'ère.

Sur un écran étroit, le dessin change de proportions au lieu d'être étiré :
aplatir un siècle de croissance dans 70 pixels rendait les pentes illisibles, et
une échelle non uniforme aurait menti sur elles.

Le module pèse 5,7 Ko compressés et n'est chargé qu'à l'ouverture de l'onglet,
comme la vue 3D : qui ne regarde que des batailles ne télécharge jamais le
moteur de monde.
