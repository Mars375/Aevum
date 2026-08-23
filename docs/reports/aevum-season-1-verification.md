# Vérification du candidat Aevum Saison 1

Statut : candidat local vérifié le 24 août 2026, non publié et sans preuve nouvelle issue de modèles distants.

## Périmètre

Cette vérification porte sur le journal publié de la première ère, son sidecar
de métriques, le rapport rendu, les index du lecteur, le renommage public et les
frontières de secrets. Elle ne modifie ni les règles du monde, ni les métriques,
ni le moteur, ni le lecteur.

Le contrôle `npm run verify-season-1` reparcourt le journal avec `@abs/world`,
recalcule son fingerprint, recalcule le résumé de service depuis les décisions,
compare les métadonnées du sidecar, soumet les courbes publiées à une validation
sémantique explicite — classification dérivée de sa série, numérateur borné par
le dénominateur, valeur égale au quotient, bande de Wilson 95 % recalculée à
l'identique, fenêtres alignées puis partagées entre métriques, sources
d'événements conformes au journal et triées, protocole publié inchangé — où
chaque dérive porte son propre message au lieu d'une égalité globale opaque, puis
reconstruit le Markdown attendu et suit les liens vers les artefacts publics. Il
échoue aussi si l'identité Aevum, l'inventaire de migration, `.env` ou un motif
de secret ne respectent plus leur contrat.

## Preuves scriptées et locales

| Contrôle | Résultat observé |
| --- | --- |
| Tests ciblés de publication, marque et courbes | 20 tests réussis |
| `npm test` | 27 fichiers, 429 tests réussis |
| `npm run typecheck` | réussi, aucune erreur |
| `npm run player:build` | réussi, 96 modules transformés |
| `npm run world:probe -- 300` | 56 points de décision sur 1 200 appels naïfs, économie 21,4× |
| Génération du rapport et des index | réussie, une ère indexée |
| `npm run verify-season-1` | candidat vérifié hors ligne |
| `npm run healthcheck` | contrats et moteur réussis; accès OpenRouter HTTP 200 seulement consultatif |
| `docker compose config --quiet` | réussi localement |
| Build Docker et healthcheck du conteneur | épreuve de CI seulement ; non exécutée localement sur cette machine pour ce candidat |
| `git diff --check` | réussi |
| Contrats de secrets | `.env` ignoré et non suivi; scans de l'arbre et du diff réussis |

Les tests négatifs altèrent séparément le journal, la source métrique, le taux de
service, une cible de lien et le fingerprint, plus vingt et une dérives
sémantiques nommées du sidecar — une par invariant de courbe ci-dessus. Chaque
altération est refusée.
La reprise scriptée produit aussi les mêmes octets qu'une exécution en une fois,
sans accès réseau et sans réutiliser silencieusement une autre fixture.

Le scan des secrets est un module partagé, `scripts/secrets.ts`. Il juge tout
fichier suivi dont le contenu se comporte comme du texte — décision prise sur le
contenu, pas sur l'extension, donc y compris `.env.*`, `.txt` et `.tsx` que
l'ancienne liste d'extensions laissait de côté — et sait aussi éprouver les
seules lignes ajoutées d'un diff unifié, pour qu'un push ou une pull request
réponde de ce qu'il introduit. Une découverte n'imprime jamais la valeur
détectée : chemin et nom de motif seulement.

La CI impose les mêmes épreuves au dépôt : rejet de tout rapport ou index
obsolète, puis construction du déploiement Compose dont le test de fumée Docker
interroge chaque chemin requis — `/`, les deux rapports HTML de la saison, les
deux index publics, le journal et son sidecar — sur un conteneur déclaré
`healthy`.

## Preuves navigateur locales

Le `headless_shell` déjà installé a chargé le lecteur et produit des captures à
375, 900 et 1 440 px. Les trois compositions sont lisibles et ne montrent pas
de débordement horizontal; une passe séparée avec préférence de mouvement réduit
a également rendu la page. Le scan des sources du lecteur ne trouve ni police,
ni import, ni URL HTTP externe.

Le pilote rejouable `scripts/browser-qa.ts` (`npm run qa:browser`) pilote un
Chromium réel via CDP contre `apps/player/dist`. Sur cette machine (mesuré le
24 août 2026), le navigateur accepte la poignée de main DevTools mais n'achève
jamais une navigation locale : chaque échange est borné à 8 s et la passe échoue
en ~10 s avec « Page.navigate timed out after 8000ms » et un code de sortie 1,
sans processus Chromium résiduel ni socket de serveur oublié. Le pilote est
rejouable et son issue est reproductible ; ici, cette issue est un échec
honnête — la preuve navigateur n'est pas acquise sur cette machine. Un échec
borné reste un échec ; il n'est jamais converti en succès.

Les tests de composants exercent au clavier les marqueurs avec Entrée et Espace,
le bouton d'une source et la remontée de l'événement de recherche jusqu'à l'année
visée. Ce sont des preuves automatisées locales, pas une observation humaine ni
une session navigateur distante.

## Preuves issues de modèles distants

Aucune nouvelle course de modèle distant n'a été exécutée pour ce candidat. Le
journal déclare `SCRIPTED_NO_REMOTE_MODEL`, son empreinte de fixture est publiée,
son sidecar déclare zéro appel distant et ses 67 preuves de service restent
inconnues. Cette ère ne classe donc aucun modèle et ne démontre aucune adaptation
d'un modèle distant.

Les anciens rapports de mesures distantes restent des archives de protocoles
antérieurs. Ils ne sont pas promus en preuve de la Saison 1 par cette vérification.

## Affirmations non vérifiées

- Le renommage du dépôt distant, sa redirection et ses protections ne sont pas vérifiés; `origin` reste inchangé.
- Aucun tag, push, dépôt GitHub ou artefact publié n'est vérifié.
- La passe CDP indépendante n'a pas permis de recueillir un journal console exploitable; l'absence d'erreur console reste couverte par les tests et builds, pas attestée par cette passe navigateur.
- Le parcours clavier complet et la recherche de source sont testés en mémoire, mais n'ont pas été rejoués par un pilote navigateur indépendant dans cette session.
- Une trajectoire scriptée unique ne permet ni causalité, ni généralisation, ni classement de modèles.

## Risque de dépendances

`npm audit --audit-level=high` signale cinq vulnérabilités transitives dans la
chaîne de développement Vite/Vitest : trois modérées, une haute et une critique.
La correction proposée impose une montée majeure de Vitest. Aucune dépendance
n'a été changée dans cette tâche; ce risque doit être arbitré avant publication.
