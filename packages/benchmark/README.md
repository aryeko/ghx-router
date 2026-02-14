# Benchmark Package

Benchmark tooling for `ghx`.

## Commands

- `pnpm --filter @ghx/benchmark run run -- agent_direct 1 --scenario pr-view-001`
- `pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-a-pr-exec`
- `pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-b-issues`
- `pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-c-release-delivery`
- `pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-d-workflow-projects-v2`
- `pnpm --filter @ghx/benchmark run report`
- `pnpm --filter @ghx/benchmark run report:gate`
- `pnpm --filter @ghx/benchmark run test`
- `pnpm --filter @ghx/benchmark run typecheck`

## Roadmap Scenario Sets

- `default` remains stable and mutation-free
- `roadmap-batch-a-pr-exec`
- `roadmap-batch-b-issues`
- `roadmap-batch-c-release-delivery`
- `roadmap-batch-d-workflow-projects-v2`
- `roadmap-all` is the exact union of A-D

## Scope

- Scenario schemas and validation
- Parsing and extraction helpers
- CLI entrypoint for benchmark execution
- Suite runner and OpenCode SDK integration
- Benchmark summary report and validation gate output
