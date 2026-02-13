# Benchmark Metrics

Defines primary and secondary metrics for benchmark reporting.

## Primary Metrics

- `tokens.total`
- `latency_ms_wall`
- `tool_calls`
- `api_calls`
- `success_rate`

## Secondary Metrics

- `sdk_latency_ms`
- `retry_count`
- `route_switches`
- `output_validity`
- `cost`

## SDK-Sourced Fields

Use OpenCode SDK values when available:

- `assistant.tokens.input`
- `assistant.tokens.output`
- `assistant.tokens.reasoning`
- `assistant.tokens.cache.read`
- `assistant.tokens.cache.write`
- `assistant.cost`
- `assistant.time.created`
- `assistant.time.completed`

Reference details:

- `docs/benchmark/harness-design.md`
