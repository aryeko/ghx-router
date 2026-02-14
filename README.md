# ghx

> A stable capability interface for AI agents that interact with GitHub.

[![CI](https://github.com/aryeko/ghx/actions/workflows/ci-pr.yml/badge.svg)](https://github.com/aryeko/ghx/actions/workflows/ci-pr.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

AI agents that work with GitHub waste tokens re-discovering the API surface on every run. They re-fetch schemas, re-learn endpoints, and re-parse documentation—leading to higher latency, higher cost, and brittle behavior.

## The Solution

ghx provides a **card-driven capability router** that gives agents a stable, typed interface to GitHub operations. Agents call capabilities by ID; ghx handles route selection (GraphQL, CLI, REST), retries, fallbacks, and normalized output—so agents spend tokens on reasoning, not on API discovery.

## Quick Start

```bash
# From the repo (CLI is in @ghx/core)
pnpm install
pnpm run build
pnpm exec ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Normalized output:

```json
{
  "ok": true,
  "data": { "id": "...", "name": "ghx", "nameWithOwner": "aryeko/ghx", ... },
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## How It Works

- Capabilities are defined by runtime-loaded operation cards in `packages/core/src/core/registry/cards/*.yaml`.
- Route plan is deterministic: `preferred` then ordered `fallbacks`.
- CLI-suitable capabilities (`repo.view`, `issue.view`, `issue.list`, `pr.view`, `pr.list`) prefer `cli` with `graphql` fallback.
- `issue.comments.list` prefers `graphql` with `cli` fallback.
- REST is not part of v1 route preference ordering.
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
- Publishing guide: `docs/guides/publishing.md`
- Codecov coverage policy: `docs/quality/codecov-coverage-policy.md`

## Verification

```bash
pnpm run build
pnpm run lint
pnpm run ci
pnpm run ghx:gql:check
pnpm run benchmark:check
```

## Capabilities

Core capabilities currently include:

- Repository + issues: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`
- Pull request base: `pr.view`, `pr.list`
- Pull request review reads: `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`
- Pull request checks + mergeability: `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`
- Pull request thread mutations: `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`
- CI diagnostics and logs: `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`

For exact routing/input/output contracts, see `packages/core/src/core/registry/cards/*.yaml`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and PR guidelines.

## License

MIT © Arye Kogan
