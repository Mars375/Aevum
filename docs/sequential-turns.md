# Tours successifs — spectator-4

Une manche comprend le tour de chaque civilisation encore vivante : Ambre, Azur, Pourpre puis Sylve. Le dirigeant suivant observe les changements déjà résolus. Une action du journal correspond à un tour individuel ; la durée choisie à la création correspond à des manches complètes.

Seule la civilisation active déplace ses unités, produit, consomme, recherche et avance ses chantiers. Les défenseurs peuvent subir et infliger des pertes en combat. Météo et trêves utilisent les manches, pas le compteur des actions. Les propositions de paix ou de commerce restent disponibles pour la réponse du partenaire et expirent après huit manches.

Chaque unité reçoit son budget à son propre tour : civils 2 points, armées 3, marchands 4. Plaine : 1 point. Forêt, colline et rivière : 2 points. Un trajet long continue aux prochains tours de son propriétaire. Le moteur conserve les cases réellement parcourues et les points dépensés ; l'animation suit ce chemin sans couper les virages. Un assaut paie l'entrée sur la case cible avant le combat.

Les nouveaux mondes naissent avec les dernières règles et présélectionnent le principal des modèles retenus pour leur stabilité (`stable-models.ts`), ou celui d'`AEVUM_COUNCIL_MODEL`. Les quatre dirigeants utilisent des observations et des décisions indépendantes, même si le modèle est identique. Le mode distant est proposé par défaut lorsque la clé Nous est configurée. Chaque appel vérifie le tarif gratuit dans le catalogue. Une réponse indisponible conserve le dirigeant actif pour réessayer ; en direct, le service le redemande avec des délais croissants, puis suspend le direct en le disant. Aucune substitution locale silencieuse.

Validation : quatre appels successifs réels à Longcat ont produit une manche complète, avec zéro ordre rejeté et rejeu exact. Cela vérifie l'intégration, sans garantir la disponibilité future du fournisseur. Trois simulations locales de quarante manches se terminent sans ordre rejeté ; les campagnes sauvegardées des versions précédentes se rejouent exactement. Voir sequential-local-verification.json et sequential-remote-verification.json.

Les versions spectator-1 à spectator-3 conservent leur fonctionnement historique simultané. Il faut créer une nouvelle campagne pour les tours successifs. Le bouton Découvrir lit encore la campagne Nous historique enregistrée, explicitement identifiée comme replay.

Limites actuelles : stocks nationaux partagés, accords commerciaux internationaux abstraits, pas de transport naval ni d'arbre complet d'unités. Le carnet préparé pour Linear décrit les prochaines évolutions ; leur création distante attend un accès Linear.
