# Distribution autonome — ce qui est livré, et ce qui ne l'est pas

Le backlog demande de « remplacer le prérequis Node.js par une application
installable signée », avec quatre critères : démarrage en un clic, arrêt propre
du service, mises à jour et sauvegardes préservées, aucune clé livrée avec
l'application.

Les quatre critères sont atteints et vérifiés. Le mot « signée » l'est à moitié,
et ce qui manque ne peut pas venir d'un dépôt : le paquet est désormais **notre
propre exécutable, signable et signé de bout en bout lors d'un essai**, mais une
signature que Windows reconnaît demande un certificat acheté, au nom d'une
identité vérifiée. Ce rapport dit exactement où s'arrête la garantie.

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

|                             |                                                       |
| --------------------------- | ----------------------------------------------------- |
| fichiers                    | 74                                                    |
| poids total                 | **101,4 Mo**                                          |
| dont `Aevum.exe`            | 98,9 Mo — l'interpréteur et le serveur, en un fichier |
| dont le site déjà construit | 2,3 Mo                                                |
| lanceur `.cmd`              | aucun : l'exécutable fait son travail                 |
| `node_modules` livré        | aucun                                                 |

Le poids est presque entièrement l'interpréteur. C'est le prix du critère : ne
plus rien exiger de la machine d'en face.

`Aevum.exe` est un exécutable autonome (`node --build-sea`). Il fait ce que
faisait le lanceur : se placer dans son dossier — un double-clic ne fixe pas le
répertoire courant —, envoyer les parties dans `%LOCALAPPDATA%\Aevum`, garder le
port 5174 sauf si la machine en impose un autre, puis ouvrir le navigateur —
une fois le serveur réellement en écoute, là où le lanceur l'ouvrait avant.

## Ce que l'empaqueteur vérifie lui-même

Il ne se contente pas de produire, il contrôle ce qu'il vient de produire et
refuse de rendre un paquet qui échoue. Relevé de `dist-app/manifest.json` :

| contrôle                                      | résultat                                        |
| --------------------------------------------- | ----------------------------------------------- |
| disposition attendue complète                 | oui                                             |
| **secrets trouvés dans les fichiers livrés**  | **0**                                           |
| **secrets trouvés dans le code embarqué**     | **0**                                           |
| démarre réellement, sur un port libre         | oui                                             |
| **démarre depuis un autre répertoire**        | **oui**                                         |
| sert le site, pas seulement l'API             | oui                                             |
| **redémarre après une fermeture brutale**     | **oui**                                         |
| verrou repris au redémarrage                  | oui                                             |
| **partie enregistrée hors de l'installation** | **oui**                                         |
| **installation sans aucune donnée**           | **oui**                                         |
| table de signature périmée retirée            | 15 688 octets                                   |
| signé                                         | non par défaut ; oui avec un certificat désigné |

Le contrôle des secrets réutilise les motifs de `scripts/secrets.ts`, nomme le
fichier et le motif, jamais la valeur — et **détruit le paquet** plutôt que de
rendre un dossier contaminé.

Il lit désormais aussi le **code serveur avant qu'il soit scellé** dans
l'exécutable : le contrôle ignore les binaires, et sans cette lecture, passer à
un exécutable aurait retiré le serveur du contrôle en silence.

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

## La signature : trois obstacles, deux levés

Il en fallait trois, pas un : notre propre exécutable, un moyen de signer sans
`signtool`, et un certificat. Mesuré sur l'ancien paquet : `runtime/node.exe`
est **déjà signé et valide, par l'OpenJS Foundation** — le resigner usurperait
son éditeur — et `Lancer Aevum.cmd` renvoie `UnknownError`, parce qu'un fichier
batch **ne peut pas porter** de signature Authenticode. Le paquet ne contenait
rien de signable par nous.

**1. Notre propre exécutable — levé.** `node --build-sea` embarque le serveur
dans une copie de l'interpréteur et en retire la signature d'OpenJS : le
résultat est `NotSigned`, et il est à nous.

**Mais il n'était pas signable, et rien ne le disait.** Il s'exécutait, et
`Get-AuthenticodeSignature` le déclarait simplement « non signé » ; seule une
tentative de signature répondait « n'est pas une application Win32 valide ». En
lisant ses en-têtes : la construction ajoute une section de ressources
**exactement à l'endroit** où se trouvait la table de signature de `node.exe`,
repousse cette table en fin de fichier, mais laisse l'en-tête la désigner à son
ancien emplacement — en plein milieu de la nouvelle section. `pe-signature.ts`
remet l'entrée à zéro et coupe les 15 688 octets périmés, **seulement** si la
table annoncée est bien là, entière, en fin de fichier. Testé sur des en-têtes
fabriqués — PE32 et PE32+, fichier propre, fin de fichier inattendue.

Un second défaut est venu de là : la garde « lancé directement » du serveur
compare `import.meta.url` à `process.argv[1]`, et dans l'exécutable
`import.meta.url` est **indéfini** dans ce module chargé à la demande. Le paquet
se terminait aussitôt, code 0, sans un mot. Un binaire d'essai avait pourtant
montré les deux valeurs égales — mais il les lisait au premier niveau du module
principal. Le démarrage est désormais explicite (`startServer()`).

**2. Signer sans le SDK Windows — levé.** `Set-AuthenticodeSignature`, présent
dans tout Windows, signe l'exécutable nettoyé. `AEVUM_SIGN_THUMBPRINT` désigne
un certificat du magasin de l'utilisateur ; `AEVUM_SIGN_TIMESTAMP`, un serveur
d'horodatage. Éprouvé de bout en bout avec un certificat jetable, supprimé
aussitôt : `npm run package` signe, puis démarre l'exécutable **signé**, sert le
site et redémarre après une fermeture brutale. Le manifeste relève
`UnknownError` et le signataire — signé, mais par une racine que Windows ne
reconnaît pas, ce qui est exactement ce qu'est un certificat auto-signé.

**3. Un certificat reconnu — pas levé, et pas levable ici.** Un certificat de
signature de code reconnu par Windows s'achète auprès d'une autorité, au nom
d'une identité vérifiée — et depuis 2023, sa clé vit sur un support matériel ou
un service de signature en ligne. C'est une décision et une dépense, pas du
code. L'empaqueteur est prêt à s'en servir.

## Ce qui n'est pas livré

- **Une signature reconnue par Windows** : voir ci-dessus. Sans certificat
  désigné, le manifeste porte `signed: false` plutôt que de laisser croire le
  contraire.
- **Un installateur, une désinstallation, une mise à jour automatique.** Le
  paquet est un dossier qu'on copie.
- **Windows uniquement.** `Aevum.exe` est un exécutable Windows. Rien n'empêche
  l'équivalent ailleurs ; ce n'est pas fait ni testé.
