# @ghx-dev/benchmark (Private)

Internal benchmark harness for `ghx` maintainers.

This package is intentionally **private** and is not published to npm. It compares baseline `agent_direct` runs against `ghx_router` runs for correctness, latency, token usage, and tool-call counts.

## What It Covers

- Scenario schemas and validation
- Benchmark CLI runner and scenario execution
- Parsing/extraction helpers for benchmark outputs
- Summary report generation and gate checks

## Common Commands

```bash
pnpm --filter @ghx-dev/benchmark run run -- agent_direct 1 --scenario pr-view-001

pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set pr-exec
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set issues
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set release-delivery
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set workflows
pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set projects-v2

pnpm --filter @ghx-dev/benchmark run report
pnpm --filter @ghx-dev/benchmark run report:gate

pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run typecheck
```

## Scenario Sets

- `default` - stable and mutation-free
- `pr-exec`
- `issues`
- `release-delivery`
- `workflows`
- `projects-v2`
- `all` - exact union of A-D roadmap sets

## Outputs

- Latest summary: `packages/benchmark/reports/latest-summary.md`
- Scenario definitions: `packages/benchmark/scenarios/`

For benchmark methodology and reporting details, see:

- `docs/benchmark/methodology.md`
- `docs/benchmark/metrics.md`
- `docs/benchmark/reporting.md`
