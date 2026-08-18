# AI Battle Simulator

Four language models each command a faction on a 16×16 tactical grid. A
deterministic engine resolves their orders and writes a replay you watch
afterwards.

Nobody plays. You watch — and you read why each general gave the orders it did.

```
npm install
npm run battle -- --scripted     # offline baseline, no key, no network
npm run battle                   # four remote models, ~7 minutes
npm run battle -- --resume       # continue an interrupted battle
npm run player:dev               # open the replay in the browser
```

## How it is put together

| Package | Does | Never does |
| --- | --- | --- |
| `@abs/contracts` | zod schemas shared by everything | import the engine, the network or Vue |
| `@abs/engine` | resolves a turn, decides the outcome | make a single network call |
| `@abs/agents` | talks to OpenRouter and Groq, drives the battle loop | decide who wins |
| `@abs/cli` | runs a battle, writes the replay | — |
| `@abs/player` | Vue 3 replay viewer | run the engine |

The split that matters: **the model decides, the engine resolves.** An illegal
order is rejected and recorded, never quietly rewritten into something workable.
That is what makes a replay auditable.

## Four things the measurements forced

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
4. **Use two providers.** OpenRouter and Groq rate-limit independently, so every
   fallback chain spans both and one provider throttling strands nobody. Groq
   also cuts median latency from 58 s to 3 s, which turns a 40-minute battle
   into a 7-minute one — the difference between a tournament being affordable
   and not.

When a whole chain fails, the squads hold and the replay says
`GENERAL_UNREACHABLE`. The client never invents an order to cover the gap.

## Budget

Locked at **0 €** by the launch gate.

On OpenRouter this is enforced in code: a model id without a `:free` suffix is
refused *before* the request is made. On Groq it **cannot** be — the free tier
is a property of the account, not of the model. An account with no payment
method is rate-limited rather than billed, and that is where the guarantee
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
| `docs/architecture/data-contracts.md` | Why the schemas are shaped the way they are |
| `docs/research/providers.md` | Model measurements and the roster they justify |
| `docs/reports/reference-battle.md` | The delivered battle, and four runs of measurements |
| `docs/reports/qa-audit.md` | Defects found, what was fixed, what is still open |

## Commands

| Command | Does |
| --- | --- |
| `npm test` | 76 tests: engine invariants, replay round-trip, provider routing, regression tests for every fixed defect |
| `npm run typecheck` | `tsc --noEmit` across the workspace |
| `npm run battle -- --scripted` | Offline battle with the baseline AI |
| `npm run battle` | Remote battle, four free models, ~7 minutes |
| `npm run battle -- --resume` | Continue the replay at `--out` instead of restarting |
| `npm run probe` | Re-measure the free-model catalogue |
| `npm run healthcheck` | Container and clone liveness |
| `npm run player:dev` | Replay viewer on :5173 |
| `docker compose up -d --build` | Serve the player and `./replays` on :8088 |

## Configuration

Copy `.env.example` to `.env`. Credentials are `OPENROUTER_API_KEY` and,
optionally, `GROQ_API_KEY`; at least one is required. Neither ever leaves the
`Authorization` header — prompts carry public battlefield state and nothing
else, and a test fails if a key pattern appears in a URL, a request body, or a
replay.

Models are referenced by provider: a bare id goes to OpenRouter
(`google/gemma-4-26b-a4b-it:free`), a `groq:` prefix goes to Groq
(`groq:openai/gpt-oss-120b`).
