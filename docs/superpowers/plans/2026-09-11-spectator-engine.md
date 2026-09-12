# Implémentation du moteur spectateur

La spécification du 10 septembre est validée par l'utilisateur. Préserver le lecteur et les règles historiques pendant la construction du nouveau moteur.

- [x] Contrats et résolution autonome des ordres de déplacement/défense ; missions persistantes, rejet explicite, collisions simultanées et tests.
- [x] Combat simultané, logistique, ordres civils et diplomatiques.
- [x] Événements mondiaux déterministes annoncés avant arbitrage et effets temporaires.
- [x] Nouvelle version de journal : collecte sur état figé, reprises et rejeu.
- [x] Adaptateurs IA, observations, Nous optionnel et refus des tarifs non vérifiables.
- [x] Service local et interface spectateur : intentions, routes, résultats, lecture et avancement réel.
- [x] Validation locale : 482 tests, TypeScript, build, archives ; 12 graines de 300 tours rejouables et parcours navigateur de 60 tours.
- [ ] Validation réelle des fournisseurs : nécessite une clé configurée. Les tests actuels utilisent des réponses simulées ; la gratuité effective de Nous reste à confirmer avec le catalogue du compte.

Le moteur spectateur est intégré et indépendant de tickWorld. Les archives w10 conservent leur comportement. Voir `docs/spectator.md` pour le lancement, les règles implémentées et les limites explicites.
