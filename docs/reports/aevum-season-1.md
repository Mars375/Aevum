# Aevum Season 1 — première ère reproductible

Statut : artefact hors ligne reproductible, non classable comme course de modèles.

Cette ère est rejouable depuis son [journal](/worlds/aevum-season-1/era-0001.json); ses [métriques](/worlds/aevum-season-1/era-0001.learning.json) sont calculées hors ligne par le paquet pur `@abs/metrics`.

## Protocole

| Champ | Valeur |
| --- | --- |
| Version du monde | `w8` |
| Version métrique | `aevum-learning-curve-v1` |
| Graine | `99` |
| Ère | 1 |
| Années vécues | 120 |
| Fingerprint | `fdc76c0b` |
| Exécution | `scripted/no remote model` |
| Empreinte de fixture | `sha256:eee64718a1fffc895a36b78c287f8aac88389566879c6e9e50560757c6b76359` |
| Appels de modèles distants | 0 |

## Résumé de service

| Mesure | Valeur |
| --- | ---: |
| Décisions enregistrées | 67 |
| Preuves de service connues | 0 |
| Preuves de service inconnues | 67 |
| Servies par le modèle demandé | 0 |
| Servies par repli | 0 |
| Décisions différées | 0 |
| Décisions avec nouvel essai | 0 |
| Taux de service propre | inconnu |
| Taux de repli | inconnu |

> Le service inconnu reste inconnu : il n'est ni compté comme un succès, ni transformé en zéro.

## Tournants

- An 32, **FIRST_WAR** : Première conquête du monde : Ithilin prise a amber, par azure. (source `world-event-v1:32:azure:11:SEIZED:Ithilin%20prise%20a%20amber`)
- An 50, **CAPITAL** : amber perd son siège — Velvale, notre siege, est tombee : 16 morts et les coffres pilles (source `world-event-v1:50:amber:8:CAPITAL_LOST:Velvale%2C%20notre%20siege%2C%20est%20tombee%20%3A%2016%20morts%20et%20les%20coffres%20pilles`)
- An 57, **CAPITAL** : amber perd son siège — Rhopor-la-Forêt, notre siege, est tombee : 14 morts et les coffres pilles (source `world-event-v1:57:amber:8:CAPITAL_LOST:Rhopor-la-For%C3%AAt%2C%20notre%20siege%2C%20est%20tombee%20%3A%2014%20morts%20et%20les%20coffres%20pilles`)
- An 68, **CAPITAL** : amber perd son siège — Selgan, notre siege, est tombee : 12 morts et les coffres pilles (source `world-event-v1:68:amber:12:CAPITAL_LOST:Selgan%2C%20notre%20siege%2C%20est%20tombee%20%3A%2012%20morts%20et%20les%20coffres%20pilles`)
- An 73, **CAPITAL** : amber perd son siège — Rhowick, notre siege, est tombee : 4 morts et les coffres pilles (source `world-event-v1:73:amber:9:CAPITAL_LOST:Rhowick%2C%20notre%20siege%2C%20est%20tombee%20%3A%204%20morts%20et%20les%20coffres%20pilles`)
- An 81, **EXTINCTION** : amber s'éteint. (source `world-event-v1:81:amber:1:COLLAPSED:la%20civilisation%20s'est%20%C3%A9teinte`)
- An 115, **EXTINCTION** : azure s'éteint. (source `world-event-v1:115:azure:2:COLLAPSED:la%20civilisation%20s'est%20%C3%A9teinte`)
- An 118, **LEAD** : crimson passe devant azure et mène le monde.
- An 120, **EXTINCTION** : verdant s'éteint. (source `world-event-v1:120:verdant:4:COLLAPSED:la%20civilisation%20s'est%20%C3%A9teinte`)

## États historiques

| Civilisation | Nom | État | Empreinte doctrinale |
| --- | --- | --- | --- |
| crimson | Crimson | survit | `doctrine-v1-f2b08f6f` |
| azure | Azure | tombe en l'an 115 | `doctrine-v1-41fce89e` |
| verdant | Verdant | tombe en l'an 120 | `doctrine-v1-41fce89e` |
| amber | Amber | tombe en l'an 81 | `doctrine-v1-5592542c` |

## Limites connues

- Une seule trajectoire ne permet aucun classement de modèles.
- Décisions scriptées localement; aucun modèle distant n'a été consulté.
- L'attribution observed-after établit un ordre temporel, pas une causalité.
- Les métriques décrivent un comportement observable, pas une modification des poids.
- Le résumé de service porte sur les décisions persistées, pas sur les appels définitivement échoués qui ne figurent pas au journal.
