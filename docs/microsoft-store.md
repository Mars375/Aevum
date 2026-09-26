# Publier Aevum sur le Microsoft Store — le guide

Pourquoi le Store : il signe lui-même l'application, gratuitement. Plus
d'avertissement « Windows a protégé votre ordinateur », et aucun certificat à
acheter. Le paquet est prêt (`npm run package:msix`) ; il ne manque que le
compte, qui ne peut être créé que par toi, parce qu'il vérifie ton identité.

Durée : une vingtaine de minutes pour le compte, puis quelques jours d'examen
par Microsoft.

## 1. Créer le compte développeur (gratuit)

1. Ouvre **https://storedeveloper.microsoft.com** — c'est la seule entrée qui
   donne l'inscription gratuite ; passer ailleurs mène à l'ancienne, payante.
2. Clique sur **« Get started for free »**.
3. Choisis **Individual developer** (particulier, gratuit).
4. Connecte-toi avec ton compte Microsoft (celui de Windows, Outlook ou Xbox),
   ou crées-en un.
5. **Vérification d'identité** : une pièce d'identité officielle (carte
   d'identité ou passeport, l'original) et un selfie, pris avec ton téléphone,
   dans un endroit bien éclairé.
6. Relis le profil pré-rempli à partir de ta pièce d'identité, corrige si
   besoin. Le « nom d'éditeur » qui sera affiché sur le Store se choisit ici :
   ton nom, ou un nom comme « Aevum ».
7. Clique sur **« Go to Partner Center dashboard »**, choisis le même compte
   Microsoft. Tu arrives sur **Apps & games**. Si la tuile n'apparaît pas,
   attends cinq minutes et recharge la page.

## 2. Réserver le nom

1. Dans **Apps & games**, clique sur **New product** → **MSIX or PWA app**.
2. Tape **Aevum** (ou un autre nom si celui-ci est pris) → **Reserve product
   name**.

## 3. Me donner l'identité du paquet

1. Dans la page de l'application : **Product management** → **Product
   identity**.
2. Trois valeurs y figurent. **Copie-les-moi** ; elles ne sont pas secrètes :
   - **Package/Identity/Name** — du genre `12345Loc.Aevum` ;
   - **Package/Identity/Publisher** — du genre `CN=ABCD1234-…` ;
   - **Package/Properties/PublisherDisplayName** — le nom d'éditeur.

Je reconstruis alors le paquet avec cette identité : c'est la condition pour
que le Store l'accepte.

## 4. Soumettre (je te prépare tout ; tu cliques)

Dans la page de l'application, **Start submission**, puis :

- **Pricing and availability** : gratuit, tous les marchés.
- **Properties** : catégorie **Games → Simulation** (ou **Education**).
- **Age ratings** : un questionnaire. Réponses honnêtes : pas de sang, pas de
  personnages humains réalistes ; des guerres **abstraites** entre
  civilisations, sans violence montrée ; l'application se connecte à des
  services d'IA ; pas d'achats, pas de discussion entre joueurs.
- **Packages** : dépose `dist-msix/Aevum.msix` (je te dirai quand il est prêt).
- **Store listings** (français) : textes et captures ci-dessous.
- **Submission options → restricted capabilities** : le paquet demande
  `runFullTrust`. Justification à coller :

  > Aevum est une application de bureau : elle démarre un service local qui
  > rejoue et affiche les parties dans le navigateur de l'utilisateur, et range
  > les parties dans son dossier de données. Elle a besoin de s'exécuter comme
  > une application Win32 complète.

Puis **Submit to the Store**. Microsoft examine en général en un à trois jours.

## Textes de la fiche

**Description courte**

> Quatre civilisations gouvernées par des IA. Un moteur qui tranche. Regardez
> l'histoire s'écrire, tour après tour.

**Description**

> Aevum est un observatoire de civilisations. Quatre peuples, chacun gouverné
> par un modèle de langage, partagent un même monde : ils cultivent, bâtissent,
> découvrent, négocient des pactes, commercent — et parfois se font la guerre.
> Un moteur déterministe tranche chaque décision ; rien n'est scripté.
>
> Vous ne jouez pas : vous regardez. Suivez une partie en direct, relisez
> l'histoire d'un monde tour par tour, ouvrez la fiche d'un dirigeant pour lire
> ses raisons, ses plans et ce qu'il en est advenu. Chaque partie se rejoue à
> l'identique : ce que vous voyez est ce qui s'est passé.
>
> — Une vue 3D où se lisent les villes et leurs bâtiments, les pactes, les
> commerces, les fronts, les saisons ;
> — une carte 2D complète ;
> — des parties en direct, et un mode lecture seule pour les regarder depuis
> un téléphone du même réseau.

**Captures** : `packaging/msix/store/` (1920 × 1080).

**Mots-clés** : simulation, civilisation, IA, stratégie, observatoire.
