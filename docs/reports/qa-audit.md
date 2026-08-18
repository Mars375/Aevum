# Audit QA — expérience et méthodologie

Statut : audité · Date : 2026-08-17 · Tâche kanban : `t_5aabd0f5`
Porte sur le commit `d9763df` et le replay `replays/reference.json`.

## Verdict en une ligne

Le MVP est techniquement solide — moteur reproductible, échecs honnêtes, aucun
secret — mais **le dispositif expérimental est cassé** : il ne mesure pas ce
qu'il prétend mesurer. Un défaut de méthode, pas d'implémentation.

## Défauts classés

### D1 — CRITIQUE · La comparaison entre modèles est confondue avec leur disponibilité

Chaque faction est liée à un modèle fixe. Un modèle souvent limité en débit ne
joue pas moins bien : **il ne joue pas du tout**, et sa faction est jouée par le
modèle de repli. Dans la bataille de référence, verdant a « gagné » avec le
modèle de crimson.

On ne mesure donc pas « quel modèle raisonne le mieux » mais « quel modèle est
disponible », et les deux sont indissociables dans le résultat actuel.

**Correctif — protocole de tournoi**, ci-dessous. Sans lui, aucune conclusion
sur les modèles n'est défendable.

### D2 — MAJEUR · Les généraux visent hors de portée en permanence

18 attaques hors portée pour 11 réussies. Les ordres sont formellement légaux,
donc ni le schéma ni la validation ne les arrêtent — ils gaspillent simplement
le tour.

La portée figure dans le prompt système une seule fois, en règle générale.
Elle n'est pas rappelée **par escouade au moment de l'ordre**.

**Correctif :** faire figurer dans la vue locale, pour chaque escouade, la liste
explicite des cibles actuellement à portée. Coût : quelques lignes dans
`userPrompt`. À re-mesurer sur une bataille complète.

### D3 — MAJEUR · `max_tokens` calibré sur le mauvais moment de la partie

3000 a été calibré sur des prompts de tour 1. En milieu de partie, la position
est plus riche, les modèles à raisonnement dépensent davantage, et la troncature
réapparaît : crimson a épuisé ses deux essais sur `finish_reason=length` en
pleine bataille.

**Correctif :** porter `ABS_MAX_TOKENS` à 6000. Le classement en erreur
réessayable, lui, a bien fonctionné — c'est le plafond qui est trop bas, pas la
logique.

### D4 — MOYEN · Aucune reprise après interruption

Une bataille interrompue au tour 9 est intégralement perdue : `runBattle` garde
tout en mémoire et n'écrit qu'à la fin. Avec des batailles de 30 à 40 minutes et
un palier gratuit instable, c'est une perte réelle.

**Correctif :** écrire le replay après chaque tour plutôt qu'à la fin, et
accepter un replay partiel en entrée pour reprendre au tour suivant. Le format
n'a pas besoin de changer — un replay partiel est un replay avec moins de tours.

### D5 — MOYEN · La latence n'est pas visible pendant l'exécution

Latence médiane de 58 s, maximum 179 s. Le CLI n'affiche rien entre le début
d'un appel et sa fin : pendant trois minutes, l'exécution paraît figée.

**Correctif :** afficher le modèle et le tour en cours avant l'appel, pas
seulement après.

### D6 — MINEUR · Les captures d'écran du lecteur n'ont pas pu être produites

Chromium headless n'aboutit pas sur ce Raspberry Pi (délai dépassé à 5 minutes),
et le MCP Playwright réclame un binaire Chrome absent. **L'audit visuel du
lecteur repose donc sur relecture du code et vérification analytique du
contraste, pas sur un rendu observé.** À refaire sur une machine capable, avant
toute communication publique s'appuyant sur des visuels.

C'est une limite de cet audit, pas un défaut du produit — mais elle doit être
énoncée plutôt que passée sous silence.

## Accessibilité — vérifié

Contraste calculé sur la palette livrée (WCAG 2.1, seuil AA texte normal 4.5:1) :

| Paire | Ratio | AA |
| --- | --- | --- |
| texte sur fond | 19,28 | ✅ |
| texte sur carte | 17,77 | ✅ |
| justification sur carte | 12,52 | ✅ |
| accent sur fond | 12,08 | ✅ |
| amber sur carte | 11,14 | ✅ |
| verdant sur carte | 10,67 | ✅ |
| azure sur carte | 7,31 | ✅ |
| muet sur carte | 7,25 | ✅ |
| crimson sur carte | 6,72 | ✅ |

**10 paires sur 10 passent**, la plus faible à 6,72 — soit une marge de 49 % sur
le seuil.

**Le point non évident :** les quatre couleurs de faction ont des luminances
presque identiques. Verdant contre amber donne un ratio de **1,04**, crimson
contre azure **1,09**. Elles ne se distinguent que par la teinte, et sont donc
**indiscernables en niveaux de gris comme pour une bonne partie des daltonismes**.

C'est précisément pourquoi la faction n'est jamais portée par la couleur seule :
initiale de faction sur chaque escouade, forme différente par archétype (carré
en mêlée, rond à distance), et préfixe textuel sur chaque ligne du journal. La
mesure confirme après coup que cette redondance n'était pas décorative — sans
elle, la grille serait illisible pour ces lecteurs.

Autres points vérifiés par relecture : anneaux de focus jamais supprimés,
cibles tactiles à 44 px, `prefers-reduced-motion` respecté, région `aria-live`
annonçant le tour, libellés `aria-label` sur tous les boutons de transport,
passage en colonne unique sous 900 px, grille en `aspect-ratio: 1`.

## Biais — évaluation demandée par la carte

| Source de biais | Verdict | Fondement |
| --- | --- | --- |
| **Graine** | Aucun | Le ruleset v1 ne consomme aucun aléa. L'invariant `I9` vérifie que le compteur du générateur reste à 0. |
| **Ordre des factions** | Aucun | L'invariant `I6` vérifie que permuter les factions ne change ni l'état ni le journal. Les escouades sont parcourues en ordre canonique d'`id`. |
| **Position de départ** | Aucun | Déploiement symétrique par réflexion. En distance de Chebyshev, **toutes les paires de factions sont à distance 11** — y compris les diagonales. Aucun coin n'est avantagé. |
| **Prompts** | Aucun | Prompt système identique pour tous ; seule change l'identité de la faction. |
| **Quotas et retries** | **BIAIS MAJEUR** | Voir D1. C'est le biais dominant, il écrase tous les autres. |
| **Asymétrie d'archétypes** | Aucun | Chaque faction aligne exactement une escouade de chaque archétype. |

Cinq sources de biais sur six sont éliminées par construction et vérifiées par
des tests. La sixième invalide l'expérience à elle seule.

## Protocole de tournoi reproductible

Pour que « quel modèle commande le mieux » devienne une question à laquelle ce
projet peut répondre :

1. **Faire tourner les affectations.** Avec 4 modèles et 4 factions, jouer les
   4 rotations cycliques. Chaque modèle occupe chaque position une fois, ce qui
   annule tout résidu positionnel.
2. **Ne retenir que les batailles propres.** Une bataille où un modèle a été
   servi moins de 100 % du temps par son modèle assigné est **écartée du
   classement**, pas rattrapée. Le repli reste en place pour terminer la partie,
   mais le résultat n'entre pas dans la comparaison.
3. **Journaliser le taux de service par modèle.** Un modèle servi 30 % du temps
   n'a pas « mal joué » : il n'a pas joué. Les deux doivent être visuellement
   distincts dans tout classement.
4. **Fixer la graine par rotation** et la consigner dans le manifest — déjà fait.
5. **Rejouer chaque replay à travers le moteur** avant de compter le résultat.
   Vérifié à 0 divergence sur la bataille de référence ; à automatiser en porte
   du tournoi.
6. **Refaire le tournoi entier après tout changement de prompt ou de plafond de
   tokens.** D2 et D3 modifieront les résultats ; mélanger les régimes rendrait
   le classement ininterprétable.

Conséquence honnête à assumer : sur le palier gratuit actuel, la condition 2
écarterait probablement la majorité des batailles. **Un tournoi défendable coûte
vraisemblablement de l'argent** — ce qui est une décision humaine, pas une
décision technique.

## Sécurité

| Contrôle | Résultat |
| --- | --- |
| Secrets dans le replay livré | Aucun (`sk-or-`, `OPENROUTER_API_KEY`, `Bearer `, `/home/`) |
| Secrets dans les prompts | Aucun — test automatisé dans `agents.test.ts` |
| `.env` versionné | Non — ignoré par `.gitignore`, seul `.env.example` est suivi |
| Clé dans les journaux | Non — circule uniquement dans l'en-tête `Authorization` |
| Plafond budgétaire | Modèle payant refusé **avant** l'appel réseau, vérifié par un test qui s'assure que `fetch` n'est jamais appelé |
| Justification démesurée | Tronquée à 2000 caractères avant d'entrer dans le replay |

## Priorité des correctifs

| Ordre | Défaut | Effort | Débloque |
| --- | --- | --- | --- |
| 1 | D3 — `ABS_MAX_TOKENS` à 6000 | une ligne | Fiabilité immédiate |
| 2 | D2 — cibles à portée dans le prompt | quelques lignes | Qualité tactique |
| 3 | D4 — replay écrit à chaque tour | modéré | Batailles longues |
| 4 | D1 — protocole de tournoi | important | **La question de départ du projet** |
| 5 | D5 — journal avant appel | trivial | Confort |
| 6 | D6 — captures sur machine capable | externe | Communication |

D3 et D5 sont assez petits pour être faits tout de suite. D1 demande une
décision humaine sur le budget avant d'être codé.
