# ghx-router Efficiency Evaluation Plan (v1)

Status: reference validation and release-gate policy.

## Objective

Prove with measurements that `ghx-router` is more context-efficient and operationally efficient than direct agent-driven `gh`/API selection.

## Hypothesis

Compared to baseline agent workflows, `ghx-router` will:

- Reduce total token consumption per task.
- Reduce time-to-result for common GitHub operations.
- Reduce execution variance and retries.
- Maintain or improve task success rate.

## Baselines

Define two baseline modes:

1. Agent-Direct CLI/API Mode
- Agent chooses `gh`, REST, or GraphQL on its own.
- Agent may fetch docs/schema during execution.

2. MCP Tooling Mode (when available)
- Agent uses MCP GitHub tools with standard tool schemas.

Benchmark target mode:

3. ghx-router Mode
- Agent calls `ghx run <task> --input ...` only.

## Benchmark Task Set

Use a fixed suite of representative tasks (minimum 20 scenarios):

- PR: list, view, create draft, update body, query checks.
- Issues: list filtered, view, create, update labels.
- Repo: view metadata, list releases, list rulesets.
- Cross-entity query: issue + linked PR + reviewer/check status.

Each scenario must define:
- input payload
- expected success criteria
- expected output fields

## Metrics

Primary metrics:

- `tokens_total`: total prompt + tool/result tokens per scenario.
- `latency_ms`: wall-clock time from task start to final output.
- `tool_calls`: number of tool/command invocations.
- `api_calls`: number of remote GitHub API requests.
- `success_rate`: scenario pass ratio.

Secondary metrics:

- `retry_count`: number of retries per scenario.
- `route_switches`: count of path changes during execution.
- `output_validity`: percent outputs matching schema exactly.

## Measurement Method

1. Run all scenarios across each mode using the same repositories and auth scopes.
2. Execute each scenario at least 10 times to reduce noise.
3. Record raw logs as JSONL with timestamps and mode labels.
4. Compute median and P90 for latency and token usage.
5. Compute confidence intervals for key deltas.

## Early Checkpoint (Thin Slice)

Before full v1 benchmarking, run an early checkpoint with 5-8 scenarios:

- Capture baseline metrics for Agent-Direct mode.
- Capture MCP baseline when available.
- Run the same scenarios through early `ghx-router` implementation.
- Use this checkpoint to prioritize adapter work and task coverage.

This is a directional gate, not a release gate. It reduces build risk by validating the approach early.

## Success Criteria (v1)

`ghx-router` is considered validated if all are true:

- >= 25% median reduction in `tokens_total` vs Agent-Direct mode.
- >= 20% median reduction in `latency_ms` for common tasks.
- >= 30% reduction in `tool_calls`.
- Non-inferior `success_rate` (within 1 percentage point, or better).
- >= 99% `output_validity` on normalized schema.

## Threats to Validity

- GitHub service-side variability (rate limits, transient errors).
- Repository-specific complexity skewing a subset of tasks.
- Agent model variability if runs use different model versions.

Mitigations:

- Use fixed test repositories and data fixtures.
- Randomize scenario order.
- Capture and report model/runtime versions.

## Artifacts

Track these in repo:

- `bench/scenarios/*.json` - benchmark definitions.
- `bench/results/*.jsonl` - raw execution logs.
- `bench/reports/*.md` - aggregated reports.
- `bench/reports/latest-summary.json` - machine-readable summary.

## Reporting Template

For each release candidate, publish:

- scenario count and coverage
- median/P90 token and latency comparisons
- success-rate comparison
- notable regressions and unresolved gaps

This keeps efficiency claims evidence-based and repeatable.
