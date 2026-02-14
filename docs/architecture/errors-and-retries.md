# Errors and Retries

## Error Taxonomy

Current normalized error codes:

- `AUTH`
- `NOT_FOUND`
- `VALIDATION`
- `RATE_LIMIT`
- `NETWORK`
- `SERVER`
- `ADAPTER_UNSUPPORTED`
- `UNKNOWN`

Source:

- `packages/ghx-router/src/core/errors/codes.ts`
- `packages/ghx-router/src/core/errors/map-error.ts`

## Retryability

Retryable by default:

- `NETWORK`
- `RATE_LIMIT`
- `SERVER`

Non-retryable by default:

- `AUTH`, `VALIDATION`, `NOT_FOUND`, `ADAPTER_UNSUPPORTED`, `UNKNOWN`

Source:

- `packages/ghx-router/src/core/errors/retryability.ts`

## Fallback Behavior

- Preflight route failures are recorded and route attempts continue.
- Retryable adapter errors consume route retry budget.
- Non-retryable non-adapter errors terminate route evaluation.
- `ADAPTER_UNSUPPORTED` can trigger fallback to next route.

## Schema Validation Mapping

- Input JSON Schema validation failures are normalized as `VALIDATION` and are non-retryable.
- Output JSON Schema validation failures are normalized as `SERVER` and are non-retryable.

Source:

- `packages/ghx-router/src/core/execute/execute.ts`
