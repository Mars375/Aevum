---
name: mesurer
description: Lance une mesure comparative entre modèles — préflight, estimation du coût, rotation entrelacée, lecture appariée. À utiliser quand on veut savoir quel modèle gouverne le mieux.
disable-model-invocation: true
---

# Mesurer quel modèle gouverne le mieux

Une rotation coûte environ 200 appels. Trois mesures de ce projet ont été
perdues faute d'avoir vérifié l'instrument avant de payer. Cette procédure met
les vérifications avant la dépense, dans l'ordre où elles coûtent le moins.

## 1. Vérifier l'instrument — 4 appels

```
npm run preflight
```

Chaque modèle du roster reçoit une vraie question de dirigeant, **seul dans sa
chaîne** pour qu'aucun repli ne le couvre. Il faut 4 sur 4. À 3 sur 4, la course
mesurerait la chaîne de repli d'un modèle et pas le modèle ; le plus souvent
c'est un plafond quotidien qui se réinitialise dans quelques heures, et attendre
coûte moins cher que recommencer.

## 2. Décider ce qu'on mesure — avant de voir les résultats

Lieux tenus, population et progrès techniques donnent **trois classements
différents**. Choisir après coup est le biais le plus facile à commettre sans
s'en apercevoir. Écrire la métrique retenue dans le rapport avant de lancer.

## 3. Lancer

```
npm run eras -- --ticks 60 --rotations 4 --seeds 1789,1848,1871
```

Le script imprime le coût attendu, l'erreur type et l'écart minimal croyable
**avant** de dépenser. Si ce dernier est plus grand que la différence qu'on
espère voir, la course ne prouvera rien : ajouter des graines plutôt que des
années — le bruit du plateau croît avec l'horizon.

Les courses sont entrelacées, donc un quota qui se tarit frappe toutes les
rotations également au lieu de détruire la dernière. Le script s'arrête de
lui-même si un modèle passe sous la moitié de ses propres décisions, et reprend
là où il s'est arrêté à la relance.

## 4. Lire en tenant compte de l'appariement

```
npm run rank-eras
```

Dans une course, les quatre modèles partagent le même monde : les comparer là
supprime la variance du plateau, ce que la comparaison des moyennes ne fait pas.
Un écart n'est croyable qu'au-delà de deux erreurs types.

## 5. Écrire, puis faire relire

Le rapport va dans `docs/reports/`, avec la part servie par chaque modèle
lui-même — sous 70 %, un modèle n'est pas classable — et les limites écrites
d'avance. Faire relire par l'agent `measurement-critic` avant de conclure quoi
que ce soit.
