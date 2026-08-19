---
name: run-tournament
description: Check the preconditions a tournament actually depends on, then run it. Use before spending ~200 API calls on a ranking.
disable-model-invocation: true
---

# Run a tournament

A tournament costs roughly 200 calls and forty minutes. One has already been
spent producing a ranking of a single contender, because three primaries were
never served. Everything below is a precondition that failure taught.

## 1. Check the providers, and read the answer

```bash
cd ~/git/ai-battle-simulator && set -a && . ./.env && set +a
for p in "OpenRouter|https://openrouter.ai/api/v1/chat/completions|$OPENROUTER_API_KEY|google/gemma-4-26b-a4b-it:free" \
         "Groq|https://api.groq.com/openai/v1/chat/completions|$GROQ_API_KEY|openai/gpt-oss-120b" \
         "NVIDIA|https://integrate.api.nvidia.com/v1/chat/completions|$NVIDIA_API_KEY|meta/llama-3.3-70b-instruct" \
         "Mistral|https://api.mistral.ai/v1/chat/completions|$MISTRAL_API_KEY|mistral-large-latest"; do
  IFS='|' read -r name url key model <<< "$p"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -X POST "$url" \
    -H "Authorization: Bearer $key" -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":5}")
  printf '  %-12s HTTP %s\n' "$name" "$code"
done
```

**A 429 on any provider hosting a PRIMARY is a stop.** That contender will play
zero turns and the tournament will rank three models at best. Either wait for
the quota, or move that primary in `packages/agents/src/roster.ts` — the tests
enforce that no primary sits on a dead provider and that no primary appears in
another faction's chain.

## 2. Confirm the roster still holds its rules

```bash
npx vitest run packages/agents/test/endpoints.test.ts
```

## 3. Run it

```bash
npm run tournament                              # 4 rotations, seed 42, with reports
ABS_TOURNAMENT_REPORTS=0 npm run tournament     # skip reports when quota is tight
ABS_TOURNAMENT_RESTART=1 npm run tournament     # ignore completed rotations on disk
```

Completed rotations are reloaded rather than replayed, so an interrupted run
resumes for free. Partial checkpoints, mismatched seeds and mismatched rulesets
are never reused.

## 4. Read the result honestly

The service-rate table comes before the ranking for a reason. A contender served
below 100% has **no clean rotation** and is reported NOT RANKED — that is a
finding about availability, not about tactics, and must not be read as a poor
placing.

Fidelity in brackets shows how many rotations it could be measured on. One
sample is not a trend.

If more than one contender is unranked, the tournament measured quotas rather
than models. Say so plainly rather than publishing the table.
