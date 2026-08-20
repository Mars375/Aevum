---
name: nouvelle-regle
description: La procédure complète d'un changement de règles du monde continu. À suivre dès qu'une modification change ce que le moteur produit — un rendement, une catastrophe, une règle de conquête. Cinq pas, dont au moins un a été oublié à chaque changement passé.
user-invocable: false
---

# Changer les règles du monde

Une modification qui change **ce que le moteur produit** n'est pas une
modification ordinaire : elle rend les mondes déjà vécus non rejouables, et
périme les mesures écrites à partir d'eux. Les quatre versions w1 à w4 ont
chacune oublié au moins un de ces pas.

Ceci ne s'applique pas à un correctif de bug — là, le but est justement que le
monde produise ce qu'il aurait toujours dû produire.

## 1. Verser la version

`WORLD_VERSION` dans `packages/world/src/state.ts`. Même discipline que I20 dans
les règles de bataille : **une course enregistrée doit continuer à vouloir dire
ce qu'elle voulait dire.** Les journaux des versions passées restent sur le
disque comme archives ; `live.ts` et `index-worlds.ts` refusent de les rejouer,
et le lecteur affiche sous quelles règles ils ont vécu.

Écrire dans le commentaire de `WORLD_VERSION` ce que la nouvelle version change,
en une phrase.

## 2. Mesurer que l'économie d'appels tient toujours

```
npm run world:probe 400
```

Le facteur d'économie doit rester au-dessus de 15×. Il est déjà tombé à 1,3×
sans que rien ne le signale, parce qu'une règle relevait une décision chaque
année sur un état que son propre dirigeant venait de traiter.

Regarder aussi la répartition des types de décision : si un seul type dépasse
60 %, le monde ne pose plus qu'une question.

## 3. Mesurer ce qu'une mesure pourra prouver

```
npm run board-fairness 24 120
```

Le bruit du plateau change quand les règles changent. Une comparaison entre
modèles n'a de sens qu'au-dessus de ce plancher, et c'est lui qui décide combien
de courses une rotation devra faire.

## 4. Faire vivre un monde muet, longtemps

```
npm run live -- --ticks 400 --silent --world essai
npm run era-report worlds/essai/era-0001.json
```

Gratuit, et c'est là qu'on voit une règle dérailler à l'échelle : une
civilisation éteinte qui tenait encore treize lieux, un équilibre qui ne se
rompt jamais, une population qui s'effondre au tour 12. Vérifier que quelque
chose se passe encore après l'an 150, quand le plateau se remplit.

## 5. Écrire les règles, puis archiver

`docs/spec/world-wN.md` : ce que la version ajoute, **et le défaut qui l'a
enseigné** quand il y en a un. Renommer le fichier, et corriger les liens qui le
citent.

Enfin, faire remonter au timer nocturne (`deploy/ai-battle-world.service`) le
nom d'un monde vivant sous les nouvelles règles — sinon la passe échoue chaque
nuit sur un monde archivé, ce qui est déjà arrivé.
