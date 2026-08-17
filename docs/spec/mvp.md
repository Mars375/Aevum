# Spécification MVP — AI Battle Simulator

Statut : validé · Date : 2026-08-17 · Tâche kanban : `t_d1d0df66`

## Le pitch en une phrase

Quatre modèles de langage distincts commandent chacun une faction sur une même
grille tactique ; le moteur, entièrement déterministe, résout leurs ordres et
produit un replay rejouable que l'on regarde après coup.

## Public cible

1. **Observateur curieux des capacités des modèles.** Il veut voir *comment* des
   modèles différents raisonnent face à une situation identique, pas gagner une
   partie. C'est le public principal du MVP.
2. **Praticien qui compare des modèles.** Il cherche un banc d'essai où la
   qualité de décision se lit dans un résultat concret plutôt que dans un score
   d'évaluation abstrait.

Le joueur humain n'est **pas** un public du MVP. Personne ne joue : on regarde.

## Boucle d'expérience

1. On choisit une configuration de bataille (factions, modèles, graine).
2. La bataille s'exécute hors ligne, tour par tour, et s'écrit dans un fichier
   de replay. Elle peut durer plusieurs minutes ; ce n'est pas un problème,
   personne ne la regarde en direct.
3. On ouvre le lecteur et on déroule les 12 tours : positions, ordres, dégâts,
   et surtout la justification que chaque général a donnée pour ses ordres.
4. La lecture est le produit. Contrôles de lecture, pas à pas, retour arrière,
   et l'interface doit dire sans ambiguïté **« bataille enregistrée, pas en
   direct »**.

## Périmètre du MVP

| Élément | Décision |
| --- | --- |
| Factions | 4, symétriques |
| Escouades par faction | 2 |
| Durée | 12 tours, arrêt anticipé si victoire |
| Grille | 16 × 16, sans obstacle |
| Ordres | JSON strict : `MOVE`, `ATTACK`, `HOLD` |
| Résolution | Simultanée et déterministe, dérivée d'une graine |
| Visibilité | Totale — pas de brouillard de guerre au MVP |
| Inférence | 100 % distante via OpenRouter, modèles `:free` uniquement |
| Restitution | Replay 2D en Vue 3, lecture après coup |

## Hors périmètre — explicitement

Ces éléments sont écartés du MVP et non « reportés à plus tard sans date » :

- **Brouillard de guerre, diplomatie, composition d'armée** — planifiés en
  phase 2, carte kanban `t_a5441071` déjà créée.
- **Rendu 3D et direction artistique** — planifiés en phase 3, carte
  `t_dc654ba9`.
- **Terrain, obstacles, élévation, lignes de vue.**
- **Bataille en direct dans le navigateur.** On sert des replays statiques ; le
  streaming temps réel n'apporte rien tant que chaque tour coûte plusieurs
  secondes de latence API.
- **Comptes utilisateur, classement persistant, tournoi automatisé.** Le
  protocole de tournoi est un livrable *écrit* de la tâche QA, pas du code.
- **Modèles payants.** Budget verrouillé à 0 € par le GATE.

## Différenciation

> ⚠️ **À confirmer par Loïc.** La tâche demandait de situer le projet face à
> « Project Napoleon », dont aucune trace n'existe sur cette machine (ni dans
> les notes Hermes, ni dans les dépôts, ni dans la base kanban). Les axes
> ci-dessous sont donc formulés comme des propriétés revendiquées du projet,
> pas comme une comparaison vérifiée. À réviser dès que la référence est
> fournie.

Trois propriétés que le projet tient pour non négociables :

1. **Séparation stricte entre décision et résolution.** Le modèle choisit, le
   moteur tranche. Le moteur n'émet aucun appel réseau et n'a aucune
   connaissance des modèles. Un ordre illégal est rejeté par le moteur, jamais
   « corrigé » silencieusement pour arranger le récit.
2. **Reproductibilité du moteur.** À ordres identiques et graine identique, la
   résolution est bit-à-bit identique. Seule la couche LLM est stochastique, et
   elle est intégralement journalisée — modèle réellement servi, tokens,
   latence, tentatives — pour que l'on puisse rejouer et auditer.
3. **Aucune sortie fabriquée.** Un replay livré correspond toujours à une
   exécution réelle. Les échecs d'appel, les 429 et les ordres invalides
   apparaissent dans le replay au lieu d'être maquillés.

## Métriques de réussite

Le MVP est réussi si, sur la bataille de référence :

| Métrique | Seuil |
| --- | --- |
| Bataille complète produite | 12 tours, ou victoire, sans intervention manuelle |
| Ordres valides au premier essai | ≥ 80 % des appels |
| Ordres finalement obtenus | 100 % — grâce aux replis, jamais par invention côté client |
| Reproductibilité du moteur | 100 % : deux exécutions avec les mêmes ordres et la même graine donnent des états identiques |
| Coût | 0,00 € |
| Replay | Se déroule intégralement dans le lecteur, sans erreur console |
| Fuite de secret | Aucune — vérifié par balayage du replay et des journaux |

## Backlog ajusté

Aucune carte ajoutée ni supprimée. Deux précisions apportées aux cartes
existantes par cette spec :

- La tâche **Engineering** tranche la stack : monorepo TypeScript avec npm
  workspaces (`pnpm` est absent de la machine), frontend Vue 3, schémas partagés
  via zod entre moteur, agents et lecteur.
- La tâche **Intégration** exécute la bataille de référence telle que définie
  ici : 4 factions, 2 escouades, 12 tours, graine fixée, 4 modèles distincts
  avec chaînes de repli.
