# Benchmark Metrics

## Reliability Metrics (Gate v2, Raw Rows)

- `success_rate`
- `output_validity_rate`
- `runner_failure_rate`
- `timeout_stall_rate`
- `retry_rate`

Raw rows include all benchmark outcomes, including runner errors and timeouts.

## Efficiency Metrics (Gate v2, Stable Sample)

- `median_tokens_active_reduction_pct`
- `median_latency_reduction_pct`
- `median_tool_call_reduction_pct`
- `scenario_win_rate_tokens_active_pct`
- `efficiency_coverage_pct`

Stable sample rows are those with:

- `success = true`
- `output_valid = true`
- `error.type != runner_error`

## Mode-Level Metrics (Reported)

- `median_tokens_total`
- `median_tokens_active`
- `median_latency_ms`
- `median_tool_calls`

## Secondary Metrics

- `api_calls`
- `retry_count` (derived from envelope attempt trace when present)
- `sdk_latency_ms`
- `cost`

## Notes

- Benchmark `success_rate` is run-level success, not the runtime envelope field.
- Runtime envelope uses `ok` (not `success`).
- Attempt metrics are extracted from `meta.attempts` when available.
- `tokens_active` is computed as `tokens.total - tokens.cache_read`.
- Gate v2 keeps reliability and efficiency separate so intermittent runner failures are visible without distorting efficiency deltas.
