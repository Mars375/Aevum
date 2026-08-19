---
name: project-conventions
description: Non-obvious rules this project has paid for. Read before touching the engine, the contracts, the orchestrator, the player, or anything that produces a measurement.
user-invocable: false
---

# Conventions — AI Battle Simulator

Every rule below cost something to learn. They are listed with the failure that
taught them, because a rule without its reason gets optimised away by the next
person who thinks they are being helpful.

## The engine

**v1 is frozen.** Invariant `I20` says a v1 replay resolves identically under
the current engine. Changing v1 statistics, deployment, or tie-breaks silently
relabels outcomes in replays already recorded — that is rewriting the past, not
fixing balance. When v1 is the problem, add v2 behaviour instead.

**The model decides, the engine resolves.** The engine makes no network call and
holds no per-faction special case. Faction traits touch army buying and derived
statistics only.

**Reject, never repair.** An illegal order becomes `HOLD` and emits an event. An
over-budget army is refused and replaced by the default. The engine never
quietly rewrites input into something workable — the rejection is what makes a
replay auditable.

**Parsing is not repairing.** Accepting `[{"type":"MELEE","quantity":2}]` as
`["MELEE","MELEE"]` is parsing: the same army, another encoding. Trimming that
army to fit the budget would be repair, and is forbidden.

**Never invent an order.** When a general's whole fallback chain fails, its
squads hold and the replay records `GENERAL_UNREACHABLE`. The client fabricates
nothing.

**Canonical order everywhere.** Squads are walked in sorted-id order, never in
the order generals answered. This is what makes `I6` hold on the event log as
well as on the state.

## Measurement

**Measure before tuning.** "Battles are too lethal" was half right and aimed at
the wrong ruleset; 200 scripted battles per ruleset settled it in minutes.
`npm run balance` runs offline and costs no quota.

**`null` is not `0`.** An unmeasurable fidelity is `null`, never zero. "We could
not tell" and "it lied" are different findings and must never be averaged.

**Vague is not false.** A report claim naming no recognisable action is
`UNSUPPORTED` and excluded from scoring — not `CONTRADICTED`. Half true, on the
other hand, is false: embellishment is the thing being caught.

**No model judges another.** Reports are checked mechanically against the
replay. That is the entire defence against the self-assessment bias.

**A contender that did not play cannot be ranked.** Report it NOT RANKED, never
last.

## The orchestrator

**Identity outranks speed for a general's own model; speed outranks identity for
its fallbacks.** Hopping off a rate-limited primary was good for throughput and
starved three of four contenders to zero turns played. Being served by another
model is a different measurement, not a cheaper one.

**Read the rate-limit headers.** Groq reserves the whole `max_tokens` against its
per-minute budget, so asking 6000 against an 8000 ceiling allows one call a
minute. Ceilings are per provider for that reason.

**No primary on an exhausted provider, and no primary anywhere in another
faction's chain.** Both rules exist because one model once decided 62.5% of a
battle while another never played at all.

## The player

**Colour never carries meaning alone.** The four faction colours have nearly
identical luminance — verdant against amber is a 1.04 contrast ratio. Faction is
also an initial, archetype is also a shape, every status also has a text prefix.

**2D stays the default and stays complete.** 3D is an alternative view, loaded on
demand so the 2D bundle stays small.

**Show what a general knew, not what we know.** The omniscient view sees more
than any general did; the fog view is what makes a decision judgeable.

## Secrets

`.env` holds four API keys and is gitignored, `600`, and never edited. Prompts
carry public battlefield state only. A test fails if a key pattern reaches a
URL, a request body, or a replay.
