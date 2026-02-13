# Efficiency Criteria

Defines benchmark validation criteria for `ghx-router` release decisions.

## Objective

Demonstrate that `ghx-router` improves context and operational efficiency over baseline agent execution.

## Baseline Modes

1. Agent-direct workflow (`agent_direct`)
2. MCP workflow (`mcp`) when available

Target mode:

3. Router workflow (`ghx_router`)

## Metrics

Primary:

- `tokens_total`
- `latency_ms`
- `tool_calls`
- `api_calls`
- `success_rate`

Secondary:

- `retry_count`
- `route_switches`
- `output_validity`

## Validation Thresholds (v1)

`ghx_router` is considered validated when all are true:

- >=25% median reduction in `tokens_total` versus `agent_direct`
- >=20% median reduction in `latency_ms` on common tasks
- >=30% reduction in `tool_calls`
- Non-inferior `success_rate` (within 1 percentage point, or better)
- >=99% `output_validity`

## Measurement Requirements

- Same scenario set across all compared modes.
- At least 10 repetitions per scenario/mode.
- Fixed repository fixtures, scopes, and model/provider per suite.
- Report median and P90 values with run metadata.

## Required Artifacts

- `packages/benchmark/scenarios/*.json`
- `packages/benchmark/results/*.jsonl`
- `packages/benchmark/reports/*.md`
- `packages/benchmark/reports/latest-summary.json`
