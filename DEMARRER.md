# Découvrir Aevum

Sous Windows, installez Node.js 22 ou plus récent, puis double-cliquez sur **Lancer Aevum.cmd**. Le premier lancement installe les dépendances, prépare le site et ouvre le navigateur. Gardez la fenêtre du lanceur ouverte pendant la simulation. Relancer le fichier réutilise le serveur s'il est déjà prêt.

Dans le site, **Découvrir** charge une campagne enregistrée de 50 tours, réellement jouée par quatre modèles Nous. Ce parcours ne nécessite aucune clé et ne déclenche aucun appel IA. Les indisponibilités historiques sont conservées. Les boutons de lecture parcourent l'enregistrement ; les moments importants permettent de sauter aux événements marquants.

Pour une nouvelle partie, choisissez une durée puis un mode. Le mode local utilise des règles déterministes et fonctionne sans fournisseur IA. Le mode distant appelle les modèles choisis et nécessite les clés correspondantes. Les réglages Nous peuvent être lus dans les variables d'environnement Windows. Les clés restent sur votre machine.

La campagne se sauvegarde automatiquement. Le navigateur retrouve la dernière campagne visitée. À la fin, consultez les résultats par population, villes, technologies et plans accomplis, puis recommencez avec une autre carte.

Le projet actif est `F:\Projet\Aevum`. L'ancienne copie est archivée dans `F:\Projet\Archives\Aevum-2026-09-08`. Le dossier vide `ai-battle-simulator` peut subsister tant que Codex le garde ouvert ; ouvrez désormais Aevum dans votre éditeur.

Développement : `npm run player:dev` et `npm run spectator:server`. Usage normal : `npm run launch`. Adresse stable : http://127.0.0.1:5174/.
