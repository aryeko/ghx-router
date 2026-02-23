# @ghx-dev/benchmark

## 0.2.2

### Patch Changes

- Updated dependencies [a38e812]
- Updated dependencies [de1c7a1]
- Updated dependencies [bc10ce8]
- Updated dependencies [d3564e2]
- Updated dependencies [0b0335b]
- Updated dependencies [871d369]
- Updated dependencies [fb05c12]
- Updated dependencies [bc10ce8]
- Updated dependencies [c4fbcaa]
- Updated dependencies [89344ca]
- Updated dependencies [bc10ce8]
- Updated dependencies [7225358]
- Updated dependencies [bc10ce8]
- Updated dependencies [58cc7fe]
  - @ghx-dev/core@0.2.0

## 0.2.1

### Patch Changes

- 7d27c7b: Refactor benchmark package internals for improved testability and maintainability (SOLID principles).

  - Extract shared CLI flag-parsing utilities into `src/cli/flag-utils.ts`
  - Extract shared CLI entry-point guard into `src/cli/entry.ts`
  - Extract shared `isObject` guard into `src/utils/guards.ts`
  - Extract shared JSONL parsing utilities into `src/utils/jsonl.ts`
  - Extract shared `gh` CLI client for fixtures into `src/fixture/gh-client.ts`
  - Consolidate JSON scanner utilities into `src/extract/envelope.ts`
  - Extract envelope recovery logic into `src/runner/envelope-recovery.ts`
  - Extract session polling helpers into `src/runner/session-polling.ts`
  - Extract client lifecycle management into `src/runner/client-lifecycle.ts`
  - Extract injectable runner config into `src/runner/config.ts`
  - Unify `SuiteConfig` type via shared Zod schema in `src/cli/suite-config-schema.ts`
  - Centralize report contract types into `src/domain/types.ts`
  - Make `buildSummary` deterministic with optional timestamp parameter; fix O(n²) row grouping
  - Add test coverage for `mcp` mode and multi-repetition runs
  - Add shared scenario factory for test files

- Updated dependencies [d2b4892]
  - @ghx-dev/core@0.1.2

## 0.2.0

### Minor Changes

- 68a9cad: Benchmark updates:

  - Add a config-driven benchmark suite runner workflow with paired mode execution, progress events,
    fixture setup/cleanup commands, and reporting/gating orchestration.
  - Expand benchmark scenario coverage with seeded fixture bindings for issues, PRs, workflows,
    releases, and project-v2 flows, including fixture auth/bootstrap tooling.
  - Harden fixture resolution and seeding behavior (safer manifest binding paths, check-run id
    handling, stricter CLI input validation), and improve dashboard rendering/progress semantics.
  - Increase benchmark validation quality with broader schema/assertion checks and significantly
    expanded unit-test coverage across CLI, fixture, runner, and reporting modules.

  Core updates:

  - Extend CLI capability adapter coverage and handling for workflow id/input normalization and
    project-v2 item list normalization edge cases.

### Patch Changes

- 74d4a61: Core updates:

  - Externalize `ghx setup` skill text into a bundled `SKILL.md` asset, copy skill assets into `dist`,
    and load setup content from packaged asset paths at runtime.
  - Standardize setup install target to `.agents/skills/ghx/SKILL.md` (user and project scopes), and
    align setup docs/tests to the same canonical path.
  - Improve setup command robustness by handling ENOENT checks consistently, awaiting skill-file reads
    in the asset loader path, and adding/refreshing unit and e2e tests for setup install/verify and
    asset error scenarios.
  - Align setup usage guidance across core docs/readmes (`--scope`-based usage).

  Benchmark updates:

  - Fix scenario schema record typing for zod v4 compatibility.

  Repo tooling/docs updates included in this branch:

  - Update pre-commit typecheck hook environment configuration for consistent Nx behavior.
  - Add a dedicated setup command guide and synchronize onboarding references.

- 2179f98: Benchmark updates:

  - Refactor suite execution by splitting mode-instruction, preflight, and prompt-rendering logic
    into focused runner modules.
  - Align benchmark mode instructions and ghx preflight behavior, including stricter preflight
    checks for router readiness and fixture usage.
  - Improve prompt rendering and output schema handling, including `pageInfo` compatibility.
  - Add and update unit coverage for suite-runner, preflight, mode instruction, and prompt renderer
    paths.

  Core updates:

  - Adjust run-path routing behavior and CLI integration to align with benchmark runner updates.
  - Refresh CLI/engine tests around run command flow and repository view behavior.

- ed5a848: Add set-by-set verification orchestration and harden benchmark/report CLI behavior.

  - add `verify:set` orchestration and `verify:mini:by-set` script flow
  - support explicit provider/model/output and repeated scenario filters in benchmark CLI
  - support explicit suite JSONL inputs and summary output paths in report CLI
  - preserve rerun results correctly across iterations and enforce row-count validation
  - add fixture cleanup support for ordered verification runs

- Updated dependencies [68a9cad]
- Updated dependencies [74d4a61]
- Updated dependencies [2179f98]
  - @ghx-dev/core@0.1.1

## 0.1.1

### Patch Changes

- Updated dependencies [eaba8ea]
  - @ghx-dev/core@0.1.0
