# Journal des modifications

## [0.3.0] - 2026-08-24

Saison 1 publiée sous le nom **Aevum — Chronique des mondes**.

### Ajouté

- Une première ère reproductible, son journal, son sidecar de métriques et ses rapports publics.
- Une vérification hors ligne qui rejoue le journal, contrôle les courbes, les sources, les liens, les index, le renommage et les frontières de secrets.
- Une suite CI Node 22 qui reconstruit les artefacts, exerce le lecteur, vérifie le déploiement Compose et refuse les rapports obsolètes.

### Vérifié

- 432 tests Vitest, typecheck TypeScript, build du lecteur (96 modules), audit npm sans vulnérabilité connue.
- Probe du monde : 56 points de décision sur 1 200 appels naïfs, soit 21,4× d'économie.
- `npm run verify-season-1` réussi hors ligne, sans appel à un modèle distant.

### Limites connues

- L'ère publiée est scriptée (`SCRIPTED_NO_REMOTE_MODEL`) : elle ne classe aucun modèle et ne prouve aucune adaptation distante.
- La passe Chromium locale reste bloquée par un timeout CDP avant navigation ; les observations multi-largeurs, reduced-motion et l'audit console/requêtes ne sont pas acquis localement.
- Le smoke test Docker local n'a pas été acquis car le port 8088 est déjà détenu par un conteneur existant ; la CI distante reste l'autorité pour ce contrôle.

## [0.2.0] - 2026-08-22

Candidate R1 préparée, non publiée.

Le produit public porte désormais le nom **Aevum — Chronique des mondes**.
Les contrats internes `@abs/*`, les URL de replay et les chemins d'état
historiques restent inchangés pour préserver les installations et archives
existantes ; la migration est détaillée dans `docs/migrations/aevum-rename.md`.

### Ajouté

- Une Chronique du monde continu `w8`, centrée sur les tournants, les paroles
  des dirigeants, leurs décisions et les conséquences résolues par le moteur.
- Une interface d'observatoire qui donne la priorité à la carte, à la frise
  temporelle, à l'état des civilisations, aux trajectoires et au registre.
- Une bande de preuve reliant les années, les modèles demandés et servis, les
  replis, les retards et les événements du journal pour permettre la relecture
  locale et l'audit.

### Modifié

- Renommage des métadonnées, du lecteur et de l'image Docker publics vers
  **Aevum — Chronique des mondes**, sans migration des identifiants techniques.
- Réconciliation du monde R1 avec les règles `w8` : les progrès restent des
  jalons sans effet afin que les journaux archivés se rejouent à l'identique.
- Établissement d'une base CI Node 22 avec tests et contrôles hors ligne,
  construction du lecteur et gardes contre les secrets suivis par Git.

### Limites connues

- Cette candidate n'est ni publiée, ni étiquetée, ni poussée vers un dépôt
  distant.
- Aucun nouveau monde public ni appel à un modèle distant n'a été produit pour
  cette vérification.
- La vérification visuelle reste headless et ne remplace pas un parcours manuel
  sur navigateurs, tailles d'écran, lecteur d'écran et zoom à 200 %.
- Les performances Web Vitals et le comportement sur un très long journal réel
  ne sont pas établis par cette vérification.
