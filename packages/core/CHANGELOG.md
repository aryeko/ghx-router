# @ghx-dev/core

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

  **Release and delivery** -- `release.list`, `release.get`, `release.create_draft`, `release.update`, `release.publish_draft`, `workflow_dispatch.run`, `workflow_run.rerun_failed`, `workflow_run.rerun_all`, `workflow_run.cancel`, `workflow_run.get`, `workflow_run.artifacts.list`, `workflow.list`, `workflow.get`

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
