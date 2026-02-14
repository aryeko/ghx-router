# Scenario Assertions

Scenario assertions schema supports:

- `must_succeed`
- `expect_valid_output`
- `required_fields`
- `required_data_fields`
- `required_meta_fields`
- `data_type`
- `expected_route_used`
- `expected_error_code`
- `require_tool_calls`
- `min_tool_calls`
- `max_tool_calls`
- `require_attempt_trace`

Source of truth:

- `packages/benchmark/src/domain/types.ts`
- `packages/benchmark/src/scenario/schema.ts`

## Typical v1 Envelope Assertions

```json
{
  "required_fields": ["ok", "data", "error", "meta"]
}
```

For list capabilities, prefer object validation with `required_data_fields` such as `items` and `pageInfo`.

For routing compliance checks, include `required_meta_fields: ["route_used"]` with `expected_route_used`.

For failure-path checks, include `expected_error_code` (for example `VALIDATION` or `SERVER`).
