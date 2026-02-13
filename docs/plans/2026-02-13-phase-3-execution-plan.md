# Phase 3 Execution Plan (Adapters + Hardening)

Status: completed.

## Objective

Implement robust execution adapters with consistent error handling and preflight checks so core v1 tasks can run through real execution paths (CLI first, GraphQL fallback).

## Scope

In scope:
- `packages/ghx-router/src/core/execution/adapters/cli-adapter.ts`
- `packages/ghx-router/src/core/execution/adapters/graphql-adapter.ts`
- `packages/ghx-router/src/core/execution/preflight.ts`
- `packages/ghx-router/src/core/errors/codes.ts`
- `packages/ghx-router/src/core/errors/map-error.ts`
- `packages/ghx-router/src/core/execution/normalizer.ts`
- task wiring in `packages/ghx-router/src/core/routing/engine.ts`
- integration tests under `packages/ghx-router/test/integration/`

Out of scope:
- broad GraphQL expansion (keep Phase 4)
- full task-surface expansion (keep Phase 5)

## Workstreams

### 1) Adapter Foundation
1. Define adapter interfaces for deterministic inputs/outputs.
2. Implement CLI adapter command runner with bounded execution timeout.
3. Implement GraphQL adapter wrapper with typed query execution and variable support.

Deliverable: CLI and GraphQL adapters return normalized raw execution results (before envelope normalization).

### 2) Preflight and Safety
1. Implement auth/scope preflight checks in `preflight.ts`.
2. Add failure categories for auth, scope, timeout, transport, parse, and unknown.
3. Ensure all adapter errors map through `map-error.ts` into stable error envelopes.

Deliverable: no uncaught adapter exceptions leak to callers.

### 3) Routing Integration
1. Wire Phase 2 routing decisions to real adapter invocation in `engine.ts`.
2. Preserve route reason codes in `meta`.
3. Add deterministic fallback behavior: CLI -> GraphQL only when policy permits.

Deliverable: route decision and execution path are both represented in output `meta`.

### 4) Normalization
1. Complete `normalizer.ts` for adapter-specific payload shaping.
2. Enforce normalized envelope for success and failure paths:
   - `success`
   - `data`
   - `error`
   - `meta`

Deliverable: every Phase 3 task returns envelope-consistent output.

### 5) Tests and Verification
1. Add adapter unit tests (success, timeout, parse failure, auth failure).
2. Add integration tests for route + execution path selection.
3. Add contract tests for error envelope shape.
4. Keep `packages/benchmark` scenario checks passing.

Verification commands:
- `pnpm run verify`
- `pnpm run benchmark:check`

## Incremental Delivery Sequence

1. `repo.view` end-to-end (CLI path only).
2. `issue.view` end-to-end (CLI + GraphQL fallback).
3. `pr.view` end-to-end (CLI + GraphQL fallback).
4. `issue.list` and `pr.list` with pagination defaults.

Each increment must include tests before adding the next task.

## Risks and Mitigation

- Risk: shell output parsing drift.
  - Mitigation: strict JSON mode usage and parse guards with typed fallback errors.
- Risk: hidden auth/scope failures in CI or new environments.
  - Mitigation: mandatory preflight checks and explicit `auth_or_scope_error` mapping.
- Risk: inconsistent envelopes across adapters.
  - Mitigation: normalization as single path plus envelope contract tests.

## Exit Criteria

- CLI and GraphQL adapters are implemented and invoked by routing engine.
- Preflight checks are enforced for adapter execution paths.
- Errors are normalized and stable across failure modes.
- Integration tests exist for route selection and execution fallback.
- `pnpm run verify` and `pnpm run benchmark:check` are green.

## Completion Record

- [x] CLI adapter envelope flow implemented with timeout/input controls.
- [x] GraphQL adapter and typed SDK path wired for `repo.view`, `issue.view`, and `pr.view`.
- [x] Preflight token checks enforced for GraphQL route execution.
- [x] Normalization helpers applied for success and error envelopes.
- [x] Route integration tests added under `packages/ghx-router/test/integration/`.
- [x] Verification gates green: `pnpm run verify`, `pnpm run benchmark:check`, and `gql:check`.
