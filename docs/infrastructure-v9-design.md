# Infrastructure v9 — contrat d'implémentation (infrastructures localisées)

Statut : **livré** — `0d150a2` (infrastructures localisées v9) et `f79fcf3` (choix IA réalisables) poussés puis fusionnés fast-forward dans `origin/main`.

Validation au 20 septembre 2026 : 597 tests complets, typecheck et build ; 13 archives rejouées sans échec ; graines 42/7/123 = 1041/1048/406 actions, zéro rejet local, 13/13/0 sites ; conseil distant réel au tick 639 `valid: true`, zéro rejet, aucun fallback (`docs/infrastructure-verification.json` fait foi). Contrat effectivement implémenté : pollution fractionnaire plafonnée à 80 et bonus mis à l'échelle par `powerRatio` (sections ci-dessous). Un conseil valide ne prouve pas une campagne distante longue ; distribution autonome non acquise. Le root orchestre les implémentations, revues et corrections DeepSeek ; ce document décrit l'API réellement exportée.

## 1. Principes
- Les programmes nationaux (`modernization.ts`) gardent leurs bonus existants.
  Une infrastructure est un investissement ciblé supplémentaire, posé sur une ville.
- Six types, chacun débloqué par le programme national du même nom, une fois achevé :
  `foundry` ← mechanization, `thermal_plant` ← power_grid, `solar_array` ← clean_energy,
  `research_center` ← computing, `automated_factory` ← automation, `spaceport` ← orbital_network.
- Tout est déterministe et purement fonctionnel, comme le reste du moteur.
- Un seul nouveau module moteur : `packages/world/src/infrastructure.ts` (schémas zod, types,
  règles et helpers regroupés). Il n'importe jamais le spectateur : les fonctions lisent un
  `InfrastructureContext` (world + modernisation + enregistrements v9 optionnels), fourni par le
  spectateur sur un état cloné.

## 2. État (optionnel, v9 uniquement)
Champs optionnels `SpectatorState.infrastructure` (`InfrastructureStateSchema` : `sites`,
`queues`, `pollution`), actifs seulement sous la version de règles `spectator-9` ; absents ⇒
chemin identique aux versions précédentes. **Le `world.simulation` global n'est pas étendu** :
sites/files/pollution vivent sur l'état du spectateur, pour isoler les anciennes règles.
- `InfrastructureKind = "foundry" | "thermal_plant" | "solar_array" | "research_center" | "automated_factory" | "spaceport"` (`INFRASTRUCTURE_KINDS`, `InfrastructureKindSchema`)
- `Site = { city: string; kind: InfrastructureKind; builtAt: number }`
  — **`city` est une chaîne `City.id` existante (ex. `city-…`), jamais une position.**
- `Construction = { city: string; kind: InfrastructureKind; remaining: number; owner: FactionId }`
  — une seule construction active par civilisation (garde `queueActive`), portée par
  `queues: Construction[]`.
- `Pollution = Record<City.id, number>` **fractionnaire**, bornée `[0, POLLUTION_CAP]` (80).

## 3. Commande `infrastructure`
- Au tour personnel (décision v9) : `infrastructure: { city: string; kind: InfrastructureKind } | null`
  (`InfrastructureCommandSchema`, schéma strict), où `city` doit être un `City.id` existant.
- Conditions : civilisation active, ville possédée, programme `unlock` achevé (validation sur
  l'état, pas sur `world`), pas de file active pour la civilisation, pas de doublon (déjà construit
  OU déjà en file), coût payé comptant au dépôt de l'ordre.
- Refus explicites (jamais de remplacement silencieux), clés `INFRASTRUCTURE_ISSUES` :
  `inactive` (« Civilisation inactive »), `notOwned` (« Ville non possédée »),
  `unlockMissing` (« Déblocage manquant »), `queueActive` (« Un chantier est déjà en cours »),
  `duplicate` (« Déjà construit ou en file »), `insufficient` (« Réserves insuffisantes »).
- Construction : `remaining` décrémente une fois par tour personnel du propriétaire ; si l'owner
  tombe ou si la ville n'est plus possédée, le chantier est annulé sans remboursement. Les sites
  restent sur leur ville et suivent la conquête (le site ne change pas, c'est l'owner qui change).

## 4. Énergie et pollution
- Composantes connexes du territoire sec possédé par une civilisation : flood fill sur
  `neighbours()` en excluant `kind === "river"` (`ownedComponents`).
- Chaque composante compare `supply` (solaire + thermique) à `demand` (sites consommateurs) :
  l'énergie propre (`solar_array`) est consommée en premier, puis `thermal_plant`.
- **Émissions thermiques proportionnelles à la génération fossile réellement consommée**
  (`fossilUsed = min(thermalSupply, max(0, demand − cleanSupply))`) : si la demande est
  entièrement couverte par le solaire, la centrale thermique ne tourne pas et l'émission est nulle
  (règle arbitraire « −50 % solaire » supprimée).
- **Bonus fractionnaires par `powerRatio`** : `powerRatio = demand > 0 ? min(1, supply/demand) : 1`.
  Les bonus par site sont mis à l'échelle par ce ratio (fonderie +10 % minerai, usine automatisée
  +8 % bois/minerai/richesse, spatioport +15 % richesse) ; la science vaut
  `count(research_center | spaceport) × powerRatio`. Le bonus alimentaire solaire est passif
  (×1,1) dès qu'un `solar_array` est présent.
- Pollution par ville où une centrale thermique tourne effectivement : `+2 × utilisation − 1`
  une fois par tour du propriétaire, plafond 80 ; une ville sans centrale dans un réseau alimenté
  ne fait que décroître.
- **Pas de tick énergie annuel mondial** : `tickEnergy`/`tickInfrastructure` n'avancent que la
  file et la pollution du `civId` acteur.
- Pénalité alimentaire plafonnée `foodFactor = 1 − 0.25 × min(1, pollution/80)`, appliquée par
  `infrastructureProduction` à la production alimentaire de la ville (ledgers du civ acteur via la
  chaîne d'économie existante), jamais par écriture directe dans la simulation.

## 5. Chiffres (coût unique, durée en tours personnels, supply/demand)
| kind | unlock | cost {ore, wealth} | turns | supply | demand | bonus (alimenté) |
| --- | --- | --- | --- | --- | --- | --- |
| foundry | mechanization | {150, 200} | 8 | 0 | 3 | minerai +10 % × powerRatio |
| thermal_plant | power_grid | {120, 180} | 8 | 6 | 0 | — |
| solar_array | clean_energy | {100, 160} | 8 | 4 | 0 | nourriture +10 % (passif) |
| research_center | computing | {140, 220} | 10 | 0 | 3 | science +1 × powerRatio |
| automated_factory | automation | {200, 280} | 12 | 0 | 4 | bois, minerai, richesse +8 % × powerRatio |
| spaceport | orbital_network | {260, 400} | 14 | 0 | 5 | richesse +15 % × powerRatio, science +1 |

Coûts et durées initiaux conservés tels quels (`INFRASTRUCTURE`).

## 6. API exportée (déterministe) — `packages/world/src/infrastructure.ts`
- Constantes et schémas : `INFRASTRUCTURE_KINDS`, `InfrastructureKindSchema`,
  `InfrastructureCommandSchema`, `SiteSchema`, `ConstructionSchema`, `InfrastructureStateSchema`,
  `POLLUTION_CAP`, `INFRASTRUCTURE`, `INFRASTRUCTURE_ISSUES`.
- `emptyInfrastructure(): InfrastructureState`
- `infrastructureIssue(ctx, civId, kind, city): string | null` — valide sur l'état divulgué
- `queueInfrastructure(ctx, civId, kind, city): string | null` — paie le coût comptant et enfile ;
  renvoie le motif de refus ou `null`
- `tickInfrastructure(ctx, civId): InfrastructureContext` — avance la seule file de l'acteur,
  annulation sans remboursement si owner tombé ou ville perdue, pose des sites, élague les sites
  et la pollution des villes détruites
- `sitesOf(ctx, cityId): Site[]` — par `City.id`, les plus anciens d'abord
- `ownedComponents(ctx, civId): number[][]` — cases par composante (rivières exclues)
- `componentBalance(ctx, civId, component): ComponentBalance` — `{ supply, cleanSupply,
  thermalSupply, demand, fossilUsed, deficit, powerRatio }`
- `tickEnergy(ctx, civId): InfrastructureContext` — équilibre + pollution du seul civId acteur,
  aucune écriture mondiale ; effet alimentaire via la chaîne d'économie
- `energyReport(ctx, civId): EnergyReport` — **lecture seule, aucune écriture**, pour l'IA et
  l'interface : par composante (`ComponentReport`) et par ville (`CityInfrastructureReport` :
  `sites`, `pollution`, `foodFactor`, `powerRatio`, `scienceBonus`), sans fuite d'informations
- `infrastructureProduction(production, report): Stock` — applique `foodFactor`, le solaire passif
  et les bonus fractionnaires par `powerRatio` aux entrées de production d'une ville

## 7. Fichiers et responsabilités
- **Root** : orchestre uniquement les implémentations, revues et corrections DeepSeek
  (`codex exec -p deepseek-v4-flash`) ; ne code ni le moteur ni le visuel ; écritures de
  documentation via `exec_command`, pas `apply_patch`.
- **Moteur/IA** : `packages/world/src/infrastructure.ts` (seul nouveau module moteur), branche de
  décision v9 et tick dans `packages/world/src/spectator.ts`,
  `packages/world/test/infrastructure.test.ts`, contrats IA (`packages/agents/src/council-options.ts`,
  `council-schema.ts`, `council.ts`), serveur et vérification (`scripts/infrastructure-probe.ts`).
- **Visuel** : `apps/player/src/three/infrastructure-models.ts` (six modèles procéduraux
  réutilisant le cache de géométrie instanciée), `world-projection.ts` (pose sur les `City.id`,
  ordre canonique, échelle 0,24), `world-scene.ts` (catalogue préfixé `infra_`), panneau spectateur
  `apps/player/src/components/InfrastructurePanel.vue` (aucune commande). `age-models.ts` non étendu.
- **Tests de lot** : `infrastructure-models.test.ts`, `infrastructure-projection.test.ts`,
  `infrastructure-panel.test.ts`, `infrastructure-integration.test.ts`.

## 8. Replay et compatibilité
- Champs optionnels uniquement sur `SpectatorState.infrastructure` : les campagnes `spectator-8` et
  antérieures se rejouent à l'identique (état absent ⇒ chemin inchangé) ; le schéma exige
  `infrastructure` pour les règles `spectator-9`. Les 13 archives relâchées/anciennes se rejouent
  sans rejet local (graines 42/7/123 : 13/13/0 sites, 26 au total).
- Aucun changement des programmes nationaux existants ni de `modernizationProduction`.

## 9. Hors périmètre de ce lot
- Réseau électrique trans-frontière, commerce d'énergie, mode dieu, défense des sites,
  nouvelle page UI dédiée : non.