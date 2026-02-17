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

## Scenario Types

The benchmark suite supports two distinct scenario types with different execution models:

### Atomic Scenarios

Atomic scenarios use a **structured approach** ideal for unit-like capability testing:
- Task + input as JSON (analogous to function calls)
- Success/failure determination from result envelope (`ok` field)
- Output validity verified via explicit schema assertions (required fields, data types, etc.)
- Envelope assertions (tool-call counts, attempt traces, route used)
- Typically short timeout (10-60 seconds)
- Examples: `pr.view`, `issue.create`, `workflow.dispatch-run`

### Workflow Scenarios

Workflow scenarios use a **natural language prompt approach** for multi-step, agent-driven processes:
- Single natural language prompt (e.g., "Review the PR and submit an approval")
- Multi-step execution combining multiple capabilities to achieve a goal
- Checkpoint-based assertions that verify intermediate and final states
- Each checkpoint runs a verification task and checks conditions (empty, non_empty, count_eq, field_equals)
- Longer timeout (60-180 seconds) and higher retry allowance
- Examples: `pr-fix-review-comments-wf-001`, `triage-new-issue-wf`, `merge-ready-pr-wf`

See `docs/benchmark/workflow-roadmap.md` for planned workflows and `docs/benchmark/scenario-assertions.md` for assertion details.

## Metric System v2

The benchmark uses a dual-gate model to separate reliability from efficiency.

1. **Reliability gate (raw rows):**
   - evaluates all completed rows,
   - includes success, output validity, runner failure, timeout/stall, and retry rates.
2. **Efficiency gate (stable sample):**
   - evaluates only rows that are `success=true`, `output_valid=true`, and not `runner_error`,
   - computes per-scenario medians per mode,
   - compares `ghx` vs `agent_direct` on active tokens, latency, and tool calls,
   - includes cost reduction gate check (all scenarios must show >= minimum cost reduction),
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
