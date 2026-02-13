# Errors and Retries

Defines common error codes and retry behavior.

## Error Shape

Errors should be normalized with:

- `code`
- `message`
- `details` (optional)
- `retryable` (boolean)

Primary code definitions:

- `packages/ghx-router/src/core/errors/codes.ts`
- `packages/ghx-router/src/core/errors/map-error.ts`

## Retry Policy (v1)

- Retry only transient infrastructure/network failures.
- Use bounded backoff.
- Do not retry schema validation or auth/scope errors.

Detailed behavior evolves with adapter implementation and should remain aligned with `docs/architecture/system-design.md`.
