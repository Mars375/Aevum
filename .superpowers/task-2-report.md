# Rapport Task 2 — identités, événements, mémoire et progression

## Fichiers modifiés

- `packages/world/src/state.ts` : empreinte canonique de doctrine.
- `packages/world/src/events.ts` : événements de vie versionnés et identifiants stables sans hash collisionnable.
- `packages/world/src/chronicle.ts` : enrichissement canonique des événements, mémoire bornée et identité historique.
- `packages/world/src/advances.ts` : seuil, effet, compromis et version explicites ; garde de version pour les futurs progrès.
- `packages/world/src/tick.ts` : acquisition limitée aux progrès disponibles sous la version du monde rejoué.
- `packages/world/src/turning.ts` : référence stable vers l'événement moteur source.
- `packages/world/src/index.ts` : export du contrat de progression.
- `packages/world/test/events.test.ts` : stabilité et unicité des IDs, pureté et plafond de mémoire.
- `packages/world/test/chronicle.test.ts` : IDs au rejeu, identité d'une civilisation éteinte et empreinte doctrinale.
- `packages/world/test/tick.test.ts` : métadonnées des jalons, garde w8/w9 et absence d'effet des progrès w8.
- `docs/spec/world-w8.md` : identité, attribution, mémoire et compatibilité de progression documentées.

`packages/world/src/apply.ts` n'a pas été modifié : la reconstruction existante applique déjà les décisions différées à leur année effective. Ajouter un second chemin aurait menacé W4 sans apporter de contrat nécessaire.

## Interfaces produites

- `eventId(event, tick, civ): string` : clé canonique `world-event-v1`, incluant année, civilisation, ordre, catégorie et détail encodé.
- `LifeEvent` / `lifeEvent(event, order)` : projection w8 avec `id`, `worldVersion`, `order` et attribution `engine-only`.
- `memoryFor(journal, civ, tick, maxEntries): LifeEvent[]` : reconstruction par `chronicle()`, limitée globalement à `MAX_MEMORY_ENTRIES`, sans texte de modèle promu en fait.
- `doctrineFingerprint(doctrine): string` : empreinte `doctrine-v1` à ordre fixe ; les parts proportionnelles sont équivalentes.
- `identityOf(civ, history): HistoricalIdentity | null` : identité déclarée, empreinte doctrinale et `fellOnTick`, y compris après extinction.
- `Advance` / `advanceAvailableIn(advance, worldVersion)` : condition, effet, compromis et version explicites avec exclusion des progrès futurs pendant un rejeu w8.
- `Turning.sourceEventId` : lien optionnel vers la preuve moteur stable.

## Commandes et sorties observées

- `npm test -- packages/world/test/events.test.ts packages/world/test/chronicle.test.ts packages/world/test/tick.test.ts packages/world/test/journal.test.ts` : 4 fichiers, 67 tests réussis.
- `npm test` : 19 fichiers, 371 tests réussis.
- `npm run typecheck` : réussi, aucune erreur.
- `npm run world:probe -- 300` : 56 points pour 1200 appels théoriques, économie 21,4x, 248/300 tours sans consultation. Répartition maximale : `RAIDED`, 23 points, 41 %.
- `git diff --check` : réussi, aucune sortie.

## Compatibilité observée

- La fixture de journal v0.2.0 conserve ses empreintes historiques : `22ced0e3`, `7ec18ecc`, `b6fac6ba`, `76aefdfe`.
- Les événements bruts et les états produits par `tickWorld()` restent inchangés ; l'enrichissement est effectué par `chronicle()`.
- Les progrès w8 restent des jalons sans effet de résolution.
- Les archives tactiques v1/v2 passent dans la suite complète.

## Préoccupations restantes

- Aucun comportement w9 n'est introduit par cette tâche. La garde de version est testée avec une définition de progrès future synthétique ; une vraie règle w9 devra encore suivre la procédure complète de changement de monde.
- Un identifiant d'événement change volontairement si le fait moteur, son détail ou son ordre change. Le préfixe `world-event-v1` rend cette convention explicite ; une modification incompatible devra créer une nouvelle version d'identifiant.
- `memoryFor()` borne sa sortie mais recompose l'histoire jusqu'au tour demandé, conformément au chemin canonique W4. Une optimisation future devra conserver `chronicle()` comme source et démontrer son équivalence.
