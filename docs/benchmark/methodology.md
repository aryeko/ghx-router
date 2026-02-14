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

## Metric System v2

The benchmark uses a dual-gate model to separate reliability from efficiency.

1. **Reliability gate (raw rows):**
   - evaluates all completed rows,
   - includes success, output validity, runner failure, timeout/stall, and retry rates.
2. **Efficiency gate (stable sample):**
   - evaluates only rows that are `success=true`, `output_valid=true`, and not `runner_error`,
   - computes per-scenario medians per mode,
   - compares `ghx_router` vs `agent_direct` on active tokens, latency, and tool calls,
   - requires minimum scenario coverage so reductions are not computed from a tiny subset.

This design keeps timeout/intermittent runner stalls from corrupting efficiency metrics while still failing reliability when those events become frequent.

## Aggregation Strategy

- scenario-stratified medians (median per scenario, then median across scenarios)
- active tokens: `tokens.total - tokens.cache_read`
- coverage guard: eligible scenarios / total scenarios in compared modes

This avoids one noisy scenario dominating suite-level medians and improves comparability across runs.

## Output Validation

Benchmark output validation checks:

- envelope shape (`ok`, `data`, `error`, `meta`)
- required fields/data fields from scenario assertions
- tool-call min/max constraints
- optional attempt-trace requirement

See:

- `docs/benchmark/scenario-assertions.md`
- `docs/benchmark/harness-design.md`
- `docs/benchmark/metrics.md`
- `docs/benchmark/efficiency-criteria.md`
