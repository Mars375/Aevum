# Découvrir Aevum

## Sans rien installer

`npm run package` produit un dossier `dist-app/` autonome : le site déjà construit et un seul exécutable, **Aevum.exe**, qui porte l'interpréteur et le serveur. On le copie où l'on veut, on double-clique **Aevum.exe** — il ouvre le navigateur une fois le serveur prêt —, et rien n'est téléchargé ni compilé au lancement. Aucune clé n'y est livrée : les réglages Nous restent lus dans les variables d'environnement de la machine qui l'exécute.

Les parties enregistrées vivent **hors** du dossier, dans `%LOCALAPPDATA%\Aevum` : remplacer l'installation par une version plus récente ne les emporte pas. Une limite demeure, et elle compte si vous diffusez le paquet : il **n'est pas signé par défaut**. L'exécutable est signable — `AEVUM_SIGN_THUMBPRINT` désigne un certificat de signature de code et `npm run package` le signe —, mais un certificat que Windows reconnaît s'achète et suppose une vérification d'identité. `docs/reports/distribution-autonome.md` dit ce qui est vérifié et ce qui ne l'est pas.

## Depuis le dépôt

Sous Windows, installez Node.js 22 ou plus récent, puis double-cliquez sur **Lancer Aevum.cmd**. Le premier lancement installe les dépendances, prépare le site et ouvre le navigateur. Gardez la fenêtre du lanceur ouverte pendant la simulation. Relancer le fichier réutilise le serveur s'il est déjà prêt.

Dans le site, **Découvrir** charge une campagne enregistrée de 50 tours, réellement jouée par quatre modèles Nous. Ce parcours ne nécessite aucune clé et ne déclenche aucun appel IA. Les indisponibilités historiques sont conservées. Les boutons de lecture parcourent l'enregistrement ; les moments importants permettent de sauter aux événements marquants.

Pour une nouvelle partie, choisissez 40, 80 ou 120 manches. Chaque civilisation joue son tour puis passe la main à la suivante. Le mode local utilise des règles déterministes et fonctionne sans fournisseur IA. Avec une clé Nous configurée, le mode distant et le modèle par défaut sont présélectionnés. Les réglages Nous peuvent être lus dans les variables d'environnement Windows. Les clés restent sur votre machine.

La campagne se sauvegarde automatiquement. Le navigateur retrouve la dernière campagne visitée. À la fin, consultez les résultats par population, villes, technologies et plans accomplis, puis recommencez avec une autre carte.

Le projet actif est `F:\Projet\Aevum`. L'ancienne copie est archivée dans `F:\Projet\Archives\Aevum-2026-09-08`. L'ancien dossier vide peut subsister tant que Codex le garde ouvert ; ouvrez désormais Aevum dans votre éditeur.

Développement : `npm run player:dev` et `npm run spectator:server`. Usage normal : `npm run launch`. Adresse stable : http://127.0.0.1:5174/.
