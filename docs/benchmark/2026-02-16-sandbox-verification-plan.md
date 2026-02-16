# Benchmark Sandbox Migration and Verification Plan (2026-02-16)

## Goal

Establish a reliable benchmark workflow where scenario execution is meaningful, repeatable, and comparable when targeting `ghx` capabilities. The immediate goal is to validate scenario correctness and harness behavior using `openai/gpt-5.1-codex-mini` (cost-efficient verification phase), then run canonical comparison validation on `openai/gpt-5.3-codex`.

## Motivation

The previous benchmark setup mixed static fixture assumptions with live repo state, which produced low-signal failures:

- scenarios tied to `go-modkit/modkit` and stale IDs
- mutation scenarios configured as expected failures (`must_succeed: false`) despite seeded mutation intent
- no dedicated sandbox for safe mutation-heavy runs
- inconsistent fixture quality (missing PR thread, project fields, non-GraphQL issue IDs)

This made it hard to distinguish real regressions from fixture or assertion noise.

## What We Did in This Session

### 1) Created sandbox-first benchmark topology

- Introduced sandbox repository: `aryeko/ghx-bench-fixtures` (now public)
- Added fixture lifecycle tooling in benchmark package:
  - `fixtures seed`
  - `fixtures status`
  - `fixtures cleanup`
- Added fixture manifest schema and binding resolution so scenarios can be portable and repo-agnostic.

### 2) Migrated scenarios away from hardcoded repo/IDs

- Scenario inputs now use fixture bindings from manifest.
- Removed `go-modkit/modkit` dependencies from benchmark scenario definitions.
- Split suite intent:
  - read-only verify sets for CI (`ci-verify-pr`, `ci-verify-release`)
  - seeded full/mutation sets for sandbox runs (`full-seeded` and roadmap sets).

### 3) Added model-aware gate expectations

- Added expectations config: `packages/benchmark/config/expectations.json`
- Added report support for model-specific thresholds and explicit overrides:
  - `--expectations-model`
  - `--expectations-config`
- Set current verification default model to `openai/gpt-5.1-codex-mini`.

### 4) Fixed fixture seeding quality issues

- Ensured seeded manifest includes:
  - PR + PR thread IDs
  - project-v2 number/id/item/field/option IDs
  - GraphQL issue IDs (`I_kw...`) required for mutation tasks
- Added and updated seed/cleanup unit tests.

### 5) Refactored scenario assertion semantics

- Introduced `assertions.expected_outcome` (`success` or `expected_error`).
- Migrated scenarios to explicit `expected_outcome: "success"` for seeded verification.
- Added guardrails in scenario checks:
  - `expected_error` must include `expected_error_code`
  - roadmap sets must use success outcomes.

## Progress Snapshot (Key Commits)

- `bdb5672` feat(benchmark): add sandbox fixture manifest workflow
- `ff9bde1` feat(benchmark): add seeded fixture cleanup
- `4388cde` feat(benchmark): add model-aware gate expectations
- `93b4620` fix(benchmark): seed dedicated project-v2 fixtures
- `91942bd` refactor(benchmark): migrate to expected_outcome assertions
- `9c36353` fix(benchmark): seed GraphQL issue IDs for mutations

## Current Status

### Completed

- sandbox repo and fixture lifecycle are operational
- scenario binding and fixture-driven targeting are in place
- model-aware gate configuration is wired
- scenario assertion model migrated to explicit outcomes
- benchmark package checks currently pass (tests/typecheck/lint/check-scenarios)

### Partially completed

- paired verification has started (scenario-by-scenario), but full set-by-set paired validation across all planned sets is still pending.

## What Still Needs to Be Done

## Detailed Execution Plan (Next Steps)

### Phase A: Set-by-set paired verification on mini (active phase)

Use `openai/gpt-5.1-codex-mini`, one iteration, and run both modes for each set before moving on.

#### Preconditions

1. Ensure fixture manifest is valid:

```bash
pnpm --filter @ghx-dev/benchmark run fixtures -- status --out fixtures/latest.json
```

2. Set model env:

```bash
export BENCH_PROVIDER_ID=openai
export BENCH_MODEL_ID=gpt-5.1-codex-mini
```

#### Set order (required)

1. `pr-exec`
2. `pr-thread-mutations`
3. `issues`
4. `release-delivery`
5. `workflows`
6. `projects-v2`
7. `pr-review-reads`
8. `ci-diagnostics`
9. `ci-log-analysis`

#### Per-set loop

For each set `<SET>`:

```bash
pnpm --filter @ghx-dev/benchmark run benchmark -- agent_direct 1 --scenario-set <SET> --fixture-manifest fixtures/latest.json
GHX_SKIP_GH_PREFLIGHT=1 pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set <SET> --fixture-manifest fixtures/latest.json
pnpm --filter @ghx-dev/benchmark run report -- --gate --gate-profile verify_pr --expectations-model openai/gpt-5.1-codex-mini || true
```

Archive each set's latest summary and paired result files immediately after the run.

#### Pass criteria per set (blocking)

- expected row counts produced in both modes
- all rows `success=true`
- all rows `output_valid=true`
- no `error` rows in either mode

Gate v2 pass is advisory at single-iteration set granularity, not blocking for this phase.

#### Failure handling

If a set fails blocking criteria:

1. extract failing `scenario_id` values from both mode files
2. rerun failing scenarios in paired mode (`agent_direct` + `ghx`)
3. inspect row errors and session traces
4. fix fixture/scenario/harness issues
5. rerun the entire failed set before proceeding

### Phase B: Consolidated mini verification artifact

After all sets in Phase A are run:

- generate final JSON + markdown summary from per-set status files
- store under `packages/benchmark/reports/verification-<date>-gpt-5.1-codex-mini-by-set/`

### Phase C: Cleanup

When verification batch completes:

```bash
pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json
```

### Phase D: Canonical confirmation on 5.3

After mini phase stabilizes and all blocking checks pass:

1. switch to `openai/gpt-5.3-codex`
2. run paired `verify_pr` (agent_direct + ghx)
3. run report gate using 5.3 expectations
4. decide go/no-go for benchmark baseline update.

## Risks and Mitigations

- **Risk: fixture drift between sets**
  - Mitigation: validate manifest before run and cleanup after batch.
- **Risk: false gate negatives at 1 iteration**
  - Mitigation: treat gate as advisory in Phase A; enforce row-level blocking correctness.
- **Risk: mutation side effects contaminating subsequent sets**
  - Mitigation: seeded labels + cleanup; rerun set from clean fixture state when needed.

## Definition of Done for This Workstream

- all planned sets executed in paired mode (`agent_direct` + `ghx`)
- blocking criteria pass for every set
- consolidated mini verification report produced
- fixtures cleaned up
- canonical 5.3 confirm run completed and documented
