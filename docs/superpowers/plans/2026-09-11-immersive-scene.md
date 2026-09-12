# Livraison de la scène immersive

Référence validée : les deux captures Project Napoleon fournies par l'utilisateur. Reprendre l'immersion et la présentation des actions, pas sa marque, sa typographie ou sa palette.

## Critères de réception

- La scène occupe la fenêtre ; les contrôles ne réduisent pas le monde à une carte dans une colonne.
- Les panneaux sont réversibles, utilisables au clavier et sur petit écran.
- Les unités et leurs étiquettes correspondent aux positions et ordres enregistrés ; aucune intention inventée.
- Les mouvements entre deux tours sont une présentation du journal, sans effet sur la résolution du moteur.
- Les événements et intentions sont lisibles sans masquer durablement la scène.
- Le cadrage, le zoom, la sélection et le retour au présent fonctionnent après un changement de tour.
- Les animations respectent la réduction des mouvements et s'arrêtent à la destruction de la scène.
- Les anciennes archives gardent leur présentation et leur comportement.

## Répartition

- Environnement et caméra : world-scene.ts.
- Étiquettes et interaction : WorldDiorama.vue et module dédié.
- Interface et responsive : Spectator.vue et spectator.css.
- Intégration : projection des identités persistantes, validation des parcours et documentation.

La validation des fournisseurs distants reste indépendante de cette livraison visuelle et nécessite des clés configurées.

## Validation du 11 septembre 2026

Les trois sous-agents ont livré leurs modifications, intégrées dans le même espace de travail. Vérification finale : 36 fichiers de tests, 482 tests réussis ; TypeScript et build réussis ; anciennes archives vérifiées hors ligne. Avertissement de taille du paquet Three.js conservé (environ 525 ko non compressés).

Parcours navigateur contrôlé sur campagne de 60 tours : sélection d'une étiquette de colons, ouverture du journal et itinéraire correspondant, masquage/rétablissement complet du HUD, retour au tour 59 et lecture vers le tour 60. Rendu inspecté à 1280×720 et dans la fenêtre utilisateur de 676×912 ; journal escamotable et commandes visibles.

Limites de cette livraison : relief périphérique décoratif, plateau jouable plan ; déplacement interpolé des modèles sans squelette de marche. La correspondance visuelle avec la référence n'est pas une reproduction de ses assets.
