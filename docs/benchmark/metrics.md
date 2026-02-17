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

Primary measures per mode:

- `median_tokens_total`
- `median_tokens_active`
- `median_latency_ms`
- `median_tool_calls`

Extended statistical metrics:

- `p90_latency_ms` — 90th percentile latency (high-end outliers)
- `p95_latency_ms` — 95th percentile latency (extreme outliers)
- `iqr_latency_ms` — interquartile range (latency distribution spread)
- `cv_latency` — coefficient of variation for latency (variability %age)
- `p90_tokens_active` — 90th percentile active tokens
- `p95_tokens_active` — 95th percentile active tokens
- `median_cost_usd` — median cost per run (agent_direct → token price)

## Delta Metrics (vs agent_direct)

- `tokens_active_reduction_pct` — percent reduction in median active tokens
- `latency_reduction_pct` — percent reduction in median latency
- `tool_call_reduction_pct` — percent reduction in median tool calls
- `cost_reduction_pct` — percent reduction in median cost
- `tokens_active_reduction_ci` — bootstrap 95% confidence interval for tokens active reduction
- `latency_reduction_ci` — bootstrap 95% confidence interval for latency reduction

Bootstrap confidence intervals use 10,000 iterations with 95% confidence level to quantify uncertainty in reduction estimates.

## Secondary Metrics

- `api_calls`
- `retry_count` (derived from envelope attempt trace when present)
- `sdk_latency_ms`
- `success_rate` (per-mode, per-scenario)

## Statistical Methods

- **Percentiles:** Linear interpolation (standard for benchmark comparisons)
- **IQR:** p75 - p25 (captures central 50% of distribution)
- **Coefficient of Variation:** (stdev / mean) × 100 (scale-invariant variability measure)
- **Bootstrap CI:** Resample with replacement, compute percentiles on bootstrap distribution

## Notes

- Benchmark `success_rate` is run-level success, not the runtime envelope field.
- Runtime envelope uses `ok` (not `success`).
- Attempt metrics are extracted from `meta.attempts` when available.
- `tokens_active` is computed as `tokens.total - tokens.cache_read`.
- `cost` is mode-dependent: `agent_direct` uses real API costs; `mcp`/`ghx` use input+output token prices with agent's model pricing.
- Gate v2 keeps reliability and efficiency separate so intermittent runner failures are visible without distorting efficiency deltas.
