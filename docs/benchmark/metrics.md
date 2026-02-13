# Benchmark Metrics

## Primary Metrics

- `success_rate`
- `output_validity_rate`
- `median_tokens_total`
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
