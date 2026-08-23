# Aevum — Chronique des mondes

Four language models govern four civilisations in a world that does not end —
and, in the older rulesets, command four factions on a tactical grid. A
deterministic engine does everything else, and writes a record you can replay.

Nobody plays. You watch, and you read why each ruler decided what it did.

Release candidate **R1 / 0.2.0** is prepared in this tree and is not published.

## Verifying the Season 1 candidate

The release gate is offline and rebuilds its evidence before checking it:

```
npm ci
npm run season-report -- worlds/aevum-season-1/era-0001.json worlds/aevum-season-1/era-0001.learning.json --out=docs/reports/aevum-season-1.md
npm run build-reports
npm run index-worlds
npm run verify-season-1
```

`verify-season-1` replays the journal and validates its fingerprint, metric
source and service rates, generated links and indexes, rename inventory and
secret boundaries. A success proves the committed scripted artefact locally; it
does not prove that a remote model governed the era. The complete evidence and
open limits are recorded in
`docs/reports/aevum-season-1-verification.md`. Publishing, tagging and renaming
the remote are separate release actions and are deliberately not performed by
this gate.

## From clone to a living world

```
npm install
cp .env.example .env             # one provider key is enough; all four are free
npm run live -- --ticks 100 --silent   # a century, no model, no network, no key
npm run live -- --ticks 40             # the same world, governed by real models
npm run player:dev                     # open it in the browser, "Chronique" tab
```

The `--silent` run is the honest first step: it exercises the whole engine
without a key and without a single call, so a broken install fails in seconds
rather than after a quota.

A world lives in `worlds/<name>/era-NNNN.json` and resumes wherever it stopped —
running out of quota is the normal way a session ends, not a failure. To let it
advance on its own, `deploy/install-timer.sh` installs a nightly pass (and
`--remove` takes it back out).

## Battles, the older question

```
npm run battle -- --scripted     # offline baseline, no key, no network
npm run battle                   # ruleset v1: four remote models, ~7 minutes
npm run battle -- --ruleset v2   # army budget, fog of war, bounded diplomacy
npm run battle -- --resume       # continue an interrupted battle
```

## Measuring without spending

Every design claim in `docs/` was measured, and most of the measurements cost
nothing:

```
npm run world:probe              # how many calls a world would need. Zero spent
npm run era-report worlds/monde/era-0001.json   # read an era back
npm run eras -- --ticks 120      # rotate the models across positions. Costs calls
npm test                         # full test suite, all offline
```

## How it is put together

| Package | Does | Never does |
| --- | --- | --- |
| `@abs/contracts` | zod schemas shared by everything | import the engine, the network or Vue |
| `@abs/engine` | resolves a turn, decides the outcome | make a single network call |
| `@abs/world` | ticks the continuous world, detects decision points | make a single network call |
| `@abs/agents` | talks to the four providers, drives the battle and world loops | decide who wins |
| `@abs/cli` | runs a battle, writes the replay | — |
| `@abs/player` | Vue 3 replay viewer, 2D grid and optional 3D | run the engine |

The split that matters: **the model decides, the engine resolves.** An illegal
order is rejected and recorded, never quietly rewritten into something workable.
That is what makes a replay auditable.

The second split, which the continuous world rests on: **the engine ticks
continuously and for free; a model is consulted only at decision points.** One
call per civilisation per tick would spend a day's free quota in minutes, and a
world that stops for want of quota is not continuous. Measured: about 18× fewer
calls than asking every year.

## Six things the measurements forced

Every one of these was a wrong first guess corrected by evidence
(`docs/research/providers.md`, `docs/reports/qa-audit.md`):

1. **Do not require native structured output.** Only 6 of 16 free models
   advertise it, and requiring it collapsed the roster onto two models — one
   model then decided 62.5% of a whole battle. The other 10 answer JSON fine
   when asked in the prompt. Proof it was the wrong filter:
   `openai/gpt-oss-20b` scores **0/4 with** server-side schema enforcement and
   **2/2 without**, same prompt.
2. **`max_tokens` must cover reasoning tokens.** At 800, six of seven models
   returned unparseable JSON and looked incapable of structured output. They
   were truncated — reasoning tokens are billed against the completion budget
   before the first brace. 3000 cleared a turn-1 prompt and still truncated
   mid-battle; the ceiling is 6000. `finish_reason: length` is a retryable
   failure, never a malformed answer.
3. **State the rules per squad, not once as general rules.** The generals
   produced 18 out-of-range attacks against 11 hits, and illegal moves, while
   knowing the rules perfectly well. Listing each squad's reachable targets and
   its legal move box took both counts to **zero**.
4. **Use four providers.** OpenRouter, Groq, NVIDIA and Mistral rate-limit
   independently, and every fallback chain spans all four. This is not
   redundancy for its own sake: a 12-rotation tournament collapsed to **0%**
   service after roughly 350 calls on a single tier. Groq also cuts median
   latency from 58 s to 3 s, turning a 40-minute battle into a 7-minute one.
5. **The free tier is a call budget, not a time budget.** Reasoning that 12
   rotations cost 90 minutes and are therefore free was wrong — 183 calls pass,
   558 do not. Any protocol that counts minutes yields clean data first and
   noise afterwards.
6. **Read the rate-limit headers.** We were rationing ourselves: Groq reserves
   the full `max_tokens` against an 8000-per-minute token budget, so asking for
   6000 allowed exactly **one call a minute** and produced twelve HTTP 429s in
   one battle. Groq now asks for 2000, every response's headers are parsed, a
   429 waits as long as the provider actually said instead of a flat 500 ms,
   and a drained bucket costs a hop to another provider rather than a minute of
   idling. Measured: **8 calls in 21 s, 8 successes**, where the same chain
   previously failed 40 % of the time.

When a whole chain fails, the squads hold and the replay says
`GENERAL_UNREACHABLE`. The client never invents an order to cover the gap.

## What the tournament measures

Wins, and two things that are less noisy than winning:

- **accuracy** — attacks landed over attacks attempted, read from the replay.
- **fidelity** — the share of a general's report claims the replay confirms.

A win leans heavily on luck and on whichever quota happened to hold. Fidelity
does not: it measures whether a model can give a true account of what it
actually did. Two models can win equally often and differ completely here.

Both are reported beside wins, never folded into them, and a model that never
played a full battle on its own model is reported NOT RANKED rather than last.

## Two rulesets

`v1` is frozen. `v2` extends it, and both are playable — the engine picks from
the manifest, so a replay recorded a month ago still resolves the same way. A
test asserts it (`I20`): MELEE and RANGED keep their exact v1 numbers, v1
deployment tiles are unchanged, and the alliance lookup is simply absent at v1.

| | v1 | v2 |
| --- | --- | --- |
| Army | imposed, 1 MELEE + 1 RANGED | bought on a 20-point budget, up to 4 squads |
| Units | MELEE, RANGED | + SCOUT (cheap, sees 9) and HEAVY (tanky, nearly blind) |
| Visibility | total | fog of war, with remembered sightings |
| Diplomacy | none | four verbs, at most one action per turn |
| Victory | last faction standing | + joint alliance win, + surrender |
| Factions | identical | four traits, every bonus paid for by a malus |
| After the battle | nothing | each general writes an account, checked against the replay |

Three v2 decisions worth knowing:

- **You can watch through one general's eyes.** The player's default view is
  omniscient, which is more than any general ever saw. Pick a faction and it
  shows only what that faction could see, with everything else it once saw drawn
  faded and dated at its last known position. Shareable: `?view=amber&turn=7`.
- **Fog lives entirely in the view projection.** The v1 architecture note
  promised phase 2 would only have to filter there, and it held — the engine,
  the resolution rules and the replay format are untouched by v2 visibility. A
  general acts on beliefs; orders still resolve against the real state, so
  attacking a remembered tile can hit empty ground.
- **A betrayal is never instant.** `BREAK_ALLIANCE` bites at the end of the
  *following* turn and the ally is told immediately. That delay is the whole
  reason an alliance means anything.
- **Memory is built by the engine, from events it emitted.** Never by a model,
  so it cannot hallucinate a past, and capped at 8 entries so token cost does
  not grow with battle length.

## Budget

Locked at **0 €** by the launch gate.

On OpenRouter this is enforced in code: a model id without a `:free` suffix is
refused *before* the request is made. On Groq and NVIDIA it **cannot** be —
neither has a per-model free/paid marker, because on both the free tier is a
property of the account, not of the model. An account with no payment method is
rate- or credit-limited rather than billed, and that is where the guarantee
actually comes from. Stated plainly rather than implied.

## Determinism

Same orders and same seed give the same states, bit for bit. The engine takes no
clock, no network and no global state, and ruleset v1 consumes no randomness at
all — damage and deployment are fixed. A test asserts the seeded generator is
never called, so the day a rule starts rolling dice, it fails loudly.

The practical payoff: replaying the recorded orders through the engine
reproduces the recorded states, so a battle can be verified without calling a
single model again. That round trip is a test
(`packages/engine/test/replay.test.ts`).

## Docs

| Document | Contents |
| --- | --- |
| `docs/spec/mvp.md` | Scope, audience, what is deliberately out |
| `docs/spec/rules.md` | Ruleset v1 — the engine's source of truth, with 11 invariants |
| `docs/spec/rules-v2.md` | Ruleset v2 — budget, fog, diplomacy, and 9 more invariants |
| `docs/spec/release-r1.md` | Product and experience brief for the R1 / 0.2.0 candidate |
| `docs/spec/reports.md` | Battle reports, and why the replay grades them instead of a model |
| `docs/spec/visual-identity.md` | The 3D view, and why 2D stays the default |
| `scripts/screenshot.sh` | Capture the deployed player at 375, 900 and 1440 px |
| `docs/architecture/data-contracts.md` | Why the schemas are shaped the way they are |
| `docs/research/providers.md` | Model measurements and the roster they justify |
| `docs/reports/reference-battle.md` | The delivered battle, and four runs of measurements |
| `docs/reports/qa-audit.md` | Defects found, what was fixed, what is still open |
| `docs/reports/tournament.md` | Which model commands best, and what the ranking cannot say |
| `docs/reports/release-r1-verification.md` | Commands, observed results and remaining limits for the R1 candidate |
| `docs/migrations/aevum-rename.md` | Public rename inventory, compatibility guarantees and migration notes |

## Continuous integration

Every check runs **offline**. The whole suite exercises the battle loop through
`ScriptedProvider`, so CI needs no API key, spends no quota, and cannot be
broken by a provider having a bad day — the reason that provider was worth
building in the first place.

It also fails the build if an API key pattern appears in the diff, or if `.env`
ever becomes tracked. That turns a check I had been running by hand before
every commit into one that cannot be forgotten.

## Commands

| Command | Does |
| --- | --- |
| `npm test` | Offline suite: engine invariants, replay round-trip, provider routing, regression tests for every fixed defect |
| `npm run typecheck` | `tsc --noEmit` across the workspace |
| `npm run battle -- --scripted` | Offline battle with the baseline AI |
| `npm run battle` | Remote battle, four free models, ~7 minutes |
| `npm run battle -- --ruleset v2` | Same, with army budget, fog of war and diplomacy |
| `npm run battle -- --ruleset v2 --reports` | …and each general accounts for the battle, audited against the replay |
| `npm run battle -- --resume` | Continue the replay at `--out` instead of restarting |
| `npm run probe` | Re-measure the free-model catalogue |
| `npm run tournament` | 4 rotations ranking the four contenders on wins, accuracy and report fidelity. Resumes: rotations already completed are reloaded, not replayed |
| `npm run balance` | Play hundreds of scripted battles offline and report the outcome distribution |
| `npm run healthcheck` | Container and clone liveness |
| `npm run season-report -- <journal> <sidecar> --out=<report>` | Rebuild a season report from its journal and metric sidecar |
| `npm run verify-season-1` | Replay and validate the complete local Season 1 release candidate without model calls |
| `npm run index-replays` | Rebuild the catalogue the player's replay picker lists |
| `npm run player:dev` | Replay viewer on :5173 |
| `docker compose up -d --build` | Serve the player and `./replays` on :8088 |

## Configuration

Copy `.env.example` to `.env`. Credentials are `OPENROUTER_API_KEY`, `GROQ_API_KEY`,
`NVIDIA_API_KEY` and `MISTRAL_API_KEY`; at least one is required, and all four
make the roster meaningfully more robust. Neither ever leaves the
`Authorization` header — prompts carry public battlefield state and nothing
else, and a test fails if a key pattern appears in a URL, a request body, or a
replay.

Models are referenced by provider: a bare id goes to OpenRouter
(`google/gemma-4-26b-a4b-it:free`), a `groq:` prefix goes to Groq
(`groq:openai/gpt-oss-120b`), an `nvidia:` prefix goes to NVIDIA build
(`nvidia:meta/llama-3.3-70b-instruct`), a `mistral:` prefix to Mistral
(`mistral:mistral-large-latest`).
