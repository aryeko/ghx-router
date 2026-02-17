# Benchmark Methodology

## Modes

- `agent_direct`
- `mcp`
- `ghx`

## Run Controls

- fixed scenario set across compared modes
- fixed repository fixtures
- sandbox mutation fixtures in `aryeko/ghx-bench-fixtures` (seeded via fixture manifest)
- fixed provider/model per suite
- repeated runs per scenario
- captured runtime metadata (commit, timestamp, model)
- one-time `gh auth status` preflight for `ghx` suites before scenario execution
- per-call CLI preflight skipped in benchmark execution path by default

## Metric System v2

The benchmark uses a dual-gate model to separate reliability from efficiency.

1. **Reliability gate (raw rows):**
   - evaluates all completed rows,
   - includes success, output validity, runner failure, timeout/stall, and retry rates.
2. **Efficiency gate (stable sample):**
   - evaluates only rows that are `success=true`, `output_valid=true`, and not `runner_error`,
   - computes per-scenario medians per mode,
   - compares `ghx` vs `agent_direct` on active tokens, latency, and tool calls,
   - requires minimum scenario coverage so reductions are not computed from a tiny subset.

This design keeps timeout/intermittent runner stalls from corrupting efficiency metrics while still failing reliability when those events become frequent.

## Aggregation Strategy

- scenario-stratified medians (median per scenario, then median across scenarios)
- active tokens: `tokens.total - tokens.cache_read`
- coverage guard: eligible scenarios / total scenarios in compared modes

This avoids one noisy scenario dominating suite-level medians and improves comparability across runs.

## Verify Workflow (PR)

Recommended verify sequence for PR validation:

- quick path (repo root): `pnpm run benchmark:verify:pr`

1. `pnpm --filter @ghx-dev/core run build`
2. `pnpm --filter @ghx-dev/benchmark run benchmark -- agent_direct 4 --scenario-set ci-verify-pr`
3. `pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 4 --scenario-set ci-verify-pr`
4. `pnpm --filter @ghx-dev/benchmark run report`
5. `pnpm --filter @ghx-dev/benchmark exec tsx src/cli/report.ts --gate --gate-profile verify_pr`

Expected outcome: both reliability and efficiency checks pass for `verify_pr` on stable runs.

## Seeded Full Suites

For mutation and full roadmap coverage, seed sandbox fixtures first:

1. `pnpm --filter @ghx-dev/benchmark run fixtures -- seed --repo aryeko/ghx-bench-fixtures --out fixtures/latest.json --seed-id local`
2. `pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set full-seeded --fixture-manifest fixtures/latest.json`
3. `pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json`

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
