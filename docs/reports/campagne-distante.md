# La campagne distante longue — pourquoi elle n'a pas lieu

C'est la limite que ce dépôt traîne depuis le début, recopiée dans chaque
rapport : « une campagne distante longue n'est pas acquise ». Elle n'avait
jamais été mesurée — toutes les preuves distantes tenaient en un appel, ou en
une poignée, chacune dans son propre processus.

Elle l'est maintenant. Le résultat est négatif, et il est précis.

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

Quatre hypothèses testées, trois écartées :

- **Le modèle ?** Non. Les quatre dirigeants partagent le même
  (`defaultCouncilModels` rend le même identifiant pour tous), et les deux
  premiers conseils réussissent en 8 à 12 secondes.
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
fournisseur et ce modèle aujourd'hui : le budget n'est pas en cause — le
catalogue répond, et des processus successifs obtiennent chacun leurs deux
premières complétions — mais l'inférence cesse de répondre après deux appels
dans un même processus, et attendre une minute n'y change rien.

Ce n'est donc ni un budget, ni un débit au sens habituel. C'est une
indisponibilité du point d'inférence dont la règle exacte n'est pas établie.

## Ce qui reste à faire

Une campagne distante longue demande de traiter cette indisponibilité, pas le
contrat. Trois pistes, par coût croissant : un nouvel essai espacé bien plus
longtemps qu'une minute ; une file qui reprend la campagne là où elle s'est
arrêtée entre deux processus — l'archive est déjà écrite à chaque tour, donc la
reprise ne demande que de la relire ; ou un autre fournisseur.

Tant que ce n'est pas fait, **la qualité d'une campagne distante longue reste
non mesurée**, et aucun rapport ne doit prétendre le contraire.
