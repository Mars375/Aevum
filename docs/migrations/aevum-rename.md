# Migration vers Aevum

Le nom public du produit est **Aevum — Chronique des mondes**. Cette migration
est volontairement limitée à la marque locale et publique : elle ne change ni
les contrats de données, ni les archives, ni les emplacements déjà utilisés par
une installation.

## Inventaire du renommage

L'inventaire a recherché, avec et sans distinction de casse,
`AI Battle Simulator`, `ai-battle-simulator`, `@abs` et les noms d'image Docker.

| Classe | Traitement | Emplacements principaux |
| --- | --- | --- |
| Marque publique | renommée | `README.md`, métadonnées npm racines, titre et en-tête du lecteur, labels et image Docker |
| Identifiants techniques | conservés | paquets et imports `@abs/*`, alias TypeScript/Vite/Vitest, unités `ai-battle-world.*` |
| Compatibilité locale | conservée | `~/.local/state/ai-battle-simulator`, variable `ABS_LOG_DIR`, chemins `/replays` et `/worlds`, paramètre `?replay=` |
| Références historiques | autorisées | spécifications et rapports R1, plan et conception de la Saison 1 |
| Artefacts générés | non édités à la main | rapports HTML sous `apps/player/public/reports`; le lockfile est régénéré depuis les manifestes |

Les 238 occurrences inventoriées de `@abs/*` sont des contrats, imports,
alias, dépendances ou explications d'architecture. Elles restent inchangées dans
cette version. Leur migration demanderait une carte séparée et une preuve de
compatibilité des consommateurs.

## Compatibilité

- Les anciens liens `?replay=replays/<fichier>.json` restent lus tels quels.
- Les volumes et routes `/replays` et `/worlds` restent inchangés.
- Les journaux w8 et les replays v1/v2 ne sont ni déplacés ni réécrits.
- Les états et journaux d'exploitation restent sous
  `~/.local/state/ai-battle-simulator`; les déplacer ici ferait perdre la reprise
  aux installations existantes.
- Les paquets continuent à s'appeler `@abs/contracts`, `@abs/engine`,
  `@abs/world`, `@abs/agents`, `@abs/metrics`, `@abs/cli` et `@abs/player`.
- L'ancienne image locale `ai-battle-simulator-player` n'est pas supprimée par
  Compose. La nouvelle construction produit `aevum-player`; l'ancienne image
  peut être retirée manuellement après vérification du déploiement.

## Allowlist de l'ancien nom

Les mentions de l'ancien nom ou de son identifiant encore présentes sont
intentionnelles :

- `docs/spec/mvp.md` et `docs/spec/release-r1.md` décrivent le produit R1 ;
- `docs/reports/release-r1-verification.md` et sa version HTML sont des preuves
  historiques générées ;
- `docs/superpowers/plans/2026-08-22-aevum-season-1.md` et
  `docs/superpowers/specs/2026-08-22-aevum-season-1-design.md` documentent la
  décision de migration ;
- `CLAUDE.md` et `.claude/skills/project-conventions/SKILL.md` nomment le dépôt
  et ses conventions techniques historiques ;
- ce document nomme nécessairement le prédécesseur pour expliquer la migration.

Les formes `ai-battle-simulator` restantes correspondent aux mêmes preuves, au
répertoire d'état compatible, à des chemins d'exploitation ou au titre technique
envoyé par le client historique au fournisseur. Elles ne constituent pas le nom
public affiché par Aevum.

## Dépôt distant

Le slug GitHub proposé est `aevum`, mais cette migration locale ne modifie ni le
dépôt distant ni `origin`. Avant un changement séparé, il faudra vérifier la
disponibilité du slug, la redirection GitHub, les protections de branche et les
consommateurs des URL actuelles.
