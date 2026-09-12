# Civilization engine implementation plan

Goal: deliver a playable, deterministic civilization simulation behind the existing 3D atlas.
Architecture: version w10 dispatches to separate simulation phases; w8 archives retain their rules and fingerprints. Persistent cities, units and diplomacy live in the world and are reconstructed from the journal. The ruler sets policy; deterministic systems carry it out.
Stack: TypeScript, Zod, Vitest, Vue, Three.js, existing provider interface.

User scope: improve the engine completely following the approved civilization direction. Work proceeds in this checkout, preserving previous visual changes. No remote model calls are needed for validation.

- [x] Persist pending and unfinished decision barriers; test interrupted and uninterrupted equivalence.
- [x] Atomic journal replacement and exclusive process lock, with failure tests.
- [x] Add w10 contracts and versioned replay; validate board, unit and temporal invariants.
- [x] Implement resource-constrained production, growth, recruitment, cities and research with real effects.
- [x] Implement persistent work crews, settlers and armies, traversable routes, bilateral diplomacy and local combat.
- [x] Expose development choices and facts to rulers; render recorded unit positions in the atlas.
- [x] Provide a reproducible local scenario and a multi-seed balance probe, with provenance clearly labelled.
- [x] Run regression tests, typecheck, build, archive fingerprint verification and browser checks. Document outcomes and limits.

Acceptance: immutable inputs, nonnegative finite resources, troop conservation, no dead ownership or units, adjacent movement, affordable construction, functional research, stable replay/resume and readable new scenario. Existing w8 history must retain its recorded fingerprint.
