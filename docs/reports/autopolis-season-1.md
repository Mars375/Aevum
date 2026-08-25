# Autopolis — première observation reproductible

Statut : **pilote hors ligne**, généré par scripted-autopolis-v1 · ruleset **autopolis-v1** · métriques **metrics-v1** · 8 seeds appariées · horizon 36 ans

Cette chronique est un épisode d'observation, pas une simulation distante. Aucun fournisseur ni API réelle n'a été appelé. La partie publiée est la graine **42**, avec quatre civilisations et une civilisation volontairement fragile pour vérifier que l'histoire conserve aussi un état éteint.

## A. Manifest

- runId : `autopolis-season-1/seed-0042/rotation-2/condition-scripted-inherit`
- graine publiée : **42**
- seeds du pilote : 7, 19, 42, 73, 101, 137, 211, 313
- condition : `scripted-inherit` (scripted + transmission d'artefacts)
- provider : `scripted` / `scripted-autopolis-v1`
- horizon : **36**
- artefact canonique : `worlds/autopolis/season-1/era-0001.json`
- journal de décision : `journal` dans l'artefact ; snapshots et événements sont conservés dans le même fichier

## B. Contrôles de validité

- runs attendus / valides : **8 / 8**
- rejeu final : **replay_pass_with_event_trace_unavailable**
- fingerprint direct : `dc35b5f1b52ddb6d0a5033c2481237ff7d4b46154dfd746d0a3ef2477a1bae54`
- fingerprint rejeu : `dc35b5f1b52ddb6d0a5033c2481237ff7d4b46154dfd746d0a3ef2477a1bae54`
- divergences par tick : **0**
- ruling IDs réconciliés : **oui**
- appels provider pendant le rejeu : **0**
- trace d'événements : **event_trace_unavailable_from_canonical_journal** — le journal canonique Autopolis ne porte pas encore tout le flux moteur ; aucune égalité d'événements n'est revendiquée.

## C. Service et équité d'accès

Le pilote utilise un provider scripté identique pour tous les slots. Le résultat est donc un contrôle de plomberie et d'équité d'accès, pas une comparaison de qualité entre modèles.

| Civilisation | Points demandés | Servis | Taux servi |
| --- | ---: | ---: | ---: |
| crimson | 72 | 72 | 100.0 % |
| azure | 72 | 72 | 100.0 % |
| verdant | 72 | 72 | 100.0 % |
| amber | 8 | 8 | 100.0 % |

- total asked / served : **224 / 224**
- taux global : **100.0 %**
- écart absolu entre civilisations : **0.000**
- indice de Jain des taux servis : **1.000**
- fallbacks : **0** · décisions différées : **0** · propositions rejetées : **0**

## D. Résultats par seed

`seed_metrics.csv` est reproduit dans l'artefact sous `pilotSeedMetrics`.

```csv
seed,horizon,alive,collapsed,asked,served,service_rate,deferred,replay
"7","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"19","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"42","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"73","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"101","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"137","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"211","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
"313","36","3","1","28","28","1.000","0","replay_pass_with_event_trace_unavailable"
```

## E. Métriques metrics-v1

- **M1 diversité des doctrines** : le run publié termine avec 3 vecteurs de politique légaux distincts parmi les civilisations vivantes et 4 artefacts de doctrine dans l'état final. Ce chiffre est descriptif ; le pilote n'a pas d'ablation frozen.
- **M2 stabilité des identités** : 3 successions observées dans le run publié ; rétention d'artefact parent chez les successeurs : 33.3 %.
- **M3 variété des décisions** : entropie Shannon des types servis dans le run publié : 1.583 bits, avec 28 décisions servies.
- **M4 adaptation aux événements** : 40 événements moteurs notables et taux de réponse dans W=5 : 12.5 %. Cette association temporelle n'est pas une preuve de causalité.
- **M5 résultats par seed** : le pilote conserve la survie et l'extinction par graine ; l'état publié final est : amber: éteinte · azure: 40 habitants, 2 terres, 0 progrès · crimson: 38 habitants, 2 terres, 0 progrès · verdant: 40 habitants, 2 terres, 0 progrès.
- **M6 service** : 224 points demandés, 224 réponses scriptées, taux global 100.0 %.
- **M7 quota** : aucune décision différée dans ce pilote ; cette métrique n'est pas testée sous charge réelle.
- **M8 fidélité** : tous les runs valides ont un fingerprint final égal et zéro appel provider au rejeu ; statut prudent : **replay pass avec trace d'événements indisponible depuis le journal canonique**.

## F. Chronologie de l'épisode publié

Les lignes suivantes sont lues dans le journal et les événements du run 42. Elles ne sont pas une narration de modèle.

- **an 1** · amber · **FAMINE** — 1 habitants morts de faim [autopolis-v1:1:amber:famine]
- **an 1** · amber · **COLLAPSE** — la civilisation s'est eteinte [autopolis-v1:1:amber:collapse]
- **an 1** · azure · **EXPANSION** — expansion vers une terre plain [autopolis-v1:1:azure:expansion]
- **an 1** · crimson · **EXPANSION** — expansion vers une terre plain [autopolis-v1:1:crimson:expansion]
- **an 1** · verdant · **EXPANSION** — expansion vers une terre plain [autopolis-v1:1:verdant:expansion]
- **an 1** · amber · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-d72bbeab]
- **an 2** · azure · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-88e7b794]
- **an 3** · crimson · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-a56ce7e1]
- **an 4** · verdant · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-012ff878]
- **an 5** · azure · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-913aaf5f]
- **an 6** · crimson · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-c9edba38]
- **an 7** · verdant · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-f3f33723]
- **an 9** · azure · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-e8768fc8]
- **an 10** · crimson · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-1fbf6353]
- **an 11** · verdant · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-b1085c20]
- **an 11** · azure · **CULTURE_TRANSMITTED** — artefact doctrine-be6aa75d transmis [autopolis-v1:11:azure:inheritance]
- **an 11** · azure · **SUCCESSION** — azure-leader-1 devient azure-leader-2 [autopolis-v1:11:azure:succession]
- **an 11** · crimson · **CULTURE_TRANSMITTED** — artefact doctrine-crimson-founding transmis [autopolis-v1:11:crimson:inheritance]
- **an 11** · crimson · **SUCCESSION** — crimson-leader-1 devient crimson-leader-2 [autopolis-v1:11:crimson:succession]
- **an 11** · verdant · **CULTURE_TRANSMITTED** — artefact doctrine-verdant-founding transmis [autopolis-v1:11:verdant:inheritance]
- **an 11** · verdant · **SUCCESSION** — verdant-leader-1 devient verdant-leader-2 [autopolis-v1:11:verdant:succession]
- **an 13** · azure · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-68fd29f9]
- **an 14** · crimson · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-b57db1e2]
- **an 15** · verdant · **RULING_ACCEPTED** — stocks, population et territoire restent souverains au moteur [ruling-728955d5]

## G. Ce qui est observé, et ce qui ne l'est pas

### Faits confirmés par le moteur et le rejeu

- La graine, le ruleset, les propositions acceptées, les successions, les états et les fingerprints sont conservés.
- Les civilisations non éteintes progressent selon la boucle pure ; la civilisation fragile peut s'éteindre et reste présente dans l'historique.
- Les artefacts doctrinaux acceptés sont transmis lors des successions journalisées.

### Limites d'interprétation

- **Pas de modèle distant** : aucune conclusion sur un LLM, sa qualité ou son apprentissage.
- **Pas de preuve d'émergence** : une seule condition scriptée, sans ablation `engine-only` / `frozen` appariée ; le statut maximal est descriptif, jamais `emergent_supported`.
- **Pas de qualité déduite du service** : le taux de service mesure l'accès au provider, pas la qualité d'une décision. Ici il est artificiellement égal à 100 %.
- **Pas de causalité narrative** : une décision suivie d'un événement est seulement `observed-after` tant qu'une ablation ne sépare pas le moteur, la proposition et la transmission.
- **Trace événementielle incomplète dans le journal canonique** : M8 ne revendique pas une égalité complète du flux d'événements.
- **Puissance limitée** : huit seeds de pilote ne suffisent pas pour une conclusion comparative ; les résultats par seed sont la source, pas une moyenne autorisant un classement.

## H. Fichiers de preuve

- épisode publié : `worlds/autopolis/season-1/era-0001.json`
- runs du pilote : `worlds/autopolis/season-1/pilot/seed-*.json`
- journal, snapshots, décisions, événements et rejeu : dans chaque run autonome
- report metrics-v1 : ce fichier

La chronique ne présente donc que ce que le rejeu confirme.
