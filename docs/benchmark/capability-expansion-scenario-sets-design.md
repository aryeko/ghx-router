# Benchmark Design: Scenario Sets for PR Review + CI Capability Expansion

**Status:** Implemented  
**Date:** 2026-02-14  
**Depends on:** `docs/architecture/capability-expansion-pr-review-ci-design.md`

---

## Motivation

The capability expansion spec adds a large new surface area (PR review threads, PR mutations, checks, workflow diagnostics, and log analysis). Benchmark coverage must expand with it, but without breaking historical comparability.

Today, benchmark runs implicitly execute all scenarios present in `packages/benchmark/scenarios`. As we add new scenarios, this behavior would unintentionally change the baseline signal, runtime, and cost.

We need explicit **scenario sets** so we can:

- keep default benchmark behavior equivalent to current thin-slice runs,
- run targeted capability suites (for example unresolved thread reads or CI diagnostics),
- run a comprehensive `pr-operations-all` suite when desired,
- avoid mixing mutating and non-mutating scenarios in default gates.

---

## Goals

1. Introduce first-class scenario sets in `@ghx-dev/benchmark`.
2. Keep default execution semantically equivalent to current behavior.
3. Add benchmark coverage for all capability families introduced by the architecture spec.
4. Isolate mutating PR operations from default runs.
5. Ensure scenario-set selection and validation are deterministic and testable.

## Non-goals

- Redesigning benchmark scoring or replacing the current gate model.
- Solving fixture flakiness globally in this change.
- Adding autonomous state reset for mutation fixtures.

---

## Scope

### Scenario sets

Define explicit set names:

- `default` (existing thin-slice scenarios only)
- `pr-review-reads`
- `pr-thread-mutations`
- `ci-diagnostics`
- `ci-log-analysis`
- `pr-operations-all` (union of all PR-related operations)

### Selection precedence

Runner selection order must be:

1. `--scenario <id>` (single scenario)
2. `--scenario-set <name>`
3. implicit default set (`default`)

This preserves old behavior expectations while making expanded runs explicit.

### Coverage mapping to capability expansion

From the architecture spec, benchmark scenarios must cover:

- PR review reads: unresolved threads, reviews list, changed files, checks summary, failed checks, mergeability.
- PR thread mutations: reply, resolve, unresolve, ready-for-review set.
- CI diagnostics: check annotations, workflow runs, jobs, logs.
- CI analysis: log analysis capability.

---

## Design Details

### Source of truth for set membership

Use an explicit manifest file in benchmark package root:

- `packages/benchmark/scenario-sets.json`

Rationale:

- stable, auditable set membership,
- avoids overloading free-form tags,
- easy to validate in CI.

### Benchmark model updates

- Extend CLI args parser with `scenarioSet`.
- Extend runner options with `scenarioSet`.
- Include `scenario_set` in benchmark row metadata when run by set (null for explicit single scenario runs).

### Validation updates

`check-scenarios` must validate:

1. scenario files are valid,
2. duplicate scenario IDs do not exist,
3. scenario-set references all point to existing scenario IDs,
4. every scenario appears in at least one set,
5. required set names exist (at minimum: `default`, `pr-operations-all`).

### Reporting behavior

Default report and gate behavior remain unchanged unless set-level filtering is explicitly requested later.

Set metadata is captured now so future set-specific reports can be added without changing run format again.

---

## Requirements

### Functional requirements

1. Running benchmark with no set flags executes exactly `default` scenarios.
2. `--scenario-set` executes only scenarios in that set.
3. `--scenario` executes exactly one scenario regardless of set flags.
4. `pr-operations-all` includes all PR-centric operations from the capability expansion spec.
5. Mutation scenarios are excluded from `default`.

### Quality requirements

1. Scenario selection is deterministic across runs.
2. Existing thin-slice scenario IDs and behavior stay intact.
3. CLI errors are clear for unknown set names.
4. Set validation failures are actionable (missing ID, orphan, duplicate).

### Safety requirements

1. Mutating scenarios require explicit fixture targets and must not run in default set.
2. CI/log scenarios must tolerate expected variability with bounded retries/timeouts.
3. No secrets or tokens in scenario payloads, reports, or errors.

---

## Risks and Mitigations

### High

- **Fixture side effects for mutations**
  - Mitigation: isolate into dedicated mutation set and sandbox fixtures only.

- **Default drift due to scenario additions**
  - Mitigation: explicit `default` set manifest + regression tests asserting exact IDs.

### Medium

- **Volatile CI artifacts/logs causing flakiness**
  - Mitigation: bounded retries, stable fixture PRs, and diagnostics-specific assertions.

- **Capability-name mismatch between core and benchmark scenarios**
  - Mitigation: add scenario check that task IDs exist in `@ghx-dev/core` capability list (follow-up enhancement).

### Low

- **Reporting complexity creep**
  - Mitigation: defer set-level dashboards; only persist metadata now.

---

## Verification Plan

### Unit tests

1. CLI args parsing (`--scenario-set`, precedence with `--scenario`).
2. Scenario-set loader and resolver behavior.
3. `check-scenarios` validations (missing refs, duplicates, orphans, unknown sets).
4. Runner selection behavior for default/set/single-scenario paths.

### Integration tests

1. Benchmark CLI main delegates set-aware options to runner.
2. Runner writes rows with expected `scenario_set` metadata.

### Regression checks

1. Assert default set includes current thin-slice scenario IDs only.
2. Ensure existing benchmark commands still work:

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run typecheck
```

### Acceptance criteria

1. Scenario sets are defined and validated.
2. Default benchmark behavior remains stable.
3. New capability families are represented by scenarios in appropriate sets.
4. `pr-operations-all` is runnable and complete relative to the dependency spec.

---

## Rollout

1. Add set infrastructure (types, parser, resolver, validation).
2. Introduce set manifest with `default` mapped to current thin-slice scenarios.
3. Add new PR/CI scenarios in non-default sets.
4. Enable full-suite experimentation via `--scenario-set pr-operations-all`.
5. Keep CI gate on default set unless policy changes later.

---

## Implementation Record (2026-02-14)

### Scenario-set infrastructure shipped

- Added manifest source of truth: `packages/benchmark/scenario-sets.json`
- Added CLI support for `--scenario-set` with precedence:
  1. `--scenario`
  2. `--scenario-set`
  3. implicit `default`
- Added `scenario_set` metadata to benchmark rows (`null` for explicit single-scenario runs)
- Extended `check-scenarios` validation for:
  - missing required sets (`default`, `pr-operations-all`)
  - unknown scenario IDs referenced by sets
  - orphan scenarios not present in any set

### Set coverage shipped

- `default`: unchanged thin-slice baseline scenarios
- `pr-review-reads`: populated with PR read/check/mergeability scenarios
- `pr-thread-mutations`: populated with thread mutation/ready scenarios
- `ci-diagnostics`: populated with annotations/runs/jobs/log retrieval scenarios
- `ci-log-analysis`: populated with workflow log analysis scenario
- `pr-operations-all`: populated with the union of all `pr.*` operation scenarios only

### Verification evidence

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run typecheck
pnpm --filter @ghx-dev/benchmark run lint
```

All commands passed during implementation and re-review cycles.
