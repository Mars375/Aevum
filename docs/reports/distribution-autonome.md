# Distribution autonome — ce qui est livré, et ce qui ne l'est pas

Le backlog demande de « remplacer le prérequis Node.js par une application
installable signée », avec quatre critères : démarrage en un clic, arrêt propre
du service, mises à jour et sauvegardes préservées, aucune clé livrée avec
l'application.

Les quatre critères sont atteints et vérifiés. Le mot « signée » ne l'est pas,
et ne peut pas l'être depuis un dépôt. Ce rapport dit exactement où s'arrête la
garantie.

## Ce que le lanceur demandait à l'utilisateur

`Lancer Aevum.cmd` exigeait quatre choses, et chacune pouvait échouer chez lui
sans qu'on le sache :

1. Node.js 22 ou plus récent **déjà installé** ;
2. un `npm ci` au premier lancement, donc **Internet** et un registre joignable ;
3. un **build Vite à l'exécution**, chez l'utilisateur, à chaque première fois ;
4. `tsx`, pour lire du TypeScript à chaud.

Un double-clic qui installe des dépendances n'est pas un démarrage en un clic,
c'est une installation déguisée.

## Ce que `npm run package` produit

Un dossier `dist-app/` qui ne télécharge ni ne compile rien au lancement :

|                                          |                                               |
| ---------------------------------------- | --------------------------------------------- |
| fichiers                                 | 67                                            |
| poids total                              | **101,2 Mo**                                  |
| dont l'interpréteur (`runtime/node.exe`) | 99 Mo                                         |
| dont le site déjà construit              | 2,4 Mo                                        |
| serveur                                  | un seul fichier, `aevum-server.mjs` (esbuild) |
| `node_modules` livré                     | aucun                                         |

Le poids est presque entièrement l'interpréteur. C'est le prix du critère : ne
plus rien exiger de la machine d'en face.

## Ce que l'empaqueteur vérifie lui-même

Il ne se contente pas de produire, il contrôle ce qu'il vient de produire et
refuse de rendre un paquet qui échoue. Relevé de `dist-app/manifest.json` :

| contrôle                                      | résultat |
| --------------------------------------------- | -------- |
| disposition attendue complète                 | oui      |
| **secrets trouvés dans les fichiers livrés**  | **0**    |
| démarre réellement, sur un port libre         | oui      |
| sert le site, pas seulement l'API             | oui      |
| **redémarre après une fermeture brutale**     | **oui**  |
| verrou repris au redémarrage                  | oui      |
| **partie enregistrée hors de l'installation** | **oui**  |
| **installation sans aucune donnée**           | **oui**  |
| signé                                         | **non**  |

Le contrôle des secrets réutilise les motifs de `scripts/secrets.ts`, nomme le
fichier et le motif, jamais la valeur — et **détruit le paquet** plutôt que de
rendre un dossier contaminé.

## Le défaut que l'empaquetage a trouvé

Le premier paquet démarrait et servait le site, puis échouait à la dernière
vérification : **le verrou du monde survivait à l'arrêt.**

Ce n'était pas un artefact du test. Sous Windows, `kill` ne délivre aucun
signal : le processus est terminé, ses gestionnaires `SIGTERM` et `exit` ne
tournent jamais. Or c'est exactement ce qui se produit quand l'utilisateur
**ferme la fenêtre du lanceur**, c'est-à-dire la façon normale d'arrêter
l'application. Le verrou restait, et le lancement suivant échouait sur
« World already locked ».

Le lanceur npm savait s'en sortir — `scripts/launch.mjs` vérifiait déjà si le
processus enregistré était mort. Mais cette connaissance vivait dans le
lanceur, et le paquet démarre le serveur directement : il ne la traversait pas.
Elle appartenait au serveur.

`reclaimStaleLock` la lui donne, sans rien céder sur l'intention d'origine :
`lockWorld` continue de refuser d'effacer, parce qu'un plantage doit laisser
une trace. Seul un verrou dont le propriétaire est **vérifiablement** mort est
repris — `ESRCH` uniquement, jamais `EPERM`, qui signifie que le processus
existe et appartient à quelqu'un d'autre. Et la reprise est annoncée sur la
sortie, pas silencieuse.

La vérification a changé en conséquence : mesurer un arrêt poli mesurerait une
chose qui n'arrive jamais chez l'utilisateur. Le paquet est donc démarré, tué
brutalement, puis **redémarré** — et c'est ce second démarrage qui fait foi.

## Les parties sortent de l'installation

Le paquet gardait ses campagnes dans son propre dossier. Mettre à jour
l'application — c'est-à-dire remplacer ce dossier — aurait donc effacé les
parties enregistrées : le critère « mises à jour et sauvegardes préservées »
était perdu par construction, et aucun soin apporté à l'installateur ne l'aurait
rattrapé.

`AEVUM_DATA` les en sort. Sans cette variable, rien ne change — le dépôt et les
tests continuent de résoudre `worlds/` depuis le répertoire courant. Le lanceur
du paquet la place dans `%LOCALAPPDATA%\Aevum`.

La vérification ne se contente pas de le supposer : elle démarre le paquet,
crée une vraie partie par `POST /api/demo`, puis contrôle **les deux moitiés** —
que la partie est bien arrivée dans le dossier de données, et que
l'installation, elle, ne contient aucune donnée. C'est cette seconde moitié qui
autorise à dire qu'un remplacement de dossier ne peut rien emporter.

## Le port cesse d'être figé

Le service écoutait 5174 en dur. Deux conséquences : impossible de vérifier un
paquet sans prendre la place d'une instance ouverte, et un conflit de port
transformait le démarrage en un clic en échec sans recours. `AEVUM_PORT` le
déplace, et la liste d'origines autorisées suit le port réel au lieu de le
répéter.

## Ce qui n'est pas livré

- **La signature.** Elle demande un certificat de signature de code, qui n'a
  rien à faire dans un dépôt. Le manifeste porte `signed: false` plutôt que de
  laisser croire le contraire.
- **Un installateur, une désinstallation, une mise à jour automatique.** Le
  paquet est un dossier qu'on copie.
- **Windows uniquement.** `runtime/node.exe` et un lanceur `.cmd`. Rien
  n'empêche l'équivalent ailleurs ; ce n'est pas fait ni testé.
