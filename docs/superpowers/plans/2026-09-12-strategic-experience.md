# Persistent strategic experience

Goal: make each ruler pursue a concrete, observable objective across turns, while keeping all existing campaign replays valid.

Architecture: spectator-3 inherits city economy from spectator-2 and adds optional decision plans and measured persistent state. The engine owns success conditions; plans never substitute for actual orders. Old rule versions retain their state and provider contracts. Spectators can inspect all plans, but a model receives only its own.

- Engine: isolate plan validation and progress in a dedicated world module; cover persistence, completion, cancellation, invalid targets and versioned replay.
- Gateway: version the strict provider schema, supply own plan in observation and explain persistence, explicit cancellation and concrete orders.
- Interface: show rationale, measured progress and blocked status; improve route direction and unit recentering.
- Verification: tests, TypeScript, player build, old saved campaign replays, a deterministic multi-seed run and browser inspection of a new demo.

Limits: one active plan per ruler, national stocks retained, no claim of improved remote model performance without a new measured pilot.
