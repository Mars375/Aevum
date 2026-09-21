# Spectator-10 — Diplomatie suivie : accords bilatéraux (conception validée)

Statut : **conception prête à coder, aucun code écrit.** Date : 2026-09-21.

Ce document reprend le brouillon rédigé le même jour et corrige les points que
la passation demandait de revoir. Le brouillon tenait sur l'essentiel — état
additif, offres bornées, ids déterministes, rejeu préservé — et ce qui suit ne
le réécrit pas : il tranche les endroits où il se contredisait ou restait muet.
**Chaque correction porte le défaut qui l'a demandée**, pour qu'on ne la défasse
pas par mégarde.

## 1. Objet et périmètre

- Lot 4 de `release-spectateur.md`, P1 du backlog : des promesses avec des
  obligations vérifiables, jamais une promesse narrative sans état.
- Deux accords : **pacte de non-agression** bilatéral (4, 8 ou 12 manches) et
  **échange de stocks**, désormais réellement bilatéral (§3).
- Règles `spectator-10`, strictement **additives** : tout nouvel état est
  optionnel et absent des campagnes v1 à v9, dont le rejeu et la signature ne
  bougent pas.
- La diplomatie héritée (`peace`/`trade`/`war`, `diplomacy[]`) reste inchangée.
- **Spectateur uniquement.** Aucun bouton ne permet au lecteur de gouverner ;
  l'interface montre ce que les dirigeants ont décidé, elle ne décide pas.

## 2. Ce que le brouillon disait, et ce qui change

| Point                       | Brouillon                                                  | Correction                                                                                 |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Échange                     | un seul jeu de stocks, de l'offreur vers le receveur       | **deux contributions**, `give` et `receive`, solvabilité des deux côtés                    |
| `accept`                    | refusé « si un pacte **ou une offre** existe déjà »        | contradiction : accepter **exige** une offre. Seul un **pacte actif** bloque               |
| Cible de `accept`/`decline` | `target` + `kind`                                          | **`offerId` exact** : une offre remplacée ne doit pas être acceptée à la place d'une autre |
| Ordre de paiement           | non dit                                                    | **l'accord se règle avant toute dépense du tour** (§6)                                     |
| Mort pendant un pacte       | « dissous sans blâme »                                     | et **sans prime** : ni pénalité ni bonus de fidélité (§5)                                  |
| `agreement` malformé        | coule la réponse                                           | **conservé, et c'est volontaire** (§4)                                                     |
| Versions                    | « `stateSignature` couvre v10 sans toucher `campaign.ts` » | **faux** : les énumérations doivent être étendues, et un piège était déjà armé (§9)        |

## 3. Commande d'accord — une par tour personnel

Champ de premier niveau `agreement` sur `CouncilDecision`, plat et à champs
nuls, parce qu'un modèle rend plus fiablement une forme plate qu'imbriquée :

```
agreement: {
  action:   "propose" | "accept" | "decline" | "renounce" | null,
  offerId:  string | null,          // accept / decline : l'offre visée, exactement
  target:   FactionId | null,       // propose / renounce
  kind:     "nonaggression" | "transfer" | null,
  duration: 4 | 8 | 12 | null,      // non-agression
  give:     { food, timber, ore, wealth } | null,   // ce que l'auteur donne
  receive:  { food, timber, ore, wealth } | null    // ce qu'il demande
} | null
```

**Pourquoi `give` et `receive`.** Le brouillon ne portait qu'un jeu de stocks :
l'offreur donnait, le receveur encaissait. C'est un don, pas une négociation, et
le lot s'appelle « promesses et **négociations** ». Un échange a deux
contributions, et l'une d'elles peut être vide — un don reste exprimable comme
`receive` à zéro, sans cas particulier dans le code.

- `propose` : `target` + `kind`. Non-agression : `duration` requise. Transfert :
  au moins un entier > 0 dans `give` **ou** dans `receive`.
- `accept` / `decline` : **`offerId` seul**. Le brouillon désignait l'offre par
  cible + type ; or `propose` remplace l'offre pendante de même paire et de même
  type. Entre la lecture de l'observation et la réponse du modèle, l'offre visée
  peut donc avoir été remplacée par une autre aux termes différents, et
  l'acceptation aurait porté sur un contrat que personne n'a lu. L'identifiant
  supprime l'ambiguïté : un id inconnu est un refus explicite, pas un
  rapprochement approximatif.
- `renounce` : `target` + `kind: "nonaggression"` sur un pacte actif.
- Champ inutilisé : `null`. Le schéma n'exige aucun champ absent.

## 4. Un accord malformé coule la réponse — et c'est voulu

La tolérance ajoutée sur `plan` ne s'étend pas à `agreement`, et il faut dire
pourquoi, sinon quelqu'un « harmonisera » les deux un jour.

Un `plan` est une **annotation stratégique** : le retirer laisse les ordres
intacts et ne change rien au monde. Un `agreement` est un **engagement** qui
déplace des ressources et lie deux civilisations pour plusieurs manches.
Accepter silencieusement une version dégradée d'un engagement reviendrait à
décider à la place du dirigeant. La règle du dépôt — un ordre illégal est
rejeté et enregistré, jamais réécrit — s'applique ici sans exception.

La forme plate et nullable rend cet échec rare ; elle ne le pardonne pas.

## 5. Sémantique

- **propose** — crée ou remplace l'offre pendante de l'acteur vers la même cible
  et du même type. Non contraignante, **aucun escrow** : rien n'est gelé.
  `expiresRound = round + 3`. L'expiration nettoie et consigne.
- **accept (transfert)** — revalide **les deux** contributions contre les stocks
  réels des deux civilisations au moment de l'acceptation, puis applique la
  double mutation **atomiquement**. Si l'un des deux côtés est insolvable :
  rejet nommé, **aucun effet**, l'offre reste pendante jusqu'à son expiration.
  Jamais de transfert partiel, jamais d'exécution double ; l'offre acceptée est
  consommée.
- **accept (non-agression)** — refusé si la paire est **en guerre**, ou si un
  **pacte est déjà actif** entre elles. Le brouillon refusait aussi « si une
  offre existe déjà », ce qui rendait toute acceptation impossible : accepter
  exige précisément qu'une offre existe. Ne touche jamais `truceUntil` : une
  trêve du moteur ne se contourne pas par un pacte.
- **decline** — retire l'offre visée, consigne le refus.
- **renounce** — rompt un pacte actif ; **la confiance que le partenaire porte à
  l'auteur baisse** ; entrée d'historique de rupture.
- **Durée accomplie** — `round >= endRound` : pacte clôturé, confiance en hausse
  **des deux côtés**, événement `PACT_FULFILLED`.
- **Mort** — offres et pactes du défunt dissous **sans blâme et sans prime**.
  Le brouillon disait « sans blâme » ; il manquait l'autre moitié. Sans elle,
  une civilisation qui s'éteint pile à `endRound` aurait pu encaisser un bonus
  de fidélité pour un pacte que personne ne tient plus. L'ordre de §6 tranche le
  cas : la dissolution passe **avant** l'accomplissement.
- **Guerre** — une déclaration **valide** pendant un pacte le rompt et baisse la
  confiance du partenaire. Une déclaration **rejetée par les règles** (trêve en
  cours) n'est **jamais** une trahison : le moteur a refusé, le dirigeant n'a
  rien rompu.

## 6. Ordre d'exécution dans `resolveCouncil`

Le brouillon plaçait l'accord avant la diplomatie héritée mais ne disait rien de
sa place vis-à-vis des dépenses. C'est le trou qui permet de dépenser deux fois
la même réserve : un échange qui crédite après une construction laisse le
dirigeant engager des ressources qu'il n'a pas encore, et un échange qui débite
après laisse partir des ressources déjà consommées.

**L'accord se règle avant toute dépense du tour.** L'ordre devient :

1. `rules === "spectator-10"` → `state.agreement ??= emptyAgreement()` ;
   `sequential` étendu à v10.
2. `expireOffers(round)`.
3. **`agreement` de l'acteur** — l'échange se règle ici, sur des stocks encore
   intacts.
4. Modernisation, puis infrastructures, puis constructions, puis recrutement —
   ordre existant, inchangé.
5. Bloc diplomatie hérité `peace`/`trade`/`war`, inchangé : une guerre déclarée
   le même tour rompt donc un pacte conclu le même tour, ce qui est fidèle.
6. `dissolveOnDeath`, **puis** `tickPacts` — dans cet ordre, pour qu'un pacte
   dissous par un décès ne soit pas ensuite compté comme accompli.
7. Événements via `say`.

## 7. Contrat exporté — `packages/world/src/agreements.ts`

Un seul module, sans dépendance sur le spectateur, sur le modèle de
`infrastructure.ts` :

- Schémas : `AgreementCommandSchema`, `AgreementOfferSchema`,
  `AgreementPactSchema`, `AgreementHistoryEntrySchema`, `AgreementStateSchema`.
- Helpers purs : `expireOffers`, `applyAgreement` → `{ state, events, rejected }`,
  `tickPacts`, `dissolveOnDeath`, `trustOf`, `agreementView`, `agreementId`.
- **Un état absent est une faute, pas un cas à rattraper.** Comme
  `records(ctx)` en v9 : un helper qui improviserait son propre état
  l'écrirait dans l'objet de contexte du caller et perdrait en silence ce qu'il
  vient d'appliquer. On lève.

État, bornes inchangées par rapport au brouillon : `offers` ≤ 12, un pacte par
paire, `history` ≤ 40 entrées (l'interface dit « récents » dès que plafonné),
`trust` borné à [-100, 100], ids déterministes
`agreement-v1:<round>:<from>:<to>:<kind>:<seq>`.

## 8. Observation et politique locale

- `agreementView(state, civ)` : offres reçues et émises, pactes actifs avec
  manches restantes, **confiance de l'acteur vers chaque civilisation**,
  historique récent. Chaque offre porte son `offerId`, puisque c'est par lui
  qu'on répond.
- `options.agreements` : pour chaque civilisation vivante, les types légaux et
  la confiance, afin que la politique locale puisse s'en servir.
- **Jamais de stocks ni de plans rivaux.** Une offre dit ce qu'elle demande, pas
  ce que l'autre possède : un dirigeant apprend la solvabilité de son partenaire
  en essuyant un refus, pas en lisant ses coffres.

## 9. Versions : ce qu'il faut réellement étendre

Le brouillon écrivait que `stateSignature` couvrait v10 « sans toucher
`campaign.ts` ». C'est faux, et le vérifier coûte une minute : `CampaignSchema`
porte une énumération littérale des versions, et `SpectatorStateSchema.rules`
aussi. Sans extension, une campagne v10 ne se parse pas — donc ne se rejoue pas.

À étendre : l'énumération de `CampaignSchema`, celle de `SpectatorStateSchema`,
et **toutes** les listes `["spectator-4", …]` qui pilotent séquentialité, âges,
modernisation, profils militaires et infrastructures. Elles sont nombreuses et
se ressemblent ; en oublier une ne casse rien bruyamment, elle retire seulement
une capacité à v10.

**Le piège des deux chiffres était déjà armé, et il est désarmé.**
`council.ts` composait la provenance d'un conseil local avec
`state.rules.slice(-1)` : « spectator-10 » aurait donné « 0 », et un conseil v10
se serait annoncé v0 — un mensonge dans le seul champ qui dit d'où vient une
décision. Corrigé avant ce lot (`rulesNumber`), avec ses tests.

## 10. Invariants à tester (`packages/world/test/agreements.test.ts`)

1. Expiration à `round + 3`, consignée, jamais exécutée.
2. **Atomicité bilatérale** : insolvabilité d'un côté **ou** de l'autre → rejet
   nommé, ni débit ni crédit nulle part, offre conservée.
3. `accept` par `offerId` : un id inconnu ou périmé est refusé ; une offre
   remplacée ne peut pas être acceptée à la place de celle qui l'a remplacée.
4. `propose` remplace l'offre de même paire et type ; plafond 12 respecté.
5. Non-agression refusé en guerre et sur pacte actif ; **accepté quand une offre
   existe** — le cas que le brouillon rendait impossible.
6. `truceUntil` jamais contourné ; durées 4/8/12 honorées.
7. `renounce` → rupture, baisse de confiance, entrée d'historique.
8. Guerre valide pendant pacte → rupture et baisse ; guerre rejetée par trêve →
   **aucune** rupture, aucune variation de confiance.
9. Durée accomplie → confiance en hausse des deux côtés, pacte clôturé.
10. Mort → dissolution **sans blâme ni prime**, y compris à `endRound` exact.
11. **Budget partagé** : un échange puis une modernisation, une construction et
    un recrutement le même tour ne peuvent pas dépenser deux fois la même
    réserve ; un stock ne passe jamais en négatif (W6).
12. Déterminisme : ids stables, rejeu v10 de signature identique.
13. Observation : confiance et offres personnelles, `offerId` présent, aucun
    stock ni plan rival.
14. Régression : sans accord, `peace`/`trade`/`war` inchangés ; rejeux v1 à v9
    identiques.
15. Un seul accord par tour personnel ; une seconde commande est rejetée.

## 11. Hors périmètre

Demande d'aide, contre-offres, alliances multipartites, transferts étalés,
escrow, et toute interface permettant au spectateur de gouverner. Le panneau et
la chronique se contentent du contrat d'observation et des types d'événement.
