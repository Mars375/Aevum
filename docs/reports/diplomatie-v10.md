# Diplomatie suivie (spectator-10) — ce qui est livré, et ce qui reste mince

Lot 4 de `docs/release-spectateur.md`, P1 du backlog : des promesses avec des
obligations vérifiables, jamais une promesse narrative sans état.

La conception est dans `docs/diplomacy-v10-design.md`. Ce rapport dit ce que le
code fait réellement, et ce que les mesures ne prouvent pas.

## Ce qui est livré

|               |                                                                      |
| ------------- | -------------------------------------------------------------------- |
| module moteur | `packages/world/src/agreements.ts`, pur et déterministe              |
| accords       | pacte de non-agression (4, 8 ou 12 manches) et **échange bilatéral** |
| état          | `SpectatorState.agreement`, optionnel, exigé seulement sous v10      |
| contrat IA    | `AGREEMENT_COUNCIL_JSON_SCHEMA` + consigne v10                       |
| observation   | offres avec identifiants, pactes, confiance, options légales         |
| lecteur       | `AgreementsPanel.vue`, **strictement en lecture**                    |
| tests         | 22 sur le module, 7 d'intégration, 7 de contrat, 5 de panneau        |

## Cinq défauts corrigés avant d'écrire une ligne

Le brouillon de conception portait des règles qui ne tenaient pas. Les corriger
d'abord a coûté une relecture ; les découvrir après aurait coûté un lot.

1. **L'échange était un don.** Un seul jeu de stocks, de l'offreur vers le
   receveur. Le lot s'appelle « promesses et **négociations** » : une
   négociation a deux contributions. `give` et `receive`, les deux côtés
   vérifiés avant que rien ne bouge, application atomique.
2. **`accept` était impossible.** La garde refusait « si un pacte **ou une
   offre** existe déjà » — or accepter exige précisément qu'une offre existe.
   Seul un pacte actif bloque.
3. **On répondait à une offre par sa cible et son type.** Mais `propose`
   remplace l'offre pendante de même paire : entre la lecture de l'observation
   et la réponse du modèle, l'offre visée peut avoir été remplacée par une autre
   aux termes différents. On répond désormais par `offerId`.
4. **L'ordre des dépenses n'était pas fixé.** Un échange qui crédite après une
   construction laisse promettre ce qu'on n'a pas ; un échange qui débite après
   laisse partir ce qui est déjà consommé. L'accord se règle **avant** toute
   dépense du tour.
5. **La mort dissolvait « sans blâme »** — et il manquait l'autre moitié. Une
   civilisation éteinte pile à `endRound` aurait encaissé la prime de fidélité
   d'un pacte que plus personne ne tient. `dissolveOnDeath` passe avant
   `tickPacts`, et ne verse rien.

## Un piège qui était déjà armé

`council.ts` composait la provenance d'un conseil local avec
`state.rules.slice(-1)`. Sous « spectator-**10** », cela rend **« 0 »** : un
conseil v10 se serait annoncé **v0**, dans le seul champ qui dit d'où vient une
décision. Corrigé avant tout code v10.

Plus largement, les gardes de version étaient recopiées en clair **92 fois**
dans le dépôt, sous sept formes qui sont toutes le même seuil. En oublier une
ne casse rien bruyamment : elle retire une capacité, en silence, à la nouvelle
version. `SPECTATOR_RULES` et `atLeast(rules, plancher)` le disent une fois ;
53 listes et 14 comparaisons exactes converties, refactor vérifié neutre.

Le lecteur portait le même piège : `["spectator-9"].includes(...)` aurait
**masqué les infrastructures en v10**.

## Mesure : la diplomatie se produit-elle vraiment ?

Un module testé ne prouve pas qu'une campagne en fera usage.
`scripts/agreements-probe.ts` joue six campagnes locales complètes, compte les
événements réels, puis **rejoue chaque campagne** et compare la signature.

|                                   |                                            |
| --------------------------------- | ------------------------------------------ |
| graines                           | 6, jusqu'à 120 manches                     |
| **rejeux vérifiés**               | **6 sur 6** (W4 tient sous v10)            |
| offres émises                     | 99                                         |
| acceptées                         | 86 — dont **60 pactes** et **26 échanges** |
| refusées                          | 10                                         |
| pactes menés à terme              | 27                                         |
| **accords refusés par le moteur** | **0**                                      |

Premier relevé, avant correction : **84 offres, 84 acceptées, 0 refus, 0
échange**. La politique locale ne proposait jamais d'échange, si bien que le
chemin bilatéral — celui qui déplace des ressources dans les deux sens —
n'était exercé que par des tests unitaires. Elle commerce désormais une fois
ses pactes signés.

Le premier rapport annonçait aussi « 6 accords refusés ». C'était faux : la
sonde comptait **tous** les rejets du tour, pas ceux des accords. Deux compteurs
désormais, et le vrai chiffre est zéro.

## Ce que ces mesures ne prouvent pas

- **Aucune rupture, aucune dissolution, aucune expiration observée.** Les trois
  chemins existent et sont bornés par des tests, mais ne se sont pas produits
  en campagne : la politique locale ne déclare pas la guerre à un partenaire de
  pacte, et accepte assez vite pour qu'aucune offre n'atteigne son expiration.
  La confiance n'est donc jamais descendue.
- **Aucun contrôle visuel.** Le panneau est testé par rendu, pas regardé — le
  navigateur n'est pas disponible sur ce poste.

## Un dirigeant distant sait-il répondre à une offre ?

La question concrète que le design posait : un modèle va-t-il **recopier**
l'identifiant qu'on lui annonce, ou en fabriquer un ? Un identifiant inventé est
refusé, et c'est voulu — mais si aucun modèle ne sait en copier un, le choix de
`offerId` serait joli et inutilisable.

`scripts/v10-remote-probe.ts` chauffe localement jusqu'au premier tour où
l'acteur a une offre à traiter, puis fait **un seul** appel par graine.

|                                         |                               |
| --------------------------------------- | ----------------------------- |
| conseils demandés                       | 3 (graines 42, 7, 1)          |
| servis par le modèle lui-même           | 2 sur 3                       |
| ayant répondu à l'offre                 | 2 sur 2 des réponses obtenues |
| **ayant recopié l'identifiant annoncé** | **2 sur 2**                   |
| ordres rejetés                          | **0**                         |

Les deux réponses sont exactement conformes : `accept` avec l'identifiant exact,
tous les autres champs à `null` — la forme plate et nullable tient. La troisième
graine a expiré côté transport (« Délai de réponse IA dépassé ») et est
rapportée `unavailable`, jamais remplacée en silence par un dirigeant local.

Ce que cela ne prouve pas : trois appels ne font pas un taux, la leçon de la v9
reste valable, et **aucune campagne distante longue sous v10 n'a été jouée**.
Le chemin `propose` avec deux contributions n'a pas encore été emprunté par un
modèle — seul `accept` l'a été.
