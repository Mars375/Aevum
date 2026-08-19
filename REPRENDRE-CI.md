# Pousser un workflow demande une permission de plus

Si un `git push` est refusé avec :

```
refusing to allow an OAuth App to create or update workflow
`.github/workflows/ci.yml` without `workflow` scope
```

ce n'est pas un problème de connexion. Le jeton GitHub ne dit pas seulement qui
vous êtes, il porte la liste de ce qu'il a le droit de faire.

`repo` suffit à pousser du code. Mais un fichier dans `.github/workflows/` n'est
pas du code ordinaire : c'est **du code que GitHub exécutera lui-même**, sur ses
machines, avec accès au dépôt et à ses secrets. D'où une permission séparée,
`workflow` — précisément pour qu'un jeton volé ne suffise pas à faire tourner du
code arbitraire sur un compte. C'est une protection, pas un caprice.

## L'obtenir

```
gh auth refresh -h github.com -s workflow
```

Ce n'est pas une reconnexion : c'est la même session à laquelle on ajoute un
droit.

**Le piège, sur une machine sans navigateur** — un Raspberry Pi en SSH, par
exemple. La commande affiche un code à usage unique puis **attend**. Il faut
ouvrir `github.com/login/device` depuis un autre appareil, y coller le code et
approuver, **sans fermer la commande**. Si l'étape n'aboutit pas, `gh` garde
l'ancien jeton : on reste « connecté », ce qui est vrai, mais sans le nouveau
droit — et rien ne le signale, sauf :

```
gh auth status
```

qui doit lister `workflow` parmi les scopes.

Sans navigateur du tout, l'alternative est un jeton personnel portant `repo` et
`workflow` (`github.com/settings/tokens`), puis `gh auth login --with-token`.

## Ce que la CI vérifie

Tout tourne **hors ligne** : la suite exerce la boucle de bataille et le monde
continu à travers `ScriptedProvider`, donc la CI n'a besoin d'aucune clé, ne
dépense aucun quota, et ne peut pas être cassée par un fournisseur qui a une
mauvaise journée. Elle ajoute deux gardes qui étaient jusque-là des
vérifications manuelles, donc oubliables : aucun motif de clé d'API dans le
diff, pour les quatre fournisseurs, et `.env` non suivi.
