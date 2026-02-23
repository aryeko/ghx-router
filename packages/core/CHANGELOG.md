# @ghx-dev/core

## 0.2.0

### Minor Changes

- a38e812: Add atomic capability chaining: `executeTasks()` function that executes multiple capabilities in a single GraphQL batch with ≤2 API round-trips. New `ghx chain --steps '<json-array>'` CLI command. Supersedes the unused composite capability system which has been removed.
- de1c7a1: ### Capability naming overhaul

  Renamed all capabilities to follow a consistent `domain.resource.action` pattern. Key renames include:

  - `pr.comments.list` → `pr.thread.list`, `pr.comment.reply` → `pr.thread.reply`, `pr.comment.resolve` → `pr.thread.resolve`, `pr.comment.unresolve` → `pr.thread.unresolve`
  - `pr.mergeability.view` → `pr.merge.status`, `pr.merge.execute` → `pr.merge`
  - `pr.status.checks` → `pr.checks.list`, `pr.checks.get_failed` → `pr.checks.failed`
  - `pr.reviews.list` → `pr.review.list`, `pr.reviewers.request` → `pr.review.request`
  - `pr.review.submit_approve`/`submit_comment`/`submit_request_changes` → unified `pr.review.submit` with `event` parameter
  - `pr.diff.list_files` → `pr.diff.files`, `pr.ready_for_review.set` → removed (replaced by `pr.update`)
  - `workflow_run.get` → `workflow.run.view`, `workflow_runs.list` → `workflow.runs.list`, `workflow_run.*` → `workflow.run.*`
  - `workflow_job.logs.get` → `workflow.job.logs.raw`, `workflow_job.logs.analyze` → `workflow.job.logs.get`
  - Removed redundant `workflow.run.jobs.list` capability

  ### New capabilities

  - `pr.diff.view` — view PR diff content
  - `issue.labels.add` — add labels to an issue (non-destructive; complements `issue.labels.update`)
  - `pr.create` — create a pull request
  - `pr.update` — update PR title/body/base
  - `workflow.run.view` (renamed from `workflow_run.get`) — now includes GraphQL routing

  ### GraphQL improvements

  - Extracted 3 shared GraphQL fragments (`PageInfoFields`, `IssueCoreFields`, `PrCoreFields`) reducing field duplication across 10 operation files
  - Routed `pr.merge.status` and `repo.view` through GraphQL (preferred) with CLI fallback
  - Added `fetchPrMergeStatus` to the GraphQL client

  ### Capabilities list enrichment

  - `capabilities list` now returns `required_inputs` per capability — agents can skip `explain` calls
  - `--domain` filter for `ghx capabilities list` (e.g., `--domain pr`)
  - Slimmed SKILL.md to reference `required_inputs` in list output

  ### stdin input support

  - `ghx run <task> --input -` reads JSON input from stdin with 10s timeout

  ### Integration tests

  - 58 new integration tests covering all previously untested capabilities

- bc10ce8: Add `optional_inputs` and `optional_inputs_detail` fields to `CapabilityListItem` for richer capability introspection. Also adds a required `optional_inputs` field to the exported `CapabilityExplanation` type — downstream consumers must handle this new field.
- d3564e2: Standardize all capability IDs to consistent naming conventions.

  **Renamed capabilities:**

  - `pr.thread.*` → `pr.threads.*` (list, reply, resolve, unresolve)
  - `pr.review.*` → `pr.reviews.*` (list, request, submit)
  - `pr.checks.rerun_all` → `pr.checks.rerun.all`
  - `pr.checks.rerun_failed` → `pr.checks.rerun.failed`
  - `workflow.get` → `workflow.view`
  - `workflow.dispatch.run` → `workflow.dispatch`
  - `workflow.run.rerun_all` → `workflow.run.rerun.all`
  - `workflow.run.rerun_failed` → `workflow.run.rerun.failed`
  - `workflow.job.logs.get` → `workflow.job.logs.view`
  - `project_v2.org.get` → `project_v2.org.view`
  - `project_v2.user.get` → `project_v2.user.view`
  - `project_v2.item.add_issue` → `project_v2.items.issue.add`
  - `project_v2.item.field.update` → `project_v2.items.field.update`
  - `release.get` → `release.view`
  - `release.create_draft` → `release.create`
  - `release.publish_draft` → `release.publish`
  - `issue.labels.update` → `issue.labels.set`
  - `issue.assignees.update` → `issue.assignees.set`
  - `issue.relations.get` → `issue.relations.view`
  - `issue.linked_prs.list` → `issue.relations.prs.list`
  - `issue.parent.set` → `issue.relations.parent.set`
  - `issue.parent.remove` → `issue.relations.parent.remove`
  - `issue.blocked_by.add` → `issue.relations.blocked_by.add`
  - `issue.blocked_by.remove` → `issue.relations.blocked_by.remove`

  **New capabilities:**

  - `issue.labels.remove` — remove specific labels from an issue
  - `issue.assignees.add` — add assignees without replacing existing
  - `issue.assignees.remove` — remove specific assignees
  - `issue.milestone.clear` — remove milestone from an issue
  - `pr.assignees.add` — add assignees to a PR
  - `pr.assignees.remove` — remove assignees from a PR
  - `project_v2.items.issue.remove` — remove an issue from a Projects v2 project

  **Retired capabilities:**

  - `pr.checks.failed` — merged into `pr.checks.list` (use `state: "failed"` filter)
  - `check_run.annotations.list` — annotations now inline in `pr.checks.list` output
  - `pr.assignees.update` — replaced by `pr.assignees.add` + `pr.assignees.remove`
  - `pr.threads.composite`, `issue.triage.composite`, `issue.update.composite` — composite infrastructure removed

  **Output schema changes:**

  - All rerun capabilities now return `{ runId: integer, queued: boolean }` (normalized)
  - `pr.threads.reply` output now includes `commentId` and `commentUrl`
  - `issue.relations.parent.set` output now includes `updated: boolean`
  - `issue.relations.blocked_by.add` output now includes `added: boolean`
  - `issue.milestone.set` no longer accepts `null` (use `issue.milestone.clear` instead)

- 0b0335b: Add Claude Code plugin infrastructure for native plugin installation.

  - Move skill to `skills/using-ghx/SKILL.md` with plugin frontmatter, serving both `ghx setup` and Claude Code plugin
  - Add `.claude-plugin/plugin.json` (package) and `.claude-plugin/marketplace.json` (repo root)
  - Add `sync-plugin-manifests.mjs` to generate plugin manifests from `package.json` with `--check` mode for CI
  - Remove redundant `dist/skills` copy (skills ship via `files` array at package root)

- 871d369: Remove `@ghx-dev/core/agent` subpath export. All agent tools (`createExecuteTool`, `explainCapability`, `listCapabilities`) are now exported from `@ghx-dev/core`. The `MAIN_SKILL_TEXT` constant has been removed.
- bc10ce8: Standardize all issue mutation capabilities to accept `{ owner, name, issueNumber }` instead of `{ issueId }`.

  **Breaking input change** for: `issue.close`, `issue.reopen`, `issue.delete`, `issue.update`, `issue.labels.set`, `issue.labels.add`, `issue.labels.remove`, `issue.assignees.set`, `issue.assignees.add`, `issue.assignees.remove`, `issue.milestone.set`, `issue.comments.create`.

  Each capability now resolves the GitHub node ID internally via a Phase 1 lookup before executing the Phase 2 mutation. This matches the input contract of `issue.view` and enables `ResolutionCache` hits when capabilities are chained together in `executeTasks` calls.

- 58cc7fe: Add structured JSONL execution logging. Emits typed log events at key points in the execution pipeline — preflight checks, route selection, adapter dispatch, all attempt failures (with `retryable` field), and results — written to `~/.ghx/logs/ghx-YYYY-MM-DD.jsonl`. Opt-in via `GHX_LOG_LEVEL` env var (debug/info/warn/error; unset = off). Log directory is configurable via `GHX_LOG_DIR`.

### Patch Changes

- fb05c12: Refactor CLI capability adapter into domain modules with full unit test coverage.

  **Refactoring:**

  - Split monolithic `cli-capability-adapter.ts` (2200+ lines) into focused domain modules under `core/execution/adapters/cli/domains/`: `repo.ts`, `issue.ts`, `pr.ts`, `workflow.ts`, `project-v2.ts`, `release.ts`
  - Extracted shared arg-building helpers to `cli/helpers.ts` (`buildRepoArg`, `buildPaginationArgs`, `buildFieldsFlag`, etc.)
  - Added `cli/capability-registry.ts` — auto-discovers all handlers by spreading domain `handlers` maps; `cli-capability-adapter.ts` becomes a thin dispatcher

  **Bug fixes:**

  - `pr.ts`: Use `rerunAllResult.exitCode` (not `result.exitCode`) in `handlePrChecksRerunFailed` fallback error path
  - `project-v2.ts`: Remove unreachable `SyntaxError` catch branch in `handleProjectV2ItemFieldUpdate` (no JSON parsing on the success path)
  - `release.ts`: Fix misleading error message — `owner`/`name` are already validated by `requireRepo`; only `releaseId` can be invalid at that point
  - `workflow.ts`: Track total error/warning counts independently of the 10-line collection cap in `handleWorkflowJobLogsGet`; type-narrow artifact `id` field consistently with other normalized fields

  **Tests:**

  - Added comprehensive unit test suites for all six domain modules (`cli-domains-*.test.ts`) and for the shared helpers (`cli-helpers.test.ts`) and capability registry (`cli-capability-registry.test.ts`) — all modified files at ≥90% branch coverage
  - Refactored e2e tests to use proper `afterEach`/`afterAll` lifecycle hooks instead of ESLint rule suppressions

  **Docs:**

  - Updated `docs/architecture/adapters.md` and `docs/architecture/repository-structure.md` to reflect the new domain module layout

- bc10ce8: Fix `ghx chain` / `executeTasks` batch resolution aliasing bug.

  `buildBatchQuery` aliases each GraphQL root field (e.g. `repository`) as `step0`, `step1`, etc. GitHub returns the value directly under the alias key with no wrapper. The engine was storing the unwrapped value, causing `applyInject` to fail when traversing inject paths like `repository.issue.id` in subsequent steps.

  Fix: `extractRootFieldName()` is added to `batch.ts` and used in the Phase 1 un-alias loop to re-wrap the raw value as `{ [rootFieldName]: rawValue }` before storing it in `lookupResults`. Adds regression test using real batch/resolve implementations.

- c4fbcaa: Refactor GQL layer: split monolithic client.ts into lazy-loaded domain modules, add capability registry dispatch, and rename common-types.ts to follow .generated convention. Import cost reduced from ~2,284 lines to ~220 lines via dynamic imports.
- 89344ca: Replace deep relative imports with `@core/*` path aliases for improved readability and maintainability.
- 7225358: Harden atomic chaining infrastructure based on review feedback:

  - Register `issue.assignees.add`/`remove` GraphQL handlers (types, mutations, client, capability registry) — these capabilities now route via GraphQL instead of falling back to CLI
  - Fix `GraphqlError.path` type to `ReadonlyArray<string | number>` per GraphQL spec
  - Normalize `queryRaw` error handling — HTTP errors now settle consistently regardless of transport implementation
  - Guard resolution cache against storing `undefined` and sweep expired entries before FIFO eviction
  - Check `response.ok` before `response.json()` and wrap happy-path parse in try/catch for truncated responses
  - Use strict `!== undefined` check for step errors instead of truthy check
  - Extract `buildLookupVars` helper to eliminate duplication in engine
  - Pass strings directly to `mapErrorToCode` instead of wrapping in `Error`

- bc10ce8: Improve `pr.reviews.submit` schema and capabilities list output.

  - Add `startLine` and `startSide` fields to `pr.reviews.submit` for multi-line comment ranges
  - Document the `side` vs `diffSide` naming asymmetry between submit input and `pr.threads.list` output
  - Annotate `body` conditionality: required for `COMMENT`/`REQUEST_CHANGES`, optional for `APPROVE`
  - Clarify `pr.reviews.list` description to note it returns review-level metadata only (not inline thread comments)
  - Show array item field hints in `capabilities list` text output (e.g. `comments?[path, body, line, side?, startLine?, startSide?]`)

## 0.1.2

### Patch Changes

- d2b4892: SOLID improvements: error handling, dead code removal, and testability.

  - fix `mapErrorToCode` to use word-boundary regex for HTTP status codes and reorder checks to prevent keyword collisions
  - fix `preflightCheck` to return `ADAPTER_UNSUPPORTED` for missing gh CLI instead of `VALIDATION`
  - remove 7 unimplemented capability IDs from `GraphqlCapabilityId` union and update YAML cards to prefer CLI
  - separate internal sentinel params (`__wasDraft`, `__effectiveRerunMode`) from `normalizeCliData` params into dedicated context arg
  - consolidate duplicate AJV instances into shared `ajv-instance.ts`
  - export `OperationCard` type from public API
  - remove dead code: 66 unused task stubs, empty command scaffolds, stub formatter, unused `ExecutionMetrics` interface

## 0.1.1

### Patch Changes

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

## 0.1.0

### Minor Changes

- eaba8ea: # First Public Release

  **ghx** is a typed GitHub execution router for AI agents. One capability interface. Deterministic routing. Normalized results. No more agents fumbling through `gh` CLI docs on every run.

  ## The Problem

  When agents interact with GitHub, they waste tokens re-discovering API surfaces, parsing inconsistent outputs, and handling errors ad hoc. Common PR operations that should be straightforward become multi-step research projects.

  ## What ghx Delivers

  Every capability returns a stable envelope: `{ ok, data, error, meta }`. Route selection, retries, fallbacks, and input/output validation are handled automatically through schema-driven operation cards.

  ### Benchmarked Results (agent_direct vs ghx)

  Across 27 runs on common PR operations:

  | Metric        | Improvement                          |
  | ------------- | ------------------------------------ |
  | Active tokens | **-37%** fewer tokens consumed       |
  | Latency       | **-32%** faster end-to-end           |
  | Tool calls    | **-33%** fewer tool invocations      |
  | Success rate  | **100%** for both (zero regressions) |

  Agents using ghx skip the research phase entirely: no manual route discovery, no output guessing, no wasted reasoning tokens.

  ### 66 Capabilities Shipped

  **Repository and issues** -- `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`, `issue.create`, `issue.update`, `issue.close`, `issue.reopen`, `issue.delete`, `issue.labels.update`, `issue.assignees.update`, `issue.milestone.set`, `issue.comments.create`, `issue.linked_prs.list`, `issue.relations.get`, `issue.parent.set`, `issue.parent.remove`, `issue.blocked_by.add`, `issue.blocked_by.remove`

  **PR review and merge** -- `pr.view`, `pr.list`, `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`, `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`, `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`, `pr.review.submit_approve`, `pr.review.submit_request_changes`, `pr.review.submit_comment`, `pr.merge.execute`, `pr.checks.rerun_failed`, `pr.checks.rerun_all`, `pr.reviewers.request`, `pr.assignees.update`, `pr.branch.update`

  **CI diagnostics** -- `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`

  **Release and delivery** -- `release.list`, `release.get`, `release.create_draft`, `release.update`, `release.publish_draft`, `workflow_dispatch.run`, `workflow_run.rerun_failed`, `workflow_run.rerun_all`, `workflow_run.cancel`, `workflow_run.view`, `workflow_run.artifacts.list`, `workflow.list`, `workflow.get`

  **Projects v2 and repo metadata** -- `project_v2.org.get`, `project_v2.user.get`, `project_v2.fields.list`, `project_v2.items.list`, `project_v2.item.add_issue`, `project_v2.item.field.update`, `repo.labels.list`, `repo.issue_types.list`

  ### Core Features

  - **Deterministic routing** -- each capability declares a `preferred` route and ordered `fallbacks`; the engine follows the plan without guesswork
  - **Runtime validation** -- AJV-powered input/output schema validation from operation cards catches errors before they reach GitHub
  - **Structured error taxonomy** -- canonical error codes (`AUTH`, `NOT_FOUND`, `RATE_LIMIT`, `VALIDATION`, ...) with `retryable` flags for predictable automation behavior
  - **Attempt metadata** -- every result includes `meta.attempts` detailing route, status, duration, and error codes per try
  - **CLI and library API** -- use `ghx run <capability>` from the terminal or `executeTask()` from code; `createGithubClientFromToken()` sets up a client in one line
  - **Agent interface** -- `@ghx-dev/core/agent` exports `createExecuteTool`, `listCapabilities`, `explainCapability`, and `MAIN_SKILL_TEXT` for agent frameworks
  - **Capability discovery** -- `ghx capabilities list` and `ghx capabilities explain <id>` for interactive exploration
  - **Agent onboarding** -- `ghx setup --platform claude-code` installs ghx as a project skill with a single command
  - **GraphQL + CLI adapters** -- dual execution paths with automatic fallback across routes
  - **GitHub Enterprise support** -- `GH_HOST` and `GITHUB_GRAPHQL_URL` for enterprise endpoints

  ### Quick Start

  ```bash
  npx @ghx-dev/core capabilities list
  npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
  ```
