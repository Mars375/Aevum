# Aevum Living World Season 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Aevum Season 1 as a reproducible living-world experience with persistent civilisations, observable behavioural adaptation curves, a narrative atlas, and a verified technical rename from AI Battle Simulator.

**Architecture:** Keep `@abs/world` deterministic and network-free. Extend the journal with explicit decision/service/context evidence, calculate adaptation metrics in a new pure `@abs/metrics` workspace, then expose those metrics through generated reports and Vue components. Keep v1/v2 battle archives and old world journals readable; branding migration is separate from contract migration.

**Tech Stack:** TypeScript 5.7, Node 22, npm workspaces, Zod 3, Vitest 2, Vue 3, Vite 6, Three.js lazy-loaded, Docker/Nginx, GitHub Actions.

## Global Constraints

- The engine and world remain deterministic and make zero network calls.
- The model decides; the engine resolves. Never invent or silently repair a ruling.
- “Learning” means observable behavioural adaptation, never an unverified claim that model weights changed.
- Metrics remain separate: consequence recognition, error correction, doctrine coherence, and narrative fidelity.
- Comparisons require paired seeds/positions/windows and must display service/retry rates.
- Old replays and archived worlds remain readable; version changes are explicit.
- No secret enters prompts, journals, reports, URLs, public assets, or commits.
- 2D is complete and default; 3D remains optional and lazy-loaded.
- No new dependency without an explicit preflight and approval.
- French for user-facing documents and release notes; English for code and prompts.
- Each implementation task uses an isolated worktree; never run two workers against one worktree.

---

### Task 1: Versioned contracts for identity, decision evidence, and learning observations

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/test/boundaries.test.ts`
- Modify: `packages/world/src/state.ts`
- Modify: `packages/world/src/journal.ts`
- Create: `packages/world/test/journal.test.ts`
- Create: `packages/world/test/identity.test.ts`

**Interfaces:**
- Produce `IdentitySchema` / `Identity` with stable display name, values, origin text, and version-safe defaults.
- Produce `ServiceEvidenceSchema` / `ServiceEvidence` with requested model, served model, provider, fallback count, attempts, latency, and `servedByFallback` boolean. No credentials or prompt bodies.
- Extend `RulingSchema` with optional `context`, `service`, and `consequenceRef` fields using defaults that preserve old journals.
- Produce `LearningObservationSchema` / `LearningObservation` containing model id, civ id, trigger event ids, decision tick, next-decision tick, before/after doctrine fingerprints, and objective outcome deltas.

- [ ] **Step 1: Add boundary tests for the new schemas.**
  - Parse a current v0.2.0 journal without the new fields and assert defaults.
  - Parse a fully populated ruling and assert service metadata is retained.
  - Reject credentials, negative ticks, invalid faction ids, and malformed service counts.
  - Run `npm test -- packages/contracts/test/boundaries.test.ts packages/world/test/journal.test.ts` and confirm the new cases fail before implementation.

- [ ] **Step 2: Implement the minimal Zod schemas and world identity defaults.**
  - Keep `WORLD_VERSION` unchanged for additive fields that do not alter resolution.
  - Add identity to `CivSchema` with deterministic fallback derived from the faction id.
  - Do not add a free-text field that can affect engine resolution without a versioned rule.

- [ ] **Step 3: Add journal compatibility tests.**
  - Round-trip a v0.2.0 fixture.
  - Assert `chronicle()` still produces the same years when evidence fields are absent.
  - Assert old battle and world contract boundaries remain unchanged.

- [ ] **Step 4: Run `npm test` and `npm run typecheck`.**

- [ ] **Step 5: Commit** with `feat(contracts): version Aevum identity and decision evidence`.

---

### Task 2: Deterministic world identities, memory, events, and progression

**Files:**
- Modify: `packages/world/src/state.ts`
- Modify: `packages/world/src/tick.ts`
- Modify: `packages/world/src/apply.ts`
- Modify: `packages/world/src/events.ts`
- Modify: `packages/world/src/advances.ts`
- Modify: `packages/world/src/chronicle.ts`
- Modify: `packages/world/src/turning.ts`
- Modify: `packages/world/test/tick.test.ts`
- Create: `packages/world/test/events.test.ts`
- Create: `packages/world/test/chronicle.test.ts`
- Modify: `docs/spec/world-w8.md` or create the next explicit world spec only if resolution changes are required

**Interfaces:**
- Produce a pure `eventId(event, tick, civ)` helper stable across replays.
- Produce a pure `memoryFor(journal, civ, tick, maxEntries)` helper derived only from recorded events and rulings.
- Produce deterministic `identityOf(civ, history)` and `doctrineFingerprint(doctrine)` helpers for metric inputs.
- Keep `chronicle(journal)` as the canonical reconstruction path; no parallel renderer-specific simulation.

- [ ] **Step 1: Write regression tests for identity, event ids, memory caps, and progression.**
  - Same seed/journal yields byte-equivalent event ids and memory.
  - Memory contains only engine-emitted facts and is capped at `MAX_MEMORY_ENTRIES`.
  - A progression milestone changes only the explicitly declared w9+ behaviour; w8 archives remain bit-equivalent.
  - A collapsed civilisation remains in history with a `fellOnTick` and is not erased from metric inputs.

- [ ] **Step 2: Implement event identity and memory as pure functions.**
  - Use canonical civ order and event order.
  - Do not generate narrative text inside the engine.
  - Mark uncertain attribution as `observed-after` in the derived observation layer, not as a causal engine event.

- [ ] **Step 3: Implement only the smallest demonstrated progression/event changes.**
  - Every new advance has a threshold, engine effect, cost/trade-off, and version.
  - Preserve the current `w8` contract unless a new version is explicitly introduced and tested.

- [ ] **Step 4: Run focused tests, then the full suite and `npm run world:probe -- 300`.**

- [ ] **Step 5: Commit** with `feat(world): add deterministic identities and life events`.

---

### Task 3: Pure adaptation metrics package and paired-run protocol

**Files:**
- Create: `packages/metrics/package.json`
- Create: `packages/metrics/src/index.ts`
- Create: `packages/metrics/src/types.ts`
- Create: `packages/metrics/src/observations.ts`
- Create: `packages/metrics/src/curves.ts`
- Create: `packages/metrics/test/observations.test.ts`
- Create: `packages/metrics/test/curves.test.ts`
- Modify: root `package.json` only to expose an offline metrics script if needed
- Create: `scripts/learning-curve.ts`
- Create: `docs/spec/learning-metrics.md`

**Interfaces:**
- `buildObservations(years: Year[], rulings: Ruling[]): LearningObservation[]`
- `scoreConsequenceRecognition(observations): MetricSeries`
- `scoreErrorCorrection(observations): MetricSeries`
- `scoreDoctrineCoherence(observations): MetricSeries`
- `scoreNarrativeFidelity(observations): MetricSeries`
- `buildLearningCurve(observations, options): LearningCurve`
- `classifyLearningSignal(curve): "ADAPTATION_OBSERVED" | "NO_EVIDENCE" | "INSUFFICIENT_DATA" | "UNRANKED"`

`MetricSeries` must include window, numerator, denominator, value, sample count, service rate, fallback rate, and uncertainty metadata. No function may call a model or use wall-clock state.

- [ ] **Step 1: Write red tests for the four series.**
  - A repeated failure followed by a context-appropriate change increases correction, not generic success.
  - A doctrine that stays coherent while losing is not automatically scored as bad.
  - A report claim unsupported by the journal lowers fidelity.
  - Service rate below the configured threshold produces `UNRANKED`.
  - Different seeds are never merged without an explicit paired-run key.

- [ ] **Step 2: Implement the observation builder.**
  - Join a ruling to the immediately following recorded state and next decision for the same civ.
  - Preserve `observed-after` when causality cannot be proven.
  - Exclude deferred/retried calls from the numerator while retaining them in service metadata.

- [ ] **Step 3: Implement each metric independently.**
  - Never return a single “intelligence” scalar.
  - Use deterministic window bucketing and explicit denominators.
  - Include confidence/sample metadata instead of smoothing away noise.

- [ ] **Step 4: Implement the offline CLI.**
  - `npm run learning-curve -- worlds/demo/era-0001.json` writes a JSON/Markdown report without network access.
  - The report lists model service, event sources, metric series, and unranked reasons.

- [ ] **Step 5: Run `npm test`, `npm run typecheck`, and the CLI against the demo era.**

- [ ] **Step 6: Commit** with `feat(metrics): measure observable adaptation curves`.

---

### Task 4: Aevum profiles and adaptation curves in the player

**Files:**
- Modify: `apps/player/src/App.vue`
- Modify: `apps/player/src/components/Chronicle.vue`
- Modify: `apps/player/src/components/CivTrend.vue`
- Modify: `apps/player/src/components/EmpireShare.vue`
- Create: `apps/player/src/components/CivilisationProfile.vue`
- Create: `apps/player/src/components/LearningCurve.vue`
- Create: `apps/player/src/components/DecisionSources.vue`
- Modify: `apps/player/src/styles.css`
- Modify: `apps/player/test/fog.test.ts` only if shared view projection is touched
- Create: `apps/player/test/learning-curve-view.test.ts`

**Interfaces:**
- `CivilisationProfile` consumes one identity, doctrine, history, and `LearningCurve`.
- `LearningCurve` receives metric series and event markers; it emits `selectObservation(tick)` only.
- `DecisionSources` receives source observations and emits `seek(tick)`.
- Components render “données insuffisantes” and “non classable” explicitly; they do not calculate metrics.

- [ ] **Step 1: Add component tests for honest states.**
  - Empty curve says data is insufficient.
  - Low service rate says the model is unranked.
  - Event markers and source buttons seek to the correct tick.
  - The same series remains readable without color alone.

- [ ] **Step 2: Build the profile layout.**
  - Identity and doctrine first.
  - Historical turning points second.
  - Curves and source decisions third.
  - Keep the atlas as the dominant stage and preserve battle/archive routes.

- [ ] **Step 3: Add the curve visualisation.**
  - Selectable metric, uncertainty/sample annotation, event markers, keyboard focus, and reduced-motion behaviour.
  - No decorative line without data.

- [ ] **Step 4: Verify 375/900/1440 px and run `npm test`, `npm run typecheck`, `npm run player:build`.**

- [ ] **Step 5: Commit** with `feat(player): show Aevum civilisation learning curves`.

---

### Task 5: Generate and publish a reproducible Season 1 era

**Files:**
- Modify: `scripts/live.ts`
- Modify: `scripts/eras.ts`
- Modify: `scripts/index-worlds.ts`
- Modify: `scripts/build-reports.ts`
- Modify: `scripts/tend-world.sh` only if status metadata needs the new metric report
- Create: `scripts/season-report.ts`
- Create: `docs/reports/aevum-season-1.md`
- Create or regenerate: `worlds/aevum-season-1/era-0001.json`
- Create or regenerate: `apps/player/public/reports/aevum-season-1.html`
- Create or regenerate: `apps/player/public/worlds/index.json`

**Interfaces:**
- The campaign command must support `--seed`, `--ticks`, `--silent`, `--out`, and `--resume`.
- `season-report.ts` consumes only a journal and generated metrics; it must not call a provider.
- Generated reports include exact world version, metric version, seed, lived years, service summary, and known limitations.

- [ ] **Step 1: Add an offline scripted campaign fixture and test.**
  - It must produce a full era with at least one turning point, one event chain, one surviving and one fallen historical state where the rules permit it.
  - Same seed and same scripted rulings must produce the same fingerprint.

- [ ] **Step 2: Add metric/report generation to the campaign pipeline.**
  - Do not hide absent model calls behind a success label.
  - Record “scripted/no remote model” distinctly from a real model run.

- [ ] **Step 3: Generate the first Season 1 artefacts and index them.**

- [ ] **Step 4: Run `npm run index-worlds`, `npm run build-reports`, `npm run learning-curve`, and verify the generated links.**

- [ ] **Step 5: Commit** with `feat(cli): publish a reproducible Aevum Season 1 era`.

---

### Task 6: Public Aevum rename and compatibility migration

**Files:**
- Modify: `package.json`
- Modify: `apps/player/package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `apps/player/index.html`
- Modify: `apps/player/src/**` branding strings and metadata only
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/**` names and help text only
- Create: `docs/migrations/aevum-rename.md`

**Interfaces:**
- Public product name becomes `Aevum — Chronique des mondes`.
- Internal `@abs/*` package names stay unchanged in this release unless a separate contract migration proves safe.
- Old URLs and replay paths remain readable; historical reports may mention `AI Battle Simulator` as the predecessor.
- Proposed GitHub slug: `aevum`; verify availability and redirect behaviour before changing the remote.

- [ ] **Step 1: Create a rename inventory.**
  - Search case-sensitive and case-insensitive forms of `AI Battle Simulator`, `ai-battle-simulator`, `@abs`, and Docker image names.
  - Classify each hit as public branding, technical identifier, historical reference, or generated artefact.

- [ ] **Step 2: Apply only the approved public rename.**
  - Update titles, metadata, README, changelog, Docker display names, and release notes.
  - Do not rename contracts or historical paths in the same patch.

- [ ] **Step 3: Add compatibility tests and migration documentation.**
  - Old replay URLs still load.
  - New Aevum URLs and titles appear in the player.
  - No accidental secret or old public title remains outside the migration allowlist.

- [ ] **Step 4: Verify package metadata, Docker Compose config, typecheck, tests, and build.**

- [ ] **Step 5: Only after local verification, rename the GitHub repository and update `origin`; verify the redirect and remote push.**

- [ ] **Step 6: Commit** with `refactor: rename the product to Aevum`.

---

### Task 7: Integrated QA, methodology, and release candidate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/reports/aevum-season-1-verification.md`
- Create: `scripts/verify-season-1.ts`
- Create: `apps/player/test/aevum-release.test.ts`
- Modify: `README.md` command table and release section

**Interfaces:**
- `verify-season-1.ts` exits non-zero on invalid journal, missing metric source, service-rate mismatch, broken report link, or replay fingerprint drift.
- The verification report distinguishes local scripted evidence, remote-model evidence, and unverified claims.

- [ ] **Step 1: Write release checks for journal, metrics, generated reports, and rename inventory.**

- [ ] **Step 2: Add CI steps for `npm test`, `npm run typecheck`, `npm run player:build`, `npm run healthcheck`, `npm run world:probe -- 300`, report generation, and `verify-season-1`.**

- [ ] **Step 3: Run Playwright/headless QA at 375/900/1440 px, reduced-motion, keyboard navigation, no external font/network dependency, console errors, and source-link seeking.**

- [ ] **Step 4: Run `git diff --check`, secret scan, `npm audit` recording, and Docker build/healthcheck if the deployment path is included.**

- [ ] **Step 5: Commit** with `test: verify Aevum Season 1 release candidate`.

---

### Task 8: Release Aevum Season 1

**Files:**
- Modify: `package.json`, `apps/player/package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md` only for the final version/notes.
- Create: Git tag and GitHub release after all gates pass.

- [ ] **Step 1: Confirm clean Git state, version consistency, remote slug, CI status, and release artefact count.**
- [ ] **Step 2: Run the complete local verification suite fresh.**
- [ ] **Step 3: Commit with `release: vX.Y.Z — Aevum Season 1` and create an annotated tag.**
- [ ] **Step 4: Push branch and tag; verify remote refs.**
- [ ] **Step 5: Create GitHub release with factual notes and known limitations.**
- [ ] **Step 6: Wait for every CI run on the release commit to finish successfully.**
- [ ] **Step 7: Verify the public release URL, clean worktree, and Kanban completion evidence.**

---

## Plan self-review

- Spec coverage: identity/doctrine (Tasks 1–2), events/progression (Task 2), adaptation curves (Task 3), UI (Task 4), reproducible era (Task 5), rename (Task 6), QA (Task 7), release (Task 8).
- No task claims weight updates or uses an LLM judge as objective truth.
- Every metric carries service/sample/uncertainty context.
- Old v1/v2 and w8 compatibility is tested before new behaviour is introduced.
- The public rename is separated from internal `@abs/*` contract migration.
- No unresolved implementation placeholder is hidden in the plan; open product decisions remain in the approved design spec.
