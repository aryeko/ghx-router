# Benchmark Package

Benchmark tooling for `ghx-router`.

## Commands

- `pnpm --filter @ghx-router/benchmark run run -- agent_direct 1 --scenario pr-view-001`
- `pnpm --filter @ghx-router/benchmark run report`
- `pnpm --filter @ghx-router/benchmark run report:gate`
- `pnpm --filter @ghx-router/benchmark run test`
- `pnpm --filter @ghx-router/benchmark run typecheck`

## Scope

- Scenario schemas and validation
- Parsing and extraction helpers
- CLI entrypoint for benchmark execution
- Suite runner and OpenCode SDK integration
- Benchmark summary report and validation gate output
