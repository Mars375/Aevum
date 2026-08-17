# AI Battle Simulator

Four language models each command a faction on a 16×16 tactical grid. A
deterministic engine resolves their orders and writes a replay you watch
afterwards.

Nobody plays. You watch — and you read why each general gave the orders it did.

```
npm install
npm run battle -- --scripted     # offline baseline, no key, no network
npm run battle                   # four remote models, needs OPENROUTER_API_KEY
npm run player:dev               # open the replay in the browser
```

## How it is put together

| Package | Does | Never does |
| --- | --- | --- |
| `@abs/contracts` | zod schemas shared by everything | import the engine, the network or Vue |
| `@abs/engine` | resolves a turn, decides the outcome | make a single network call |
| `@abs/agents` | talks to OpenRouter, drives the battle loop | decide who wins |
| `@abs/cli` | runs a battle, writes the replay | — |
| `@abs/player` | Vue 3 replay viewer | run the engine |

The split that matters: **the model decides, the engine resolves.** An illegal
order is rejected and recorded, never quietly rewritten into something workable.
That is what makes a replay auditable.

## Three things the measurements forced

The provider survey (`docs/research/providers.md`) changed the design in ways
worth knowing before you touch the orchestrator:

1. **`max_tokens` must cover reasoning tokens.** At 800, six of seven free
   models returned unparseable JSON and looked incapable of structured output.
   They were being truncated — reasoning tokens are billed against the
   completion budget before the first brace. At 3000 they pass. A
   `finish_reason: length` is therefore treated as a retryable failure, not as a
   malformed answer.
2. **HTTP 429 is the normal regime**, not an incident. Every general has an
   ordered fallback chain; a 429 backs off, then switches model.
3. **Latency spans 3.7 s to 213 s.** Every request has a 60 s ceiling, and the
   slowest models are excluded from the roster outright.

When the whole chain fails, the squads hold and the replay says
`GENERAL_UNREACHABLE`. The client never invents an order to cover the gap.

## Budget

Locked at **0 €** by the launch gate. The orchestrator refuses any model whose
id does not end in `:free`, and it refuses it before making the request. Raising
the ceiling is a human decision — set `ABS_FREE_MODELS_ONLY=0` only after taking
it.

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

## Commands

| Command | Does |
| --- | --- |
| `npm test` | 49 tests: engine invariants, replay round-trip, provider behaviour |
| `npm run typecheck` | `tsc --noEmit` across the workspace |
| `npm run battle -- --scripted` | Offline battle with the baseline AI |
| `npm run battle` | Remote battle, four free models, several minutes |
| `npm run probe` | Re-measure the free-model catalogue |
| `npm run healthcheck` | Container and clone liveness |
| `npm run player:dev` | Replay viewer on :5173 |
| `docker compose up -d --build` | Serve the player and `./replays` on :8088 |

## Configuration

Copy `.env.example` to `.env`. The only credential is `OPENROUTER_API_KEY`, and
it never leaves the `Authorization` header — prompts carry public battlefield
state and nothing else.
