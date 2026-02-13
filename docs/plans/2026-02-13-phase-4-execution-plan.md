# Phase 4 Execution Plan (Normalization + Telemetry)

Status: active.

## Objective

Complete a production-grade normalization and telemetry layer so every execution path emits consistent envelopes and measurable runtime metadata for benchmark validation.

## Scope

In scope:
- `packages/ghx-router/src/core/execution/normalizer.ts`
- `packages/ghx-router/src/core/telemetry/logger.ts`
- `packages/ghx-router/src/core/telemetry/metrics.ts`
- `packages/ghx-router/src/core/routing/engine.ts`
- integration tests under `packages/ghx-router/test/integration/`
- targeted GraphQL expansion for one high-value deep query path

Out of scope:
- broad task-surface expansion (Phase 5)
- benchmark threshold sign-off (Phase 6)

## Workstreams

### 1) Envelope Normalization Hardening
1. Extend normalizer to include stable timing and pagination metadata contracts.
2. Ensure error and success envelopes include deterministic `meta.source` and `meta.reason`.
3. Add normalization tests for edge cases (missing fields, unknown payloads).

Deliverable: one normalized envelope contract across all route outputs.

### 2) Telemetry Foundation
1. Implement structured logger events for task start, route decision, completion, failure.
2. Implement metrics collector for latency, retries, route, and execution source.
3. Wire telemetry emission into `engine.ts` execution lifecycle.

Deliverable: telemetry emitted for every invocation with stable event schema.

### 3) Targeted GraphQL Extension
1. Add one deep-query GraphQL operation where typed API is clearly better than CLI.
2. Integrate through existing generated SDK operation path.
3. Capture route rationale in meta (`output_shape_requirement` or `efficiency_gain`).

Deliverable: one documented GraphQL win beyond simple `view` calls.

### 4) Test and Validation Gates
1. Add integration tests for telemetry emission and normalized metadata fields.
2. Add regression tests ensuring route decisions remain deterministic.
3. Keep codegen drift check and benchmark scenario checks green.

Verification commands:
- `pnpm run verify`
- `pnpm run benchmark:check`
- `pnpm --filter @ghx-router/core run gql:check`

## Incremental Delivery Sequence

1. Normalizer metadata contract completion.
2. Telemetry logger + metrics implementation.
3. Engine lifecycle instrumentation.
4. One targeted deep-query GraphQL path.
5. Integration verification and cleanup.

## Risks and Mitigation

- Risk: telemetry changes alter output contracts.
  - Mitigation: strict envelope contract tests with snapshot-safe assertions.
- Risk: overuse of GraphQL beyond targeted wins.
  - Mitigation: require reason code evidence and docs for each GraphQL expansion.
- Risk: instrumentation overhead affects latency.
  - Mitigation: keep telemetry lightweight and benchmark before/after.

## Exit Criteria

- Normalization layer fully covers success and error paths with stable metadata.
- Telemetry is emitted for each task execution with route + timing fields.
- At least one targeted GraphQL deep query is implemented and justified.
- Verification gates are green:
  - `pnpm run verify`
  - `pnpm run benchmark:check`
  - `pnpm --filter @ghx-router/core run gql:check`
