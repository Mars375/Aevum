# La campagne distante longue — pourquoi elle n'a pas lieu

C'est la limite que ce dépôt traîne depuis le début, recopiée dans chaque
rapport : « une campagne distante longue n'est pas acquise ». Elle n'avait
jamais été mesurée — toutes les preuves distantes tenaient en un appel, ou en
une poignée, chacune dans son propre processus.

Elle l'est maintenant. Le résultat est négatif, et il est précis.

> **Mise à jour du 23 septembre — ce rapport se trompait sur la cause.**
> La campagne longue a eu lieu : 39 tours consécutifs avec un autre modèle
> gratuit de Nous, rejeu vérifié. L'« allocation de compte » donnée plus bas
> comme meilleure explication est **réfutée** : sur le même compte, le même
> jour, `longcat` bloque encore au même conseil. La cause est établie — sur
> certaines requêtes, `longcat` raisonne jusqu'à son plafond de 6 000 jetons
> et ne répond jamais, quels que soient les réglages de raisonnement envoyés.
> Et l'hypothèse « le modèle ? non » était écartée à tort. Tout est dans
> `docs/reports/fournisseurs.md` ; le texte ci-dessous est conservé tel qu'il
> a été écrit, parce qu'une erreur effacée n'apprend rien.

## Ce qui a été joué

`scripts/remote-campaign-probe.ts` joue des tours **consécutifs**, un conseil
distant par tour, écrit l'archive à chaque tour, puis **rejoue la campagne** et
compare la signature. Quatre exécutions conservées :

| exécution                    | cadence | tours joués | conseils | ordres rejetés | rejeu   |
| ---------------------------- | ------- | ----------- | -------- | -------------- | ------- |
| `remote-campaign.json`       | 0 s     | 2           | 4        | 0              | vérifié |
| `remote-campaign-paced.json` | 15 s    | 2           | 4        | 0              | vérifié |
| `remote-campaign-slow.json`  | 60 s    | 2           | 4        | 0              | vérifié |
| `remote-campaign-diag.json`  | 0 s     | **4**       | 4        | 0              | vérifié |

**10 tours distants joués au total, 10 servis par le modèle lui-même, zéro ordre
rejeté, quatre rejeux vérifiés sur quatre.**

## Le contrat n'est pas le problème

Sur chaque tour réellement joué, le modèle a rendu une décision que le moteur a
acceptée **sans un seul rejet** — ordres d'unités, construction, recherche,
modernisation, infrastructure et accords compris. Le travail de contrat fait en
v9 et v10 tient donc en conditions réelles.

Et chaque campagne interrompue **se rejoue à l'identique** : W4 vaut aussi pour
une campagne distante partielle.

## Ce qui arrête la campagne, et ce que ce n'est pas

À l'exception d'une exécution qui est allée à quatre tours, toutes s'arrêtent au
**troisième conseil consécutif**, sur un délai dépassé. La sonde s'arrête alors
plutôt que de faire jouer un dirigeant local : une campagne où le moteur
remplace le modèle n'est pas une campagne distante.

Quatre hypothèses testées, quatre écartées :

- **Le modèle ?** Non. Les quatre dirigeants partagent le même
  (`defaultCouncilModels` rend le même identifiant pour tous), et les deux
  premiers conseils réussissent en 8 à 12 secondes. _[23 septembre : ce
  raisonnement ne prouvait rien. Partager un modèle ne l'innocente pas ; en
  essayer un autre, si — et c'était bien le modèle.]_
- **La taille de la demande ?** Non. Observations mesurées au tour concerné :
  amber 24 171, azure 24 224, crimson 23 422, verdant 23 407 caractères. Celle
  qui échoue est **la plus petite**.
- **Une limite de débit ?** Non. Espacer les appels de 15 s puis de 60 s ne
  change rien : l'arrêt tombe au même tour. Une reprise du même modèle deux
  secondes plus tard ne récupère pas davantage.
- **Le catalogue des modèles ?** Non. Six requêtes consécutives au catalogue
  dans un même processus : six réponses 200, entre 204 et 488 ms.

Reste le point d'inférence lui-même. L'erreur le dit désormais :
**`Délai dépassé sur la complétion Nous`**.

### Une cinquième hypothèse, écartée par sa propre expérience

Les quatre premières exécutions donnaient toutes « deux appels réussis, puis
l'arrêt », ce qui suggérait une limite **par processus**. Si c'était le cas,
reprendre la campagne dans un processus neuf devait la faire avancer deux tours
de plus à chaque fois.

La reprise a donc été implémentée (`--resume` : relecture de l'archive, rejeu
pour retrouver l'état, poursuite) et essayée trois fois de suite. Résultat :

| processus | tours repris | tours ajoutés                  |
| --------- | ------------ | ------------------------------ |
| 1         | 0            | 2                              |
| 2         | 2            | **0** — échec au premier appel |
| 3         | 2            | **0** — échec au premier appel |

**L'hypothèse est fausse.** Un processus neuf qui reprend n'obtient pas ses deux
appels : il échoue dès le premier. Le même conseil a par ailleurs réussi une
fois en troisième position. L'échec ne suit donc ni le rang de l'appel dans le
processus, ni la civilisation, ni le contenu de la demande — l'observation
bloquée mesure 23 301 caractères, la deuxième plus petite des quatre, sans
mémoire accumulée.

Ce qui reste compatible avec tout cela : une **allocation de compte sur une
fenêtre de temps**, que le fournisseur épuise en cessant de répondre plutôt
qu'en refusant. Cette session avait déjà consommé plusieurs dizaines d'appels.
Cette explication n'est pas établie : la vérifier demande d'attendre des heures
et de dépenser davantage, ce qui n'a pas été fait.

La reprise est conservée malgré tout. Elle est correcte, elle vérifie par rejeu
ce qu'elle reprend, et c'est la bonne architecture pour une campagne longue dès
que les appels sont disponibles. Elle ne contourne simplement pas cette
limite-ci.

## Deux défauts corrigés en chemin

- **L'erreur ne nommait pas l'appel fautif.** « Délai de réponse IA dépassé »
  couvrait indifféremment le catalogue et la complétion, ce qui rendait le
  diagnostic impossible sans instrumenter. Les deux sont maintenant distingués,
  et le message remonte jusqu'au rapport.
- **Un corps de réponse n'était jamais lu quand le statut était en erreur.**
  Sous `undici`, un corps non consommé garde sa connexion hors du pool : quelques
  refus suffisent à faire expirer toutes les requêtes suivantes. Le défaut était
  latent — les réponses observées étaient des 200 — mais il se serait déclenché
  au premier 429. Les corps sont désormais annulés explicitement.

Une exécution après cette correction a atteint quatre tours au lieu de deux.
**Une exécution ne prouve rien** : la suivante s'est arrêtée au troisième. Le
gain n'est pas établi, et le dire autrement serait attribuer à un correctif un
résultat qui tient peut-être au hasard.

## Ce que cela change pour le dépôt

`CLAUDE.md` affirme : « Le palier gratuit est un budget d'appels, pas une limite
de débit — mesuré deux fois. » **Cette mesure-ci le contredit** pour ce
fournisseur et ce modèle aujourd'hui : le catalogue, lui, répond toujours, donc
ce n'est pas l'accès au compte qui est coupé — mais l'inférence cesse de
répondre après quelques appels, et ni attendre une minute ni repartir d'un
processus neuf n'y change quoi que ce soit.

Ce n'est donc ni un budget au sens où la page l'entend, ni un débit au sens
habituel. C'est une indisponibilité du point d'inférence dont **la règle exacte
n'est pas établie**, et il vaut mieux l'écrire ainsi que de lui prêter une
explication qui tiendrait jusqu'à la prochaine mesure.

## Ce qui reste à faire

Une campagne distante longue demande de traiter cette indisponibilité, pas le
contrat — et la reprise entre processus, pourtant implémentée et vérifiée par
rejeu, ne suffit pas. Deux pistes restent : reprendre la campagne après une
attente bien plus longue qu'une minute, en s'appuyant sur le `--resume` qui
existe désormais ; ou changer de fournisseur.

Tant que ce n'est pas fait, **la qualité d'une campagne distante longue reste
non mesurée**, et aucun rapport ne doit prétendre le contraire.
