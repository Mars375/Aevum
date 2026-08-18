# AI Battle Simulator

Four language models each command a faction on a 16×16 tactical grid. A
deterministic engine resolves their orders and writes a replay you watch
afterwards.

Nobody plays. You watch — and you read why each general gave the orders it did.

```
npm install
npm run battle -- --scripted     # offline baseline, no key, no network
npm run battle                   # ruleset v1: four remote models, ~7 minutes
npm run battle -- --ruleset v2   # army budget, fog of war, bounded diplomacy
npm run battle -- --resume       # continue an interrupted battle
npm run player:dev               # open the replay in the browser
```

## How it is put together

| Package | Does | Never does |
| --- | --- | --- |
| `@abs/contracts` | zod schemas shared by everything | import the engine, the network or Vue |
| `@abs/engine` | resolves a turn, decides the outcome | make a single network call |
| `@abs/agents` | talks to the three providers, drives the battle loop | decide who wins |
| `@abs/cli` | runs a battle, writes the replay | — |
| `@abs/player` | Vue 3 replay viewer, 2D grid and optional 3D | run the engine |

The split that matters: **the model decides, the engine resolves.** An illegal
order is rejected and recorded, never quietly rewritten into something workable.
That is what makes a replay auditable.

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
4. **Use three providers.** OpenRouter, Groq and NVIDIA rate-limit
   independently, and every fallback chain spans all three. This is not
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
| `docs/spec/reports.md` | Battle reports, and why the replay grades them instead of a model |
| `docs/spec/visual-identity.md` | The 3D view, and why 2D stays the default |
| `docs/architecture/data-contracts.md` | Why the schemas are shaped the way they are |
| `docs/research/providers.md` | Model measurements and the roster they justify |
| `docs/reports/reference-battle.md` | The delivered battle, and four runs of measurements |
| `docs/reports/qa-audit.md` | Defects found, what was fixed, what is still open |
| `docs/reports/tournament.md` | Which model commands best, and what the ranking cannot say |

## Commands

| Command | Does |
| --- | --- |
| `npm test` | 153 tests: engine invariants, replay round-trip, provider routing, regression tests for every fixed defect |
| `npm run typecheck` | `tsc --noEmit` across the workspace |
| `npm run battle -- --scripted` | Offline battle with the baseline AI |
| `npm run battle` | Remote battle, four free models, ~7 minutes |
| `npm run battle -- --ruleset v2` | Same, with army budget, fog of war and diplomacy |
| `npm run battle -- --ruleset v2 --reports` | …and each general accounts for the battle, audited against the replay |
| `npm run battle -- --resume` | Continue the replay at `--out` instead of restarting |
| `npm run probe` | Re-measure the free-model catalogue |
| `npm run tournament` | 4 rotations ranking the four contenders, ~30 min |
| `npm run healthcheck` | Container and clone liveness |
| `npm run player:dev` | Replay viewer on :5173 |
| `docker compose up -d --build` | Serve the player and `./replays` on :8088 |

## Configuration

Copy `.env.example` to `.env`. Credentials are `OPENROUTER_API_KEY`, `GROQ_API_KEY`
and `NVIDIA_API_KEY`; at least one is required, and all three make the roster
meaningfully more robust. Neither ever leaves the
`Authorization` header — prompts carry public battlefield state and nothing
else, and a test fails if a key pattern appears in a URL, a request body, or a
replay.

Models are referenced by provider: a bare id goes to OpenRouter
(`google/gemma-4-26b-a4b-it:free`), a `groq:` prefix goes to Groq
(`groq:openai/gpt-oss-120b`), an `nvidia:` prefix goes to NVIDIA build
(`nvidia:meta/llama-3.3-70b-instruct`).
