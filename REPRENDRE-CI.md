# Remettre l'intégration continue

Le workflow GitHub Actions est écrit, testé, et **volontairement absent du dépôt** :
GitHub refuse tout push qui crée ou modifie `.github/workflows/` si le jeton n'a
pas le scope `workflow`, et ce commit était le plus ancien des vingt-sept en
attente — il bloquait donc tout le reste.

Le choix a été de pousser les vingt-six autres et de différer celui-ci, plutôt
que de laisser vingt-sept commits de travail réel n'exister que sur une seule
machine.

## Ce qu'il reste à faire

1. Obtenir le scope, par l'une des deux voies :

   ```
   gh auth refresh -h github.com -s workflow
   ```

   Sur une machine sans navigateur, la commande affiche un code à usage unique
   et attend : il faut ouvrir `github.com/login/device` depuis un autre appareil
   et y coller le code **sans fermer la commande**. Sinon, créer un jeton
   personnel avec `repo` et `workflow` sur `github.com/settings/tokens`, puis
   `gh auth login --with-token`.

2. Vérifier : `gh auth status` doit lister `workflow` parmi les scopes.

3. Remettre le fichier et le pousser :

   ```
   mkdir -p .github/workflows
   cp <sauvegarde>/ci.yml .github/workflows/ci.yml
   git add .github/workflows/ci.yml
   git commit -m "ci: run the checks nobody was running"
   git push
   ```

Le contenu du workflow est reproduit ci-dessous, pour qu'il ne dépende d'aucun
fichier temporaire.

## Le workflow

```yaml
name: CI

# Every check here runs OFFLINE. The whole test suite exercises the battle loop
# through ScriptedProvider, so CI needs no API key, spends no quota, and cannot
# be broken by a provider having a bad day. That property is the reason the
# scripted provider was worth building.
on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # Two commits, so the secret scan below can diff against the parent.
          fetch-depth: 2

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Tests
        run: npm test

      - name: Build the player
        run: npm run player:build

      - name: Healthcheck
        # Advisory network check inside; it never fails the build on its own.
        run: npm run healthcheck

      - name: No API key in the diff
        # Turns the check I have run by hand before every commit into something
        # that cannot be forgotten. Patterns for all four providers.
        run: |
          if git diff HEAD~1 HEAD | grep -nE 'sk-or-v1-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{30,}|nvapi-[A-Za-z0-9_-]{30,}|MISTRAL_API_KEY=[A-Za-z0-9]{20,}'; then
            echo "::error::An API key pattern appears in this diff."
            exit 1
          fi
          echo "No key pattern found."

      - name: .env is not tracked
        run: |
          if git ls-files --error-unmatch .env 2>/dev/null; then
            echo "::error::.env is tracked by git."
            exit 1
          fi
          echo ".env is untracked, as it should be."
```
