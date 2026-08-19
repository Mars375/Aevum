# Monde continu — w1

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
| + saisons déterministes | 2000 | **92** | **21,7x** |

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

À 92 points pour 500 tours, un quota gratuit d'environ 350 appels par jour fait
vivre à peu près **1900 tours de monde par jour**. C'est ce chiffre qui décide
si le projet tient, et il est mesuré, pas supposé.
