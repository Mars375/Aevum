# Vérification de la candidate R1 / 0.2.0

Date : 22 août 2026

Statut : candidate préparée dans ce worktree, non publiée

## Périmètre de release

La candidate `0.2.0` regroupe la réconciliation du monde continu `w8`, la
Chronique et son interface d'observatoire, les éléments de preuve nécessaires à
la relecture locale, ainsi que la base CI Node 22 et ses gardes hors ligne. Les
batailles tactiques `v1` et `v2` restent des archives gelées.

Les métadonnées modifiées concernent uniquement le paquet racine et
`@abs/player`. Les autres workspaces restent en `0.1.0` dans leurs manifestes et
dans le lockfile : ils ne font pas partie du changement de version demandé.

## Préparation des métadonnées

Commandes exécutées :

```text
npm version 0.2.0 --no-git-tag-version
npm version 0.2.0 --workspace @abs/player --no-git-tag-version
```

Résultat observé : les deux commandes ont annoncé `v0.2.0`. La seconde a aussi
installé 89 paquets dans le répertoire de travail et signalé trois scripts
d'installation bloqués (`esbuild@0.25.12`, `esbuild@0.28.2` et
`esbuild@0.21.5`). Aucun tag ni commit n'a été créé grâce à
`--no-git-tag-version`.

Contrôle des versions :

```text
$ npm pkg get version
0.2.0
$ npm pkg get version --workspace @abs/player
@abs/player 0.2.0
```

Validation déterministe du lockfile :

```text
$ npm install --package-lock-only --ignore-scripts
up to date, audited 96 packages in 1s
17 packages are looking for funding
5 vulnerabilities (3 moderate, 1 high, 1 critical)
```

La commande n'a produit aucune modification supplémentaire du lockfile. Les
vulnérabilités npm restent un constat à traiter séparément ; aucun
`npm audit fix`, changement de dépendance ou mise à niveau hors périmètre n'a
été effectué.

## Vérifications observées

### Tests

```text
$ npm test
Test Files  15 passed (15)
Tests       346 passed (346)
Duration    9.01s
```

Vitest a terminé avec un code de sortie nul. La sortie annonce le paquet racine
`ai-battle-simulator@0.2.0`.

### Types

```text
$ npm run typecheck
npm notice run ai-battle-simulator@0.2.0 typecheck
npm notice run tsc --noEmit
```

La commande a terminé avec un code de sortie nul et sans diagnostic TypeScript.

### Build du player

```text
$ npm run player:build
vite v6.4.3 building for production...
85 modules transformed.
dist/assets/index-DvZGmUeg.js       164.11 kB | gzip:  54.04 kB
dist/assets/Chronicle-ueKYOMvp.js    36.73 kB | gzip:  13.69 kB
dist/assets/Battle3D-CaJVvPwm.js    477.67 kB | gzip: 120.88 kB
built in 10.13s
```

Le build a terminé avec un code de sortie nul et a annoncé
`@abs/player@0.2.0`.

### Healthcheck

```text
$ npm run healthcheck
ok    contracts load — 4 factions, grid 16
ok    engine resolves a turn — turn 1, 8 squads
ok    openrouter reachable (advisory) — skipped, no OPENROUTER_API_KEY
```

Le healthcheck a terminé avec un code de sortie nul. Son dernier contrôle est
une sonde réseau consultative ; dans la vérification canonique, elle a été ignorée
faute de `OPENROUTER_API_KEY`. Aucun prompt ni appel d'inférence à un modèle
distant n'a été exécuté.

### Propreté du diff

```text
$ git diff --check
```

La commande a terminé avec un code de sortie nul et aucune sortie.

## Limites et opérations en attente

- Aucun commit, tag, push, dépôt distant ou GitHub Release n'a été créé. La
  publication et le push restent explicitement en attente.
- Aucun appel d'inférence à un modèle distant n'a été effectué pour cette vérification.
- Le dépôt canonique contient `worlds/demo/era-0001.json`. `npm run index-worlds`
  a indexé une ère et `npm run world:probe -- 300` a produit 56 points de décision
  et une économie mesurée de 21,4×. Aucun appel LLM n'a été effectué.
- La vérification visuelle a été faite avec Playwright/headless_shell : captures
  à 375/900/1440 px, zéro débordement, zéro erreur console, navigation des quatre
  routes, cibles tactiles ≥44 px, reduced-motion et aucune requête externe. Elle ne
  remplace pas encore un parcours manuel avec lecteur d'écran ou zoom à 200 %.
- Les métriques Web Vitals, le comportement sous un très long journal réel et
  les cinq vulnérabilités signalées par `npm install --package-lock-only` restent
  hors de la preuve d'acceptation présente.
