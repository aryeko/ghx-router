# ghx-router

CLI-first GitHub execution router for agents, with card-driven routing and a normalized runtime envelope.

## Status

- v1 agentic interface is implemented for the thin-slice capabilities:
  - `repo.view`
  - `issue.view`
  - `issue.list`
  - `issue.comments.list`
  - `pr.view`
  - `pr.list`
- Core runtime, benchmark harness, and architecture docs are aligned to the shipped contract.

## Core Idea

Agents should not re-fetch GitHub schema/docs on every run. `ghx-router` provides:

- a stable capability interface,
- deterministic route selection,
- typed GraphQL + structured CLI adapters,
- normalized output and error semantics.

## Interface (v1)

Primary command surface:

```bash
ghx run <task-id> --input '<json>'
```

Normalized runtime envelope:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "graphql",
    "reason": "CARD_PREFERRED"
  }
}
```

## Routing (v1)

- Capabilities are defined by operation cards in `packages/ghx-router/src/core/registry/cards.ts`.
- Route plan is deterministic: `preferred` then ordered `fallbacks`.
- Current shipped cards prefer `graphql` with `cli`/`rest` fallbacks.
- Preflight checks gate route eligibility before execution.

## Runtime Guarantees

- Stable envelope contract (`ok`, `data`, `error`, `meta`).
- Structured error taxonomy (AUTH, VALIDATION, NETWORK, RATE_LIMIT, SERVER, etc).
- Route-level retry/fallback orchestration with optional attempt trace metadata.
- Telemetry events for route planning/attempts; sensitive context is redacted.

## Benchmarking

- Harness: `packages/benchmark/`
- Scenarios: `packages/benchmark/scenarios/`
- Runner and extraction: `packages/benchmark/src/`
- Summary artifacts: `packages/benchmark/reports/`

## Docs

- Architecture overview: `docs/architecture/overview.md`
- System design: `docs/architecture/system-design.md`
- Contracts: `docs/architecture/contracts.md`
- Routing policy: `docs/architecture/routing-policy.md`
- Errors and retries: `docs/architecture/errors-and-retries.md`
- Repository structure: `docs/architecture/repository-structure.md`
- Agent interface tools: `docs/architecture/agent-interface-tools.md`
- Operation card registry: `docs/architecture/operation-card-registry.md`
- Telemetry: `docs/architecture/telemetry.md`
- Benchmark methodology: `docs/benchmark/methodology.md`
- Benchmark metrics: `docs/benchmark/metrics.md`
- Benchmark harness design: `docs/benchmark/harness-design.md`
- Benchmark reporting: `docs/benchmark/reporting.md`
- Efficiency criteria: `docs/benchmark/efficiency-criteria.md`
- Scenario assertions: `docs/benchmark/scenario-assertions.md`
- CI workflows: `docs/engineering/ci-workflows.md`
- Nx commands: `docs/engineering/nx-commands.md`
- Changesets and publishing: `docs/release/changesets-and-publishing.md`
- Codecov coverage policy: `docs/quality/codecov-coverage-policy.md`

## Verification

```bash
pnpm run build
pnpm run lint
pnpm run ci
pnpm run ghx:gql:check
pnpm run benchmark:check
```

Codecov common recipes: https://docs.codecov.com/docs/common-recipe-list
