# Contracts

Defines task input/output contracts and normalized result envelope.

## Envelope (v1)

Every task returns a normalized envelope:

- `success`: boolean
- `data`: object or array on success
- `error`: structured object on failure
- `meta`: route source and execution metadata

Primary type location:

- `src/core/contracts/envelope.ts`

Task contracts live under:

- `src/core/contracts/tasks/`

Contract changes require matching test and benchmark updates.
