# ghx-router Phased Implementation Plan

Status: active primary execution plan.

## Phase 1: Core CLI Skeleton + Contract Layer

### Goal
Establish a stable `ghx` entrypoint with typed task contracts and deterministic validation.

### Deliverables
- `ghx run <task-id> --input <json>` command scaffold.
- Task contract schema system for input/output definitions.
- Structured error envelope foundation (`code`, `message`, `details`, `retryable`).

### Exit Criteria
- Contract validation fails fast with normalized errors.
- At least three seed tasks run end-to-end with stub adapters.
- Output envelope shape is stable (`success`, `data`, `error`, `meta`).

## Phase 2: Policy + Routing Engine

### Goal
Encode CLI-first decision rules in runtime policy.

### Deliverables
- Routing engine implementing preference order: `cli` -> `rest` -> `graphql`.
- Reason codes: `coverage_gap`, `efficiency_gain`, `output_shape_requirement`.
- Capability registry with default route, fallbacks, and required scopes.

### Exit Criteria
- Route decisions are deterministic and test-covered.
- Every route includes rationale in `meta`.
- No adapter bypass outside policy.

## Phase 2.5: Thin Benchmark Slice (Early Signal)

### Goal
Establish an early measurement baseline before full implementation scale.

### Deliverables
- Minimal benchmark harness for 5-8 scenarios.
- Baseline results for Agent-Direct mode (and MCP mode when available).
- Initial `ghx` comparison for whatever tasks are already implemented.
- Report with early deltas and gaps.

### Exit Criteria
- `packages/benchmark/scenarios/` contains at least five stable scenarios.
- `packages/benchmark/results/` captures repeat runs with mode labels.
- One summary report exists with median latency/token/tool-call comparison.
- Findings are used to refine Phase 3-5 priorities.

## Phase 3: Execution Adapters (CLI + GraphQL First)

Status: complete.

### Goal
Deliver robust execution for common workflows through `gh` and GraphQL.

### Deliverables
- CLI adapter wrapping `gh ... --json`.
- GraphQL adapter with typed query support for high-value task paths.
- Auth/scope preflight checks with actionable errors.

### Exit Criteria
- Common task paths succeed without manual route changes.
- Retry/backoff is bounded and consistent.
- Adapter failures map to common error codes.

## Phase 4: Normalization, Telemetry, and Targeted GraphQL

Status: active.

### Goal
Guarantee consistent outputs and capture metrics needed to prove efficiency.

### Deliverables
- Normalization layer for a single output envelope across all adapters.
- Telemetry hooks for latency, retries, route, API calls, and payload sizes.
- Typed GraphQL adapter for selected high-value deep queries.

### Exit Criteria
- All task outputs conform to normalized envelope.
- Telemetry is emitted for every invocation.
- GraphQL use is limited to documented wins.

## Phase 5: v1 Task Coverage (8-12 Tasks)

### Goal
Reach the v1 functional surface for high-frequency PR, issue, and repo operations.

### Deliverables
- Implement prioritized task contracts and adapters:
  - PR: list/view/create-draft/update/checks
  - Issues: list/view/create/update-labels
  - Repo: metadata/releases/rulesets
  - One cross-entity query
- Capability registry entries for all shipped tasks.

### Exit Criteria
- 8-12 tasks are implemented, tested, and documented.
- Contract and adapter integration tests pass.
- v1 non-goals are preserved.

## Phase 6: Benchmark Harness + Validation Gate

### Goal
Prove efficiency claims with repeatable measurements.

### Deliverables
- Benchmark artifacts under `packages/benchmark/`:
  - `scenarios/*.json`
  - `results/*.jsonl`
  - `reports/*.md`
  - `reports/latest-summary.json`
- Runner for modes: Agent-Direct, MCP (if available), ghx-router.
- Aggregation/reporting for median/P90 and confidence intervals.

### Exit Criteria
- Meets success thresholds from evaluation plan:
  - >=25% median token reduction
  - >=20% median latency reduction on common tasks
  - >=30% tool call reduction
  - Non-inferior success rate
  - >=99% output validity
- Release report published with regression notes.

## Dependencies and Risk Controls

- Phase 1 is a prerequisite for all later phases.
- Phase 2 should be stable before scaling adapters and task count.
- Phase 2.5 provides early direction and should complete before broad task expansion in Phase 5.
- Phase 4 telemetry must be complete before benchmark claims.
- Keep GraphQL scoped to explicit efficiency/output-shape wins.
- Avoid scope creep into full `gh` parity or MCP-first expansion before validation gate.
