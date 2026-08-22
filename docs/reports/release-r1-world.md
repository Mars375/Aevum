# Release R1 — monde continu

Audit hors ligne du 22 août 2026.

## Constat et correction

`tick.ts` appliquait sous l'identifiant `w8` une partie d'effets annoncés comme
`w9` dans `advances.ts`. Les effets économiques et d'expansion étaient actifs,
mais pas ceux de combat et de commerce définis dans le même module. Au-delà de
cette incohérence interne, rejouer un journal w8 aurait changé ses résultats et
rompu W4.

R1 conserve donc les progrès comme les jalons sans effet décrits par w8. Leur
table de seuils reste extraite dans `advances.ts`, et un test vérifie désormais
que les étiquettes de progrès ne changent pas la résolution d'un tour.

## Vérifications observées

- `npm test` : 15 fichiers, 346 tests réussis, dont les rejeux w8 et les suites
  v1/v2.
- `npm run typecheck` : réussi.
- `npm run index-worlds` : chemin sans données réussi, avec
  `Aucun monde a indexer.`
- `git diff --check` : réussi.

## Incertitude restante

Ce worktree ne contient aucun répertoire `worlds/`. Le chemin d'indexation vide
est vérifié, mais aucun journal réel ni catalogue généré n'a pu être rejoué et
comparé ici. Les rapports préexistants ont été conservés sans modification.
