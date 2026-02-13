# Benchmark Methodology

Defines scenario selection, execution strategy, and run controls.

## Modes

- `agent_direct`
- `mcp` (when available)
- `ghx_router`

## Run Controls

- Use fixed repository fixtures.
- Use fixed model/provider per suite.
- Run at least 10 repetitions per scenario/mode.
- Randomize scenario order with logged seed.
- Capture runtime metadata (model, commit, timestamp).

## Scope

- Thin-slice checkpoint: 5-8 scenarios.
- Full v1 suite: 20+ scenarios.

Canonical detail:

- `docs/benchmark/efficiency-criteria.md`
- `docs/benchmark/harness-design.md`
