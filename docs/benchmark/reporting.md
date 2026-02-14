# Benchmark Reporting

## Required Artifacts

- raw rows: `packages/benchmark/results/*.jsonl`
- machine summary: `packages/benchmark/reports/latest-summary.json`
- human summary: `packages/benchmark/reports/*.md`

## Required Summary Content

- scenario coverage and run counts
- median token and latency comparisons (p90 optional)
- success and output-validity rates
- runner-failure and timeout/stall rates
- tool-call and retry trends
- v2 gate outcome with profile (`pr_fast` or `release_strict`)
- stable-sample efficiency coverage and reductions
- legacy v1 gate outcome (compatibility visibility)
- profiling snapshot (assistant reasoning, reasoning->tool gap, tool runtime, post-tool)

## Release Gate Inputs

- `docs/benchmark/efficiency-criteria.md`
- `pnpm run benchmark:gate`

## Gate Profile Selection

`report` supports profile selection:

- `--gate-profile pr_fast` (default)
- `--gate-profile release_strict`

`--gate` evaluates gate v2 for the selected profile.

## Profiling Snapshot Semantics

Per-mode profiling is emitted when rows include `timing_breakdown`.

`assistant_pre_reasoning_ms` is collected at row level for diagnostics, but it is intentionally excluded from summary metrics and gates because it behaves like time-to-first-byte/queueing noise rather than execution skill.

- `assistant_reasoning_ms`: sum of explicit reasoning-part durations.
- `assistant_between_reasoning_and_tool_ms`: gap between reasoning end and first tool start.
- `tool_total_ms` / `tool_bash_ms`: measured tool execution time from part state timestamps.
- `assistant_post_tool_ms`: time from first tool completion to assistant completion.

Use this snapshot to diagnose whether latency is dominated by model-side turn processing or by tool execution.

## Latest Validated Result (Reference)

For `pr-exec` with 3 repetitions per scenario (`agent_direct` vs `ghx`), recent validated output showed:

- reliability: `100%` success, `100%` output validity, `0%` runner failures/timeouts/retries
- efficiency: active-token reduction `> 15%`, latency reduction `> 15%`, tool-call reduction `> 20%`
- gate v2 (`pr_fast`): `PASS`

Treat this as a reference snapshot; re-run proof commands for release decisions.
