# Benchmark Methodology

## Modes

- `agent_direct`
- `mcp`
- `ghx_router`

## Run Controls

- fixed scenario set across compared modes
- fixed repository fixtures
- fixed provider/model per suite
- repeated runs per scenario
- captured runtime metadata (commit, timestamp, model)

## Output Validation

Benchmark output validation checks:

- envelope shape (`ok`, `data`, `error`, `meta`)
- required fields/data fields from scenario assertions
- tool-call min/max constraints
- optional attempt-trace requirement

See:

- `docs/benchmark/scenario-assertions.md`
- `docs/benchmark/harness-design.md`
