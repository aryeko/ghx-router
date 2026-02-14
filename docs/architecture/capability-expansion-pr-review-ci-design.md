# Capability Expansion Design: PR Review Threads + CI Diagnostics

**Status:** Implemented (Batches 1-4)  
**Date:** 2026-02-14  
**Audience:** Core runtime engineers, adapter owners, benchmark maintainers

---

## 1) Motivation

`ghx` currently ships a strong read-only thin slice for repository, issue, and pull request summaries, but it does not yet support the review and CI workflows that dominate day-to-day PR execution.

Agents need first-class support for:

- review-thread triage (especially unresolved-only views),
- in-thread collaboration (reply/resolve/unresolve),
- merge-readiness checks,
- CI failure inspection and log analysis.

Without these capabilities, agents either fall back to ad hoc CLI/API calls or require humans to bridge key steps manually. That increases token overhead, introduces inconsistent output shapes, and weakens deterministic routing/value guarantees.

This design extends the capability surface while preserving core `ghx` invariants:

- card-driven routing and validation,
- normalized result envelopes,
- bounded retries/fallbacks,
- benchmarkable behavior.

---

## 2) Goals

1. Add an end-to-end PR review workflow surface covering unresolved threads, review actions, checks, and CI diagnostics.
2. Keep all new features inside the existing operation-card + adapter architecture.
3. Preserve deterministic routing policy and stable output contracts.
4. Add robust support for `pr.comments.list` with `unresolvedOnly` filtering.
5. Ensure every new capability is testable, benchmarkable, and CI-gated.

## 3) Non-goals

- Implementing every GitHub PR mutation in this release.
- Replacing all raw `gh api` usage beyond defined capability contracts.
- Shipping autonomous remediation (for example auto-fixing CI failures).

---

## 4) Scope: Capability Plan (ghx)

### Batch 1: PR review and merge-readiness reads

- `pr.comments.list` (with `unresolvedOnly`, `includeOutdated`)
- `pr.reviews.list`
- `pr.diff.list_files`
- `pr.status.checks`
- `pr.checks.get_failed`
- `pr.mergeability.view`

### Batch 2: PR thread mutations

- `pr.comment.reply`
- `pr.comment.resolve`
- `pr.comment.unresolve`
- `pr.ready_for_review.set`

### Batch 3: CI diagnostics retrieval

- `check_run.annotations.list`
- `workflow_runs.list`
- `workflow_run.jobs.list`
- `workflow_job.logs.get`

### Batch 4: CI diagnostics interpretation

- `workflow_job.logs.analyze`

---

## 5) Routing Strategy by Capability

### GraphQL-preferred

- `pr.comments.list`
- `pr.comment.reply`
- `pr.comment.resolve`
- `pr.comment.unresolve`
- `pr.reviews.list`
- `pr.diff.list_files`

### CLI-preferred

- `pr.status.checks`
- `pr.checks.get_failed`
- `pr.mergeability.view`
- `pr.ready_for_review.set`
- `check_run.annotations.list`
- `workflow_runs.list`
- `workflow_run.jobs.list`
- `workflow_job.logs.get`
- `workflow_job.logs.analyze`

Rationale:

- GraphQL is the best source of truth for review-thread semantics (thread IDs, resolved flags, reply/resolve mutations).
- CLI is pragmatic and stable for checks/workflow operations and mirrors common operator workflows.

---

## 6) Detailed Design: `pr.comments.list` (unresolved-only support)

### 6.1 Why this capability matters

Unresolved review threads are the highest-signal queue for PR completion. Agents need a precise "what still needs attention" view rather than scanning all review comments.

### 6.2 API reality and constraints

- GitHub GraphQL exposes `pullRequest.reviewThreads(first, after, ...)`.
- There is no server-side `unresolvedOnly` filter argument on `reviewThreads`.
- Each thread includes `isResolved`, `isOutdated`, `viewerCanResolve`, `viewerCanUnresolve`.

Implication: unresolved filtering must be done in adapter logic after retrieval.

### 6.3 Input contract

`pr.comments.list` input schema:

- `owner` (string, required)
- `name` (string, required)
- `prNumber` (integer > 0, required)
- `first` (integer > 0, optional, default 30)
- `after` (string|null, optional)
- `unresolvedOnly` (boolean, optional, default `false`)
- `includeOutdated` (boolean, optional, default `true`)

Semantics:

- If `unresolvedOnly=false`, return all threads.
- If `unresolvedOnly=true`, return only threads where `isResolved=false`.
- If additionally `includeOutdated=false`, exclude `isOutdated=true` from that unresolved set.

### 6.4 Output contract

Return normalized thread-centric output:

- `items`: array of review threads with fields:
  - `id`, `path`, `line`, `startLine`, `diffSide`, `subjectType`
  - `isResolved`, `isOutdated`
  - `viewerCanReply`, `viewerCanResolve`, `viewerCanUnresolve`
  - `resolvedByLogin`
  - `comments` (bounded nested list with `id`, `authorLogin`, `body`, `createdAt`, `url`)
- `pageInfo`: `{ hasNextPage, endCursor }`

Optional `meta` additions:

- `filter_applied`: `{ unresolvedOnly, includeOutdated }`
- `scan`: `{ pagesScanned, sourceItemsScanned, scanTruncated }`

### 6.5 Pagination and fill behavior

Problem: if many early threads are resolved, naive one-page filtering can return tiny result sets.

Design:

- Implement bounded fill scanning in GraphQL adapter:
  - Fetch source pages until either:
    - collected filtered items reaches requested `first`, or
    - source pages exhausted, or
    - `maxScanPages` threshold reached.
- `maxScanPages` default: 5 (configurable constant).
- If threshold reached while source has more pages, set `scanTruncated=true`.

This keeps unresolved views useful while bounding latency.

### 6.6 Route behavior

- Preferred: GraphQL.
- Fallback: CLI (`gh api graphql`) optional; if fallback cannot preserve contract shape, return `ADAPTER_UNSUPPORTED` rather than a lossy payload.

### 6.7 Error mapping

- invalid params -> `VALIDATION`
- missing PR/thread -> `NOT_FOUND`
- auth/scope failures -> `AUTH`
- rate/network/server mapped via existing normalization.

---

## 7) Requirements

### 7.1 Functional requirements

1. Every new capability has a validated operation card with strict input/output schema.
2. `pr.comments.list` supports unresolved-only and includeOutdated filtering.
3. Reply/resolve/unresolve operations accept canonical thread IDs and return updated thread metadata.
4. Checks/workflow capabilities expose enough metadata for deterministic diagnostics and downstream analysis.
5. Log analysis returns structured, machine-consumable summaries (not free-form text only).

### 7.2 Quality requirements

1. No raw upstream payloads in default success outputs.
2. Deterministic routing and reason codes remain intact.
3. Backward compatibility: existing v1 capabilities unaffected.
4. Bounded retries and bounded log/thread scanning.

### 7.3 Security and safety requirements

1. No token/header leakage in envelope data, errors, or telemetry.
2. CLI execution remains `shell: false` via safe runner.
3. Large log retrieval is size-bounded and truncation-signaled.

---

## 8) Implementation Touch Points

- `packages/core/src/core/registry/cards/*.yaml` (new cards)
- `packages/core/src/core/registry/index.ts` (preferred ordering)
- `packages/core/src/gql/operations/*.graphql` (new queries/mutations)
- `packages/core/src/gql/client.ts` (input/output models + mapping)
- `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts`
- `packages/core/src/core/execution/adapters/cli-capability-adapter.ts`
- `packages/core/src/core/routing/engine.ts` (deps and capability wiring)
- generated GraphQL artifacts under `packages/core/src/gql/generated/` and `packages/core/src/gql/operations/*.generated.ts`

---

## 9) Verification Plan

### 9.1 Unit verification

- Card validation tests for every added capability.
- GraphQL adapter tests:
  - unresolved filtering correctness,
  - includeOutdated behavior,
  - fill-scan bounds and truncation flag.
- Mutation tests for reply/resolve/unresolve/ready.
- CLI adapter tests for checks/workflow retrieval and normalization.
- Log analyzer tests for deterministic extraction.

### 9.2 Integration verification

- Engine integration per route family:
  - GraphQL thread listing and filtering,
  - mutation success/failure normalization,
  - CLI checks/workflow retrieval pipeline.

### 9.3 Contract verification

- Validate all successful outputs against card `output_schema`.
- Ensure validation failures do not call adapters.

### 9.4 Release gate commands

Run before merge:

```bash
pnpm --filter @ghx-dev/core run typecheck
pnpm --filter @ghx-dev/core run lint
pnpm --filter @ghx-dev/core run test
pnpm --filter @ghx-dev/core run gql:check
pnpm run benchmark:check
```

For full branch verification:

```bash
pnpm run ci:affected --parallel=3 --outputStyle=static
pnpm run test:coverage --parallel=3 --outputStyle=static
```

---

## 10) Rollout and Acceptance Criteria

### Rollout

Ship in batch order (1 through 4), with each batch gated by tests and schema checks.

### Acceptance criteria

1. All listed capabilities are available via `list_capabilities`.
2. `pr.comments.list` unresolved-only behavior is documented and tested.
3. New capability outputs are stable envelopes and schema-valid.
4. CI diagnostics path supports list -> jobs -> logs -> analyze flow.
5. No regression in existing thin-slice capability tests.

---

## 11) Implementation Record (2026-02-14)

### 11.1 Shipped capabilities

- Batch 1 reads: `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`, `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`
- Batch 2 mutations: `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`
- Batch 3 diagnostics retrieval: `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`
- Batch 4 diagnostics interpretation: `workflow_job.logs.analyze`

### 11.2 Notable implementation decisions

- `pr.comments.list` is GraphQL-only (`fallbacks: []`) to avoid lossy fallback behavior.
- `pr.comments.list` filtering semantics follow spec exactly:
  - `unresolvedOnly=false` returns all threads.
  - `unresolvedOnly=true` applies unresolved filtering, with optional `includeOutdated=false`.
- `pr.comments.list` pagination uses edge cursors so filtered pagination does not skip eligible threads.
- `workflow_job.logs.get` enforces bounded payload size and sets explicit `truncated`.
- `workflow_job.logs.analyze` returns structured summary (`errorCount`, `warningCount`, `topErrorLines`) from bounded logs.

### 11.3 Verification evidence

Executed on feature branch:

```bash
pnpm --filter @ghx-dev/core run typecheck
pnpm --filter @ghx-dev/core run lint
pnpm --filter @ghx-dev/core run test
pnpm --filter @ghx-dev/core run gql:check
pnpm --filter @ghx-dev/benchmark run typecheck
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run lint
```

All commands passed during implementation and follow-up review/fix cycles.
