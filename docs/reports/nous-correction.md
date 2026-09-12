# Décisions IA : options et correction bornée

Les observations proposent maintenant les actions permises par rôle, six sites de fondation accessibles par colon, les constructions disponibles et les recherches dont les prérequis sont satisfaits. Les options de dépense sont individuellement abordables, mais partagent un même budget. Le dirigeant conserve ses choix ; ces suggestions ne remplacent pas sa décision.

Avant résolution, une prévalidation sur une copie de l'état identifie les ordres illégaux. Le même modèle peut proposer une seule correction, sans voir les nouvelles décisions adverses. Une correction indisponible ne supprime pas une proposition déjà exploitable. Les erreurs de quota ou de transport ne déclenchent pas cette relance. Le moteur arbitre ensuite les actions simultanément et peut encore bloquer un déplacement ou une fondation concurrente.

Le journal conserve les motifs de correction, le nombre d'essais et leur résultat. Le mode local ne fait aucun appel supplémentaire. Les anciens journaux restent compatibles.

## Essai réel

Un conseil testé sur l'état final du pilote, sans mutation de l'original : trois réponses exploitables sur quatre, Sylve corrige quatre défenses illégales, Ambre émet un ordre de fondation, Pourpre conserve un ordre refusé et Azur rencontre un quota pendant sa correction. Il s'agit d'un essai ponctuel, pas d'une preuve d'amélioration statistique.

La branche de démonstration `df93b5b6-4b1f-4892-af96-3d16a1984de1` contient ce nouveau tour avec les réponses réelles ; le pilote initial reste à 50 tours. Détails dans `nous-correction-smoke.json`.

Validation : 497 tests réussis, TypeScript et build réussis. Prochaine évaluation utile : un pilote comparatif sur plusieurs graines avec suivi du nombre d'ordres refusés et de villes fondées.
