# Contracts

## Result Envelope (v1)

All capability executions return:

- `ok`: boolean
- `data`: normalized capability payload when `ok=true`
- `error`: `{ code, message, retryable, details? }` when `ok=false`
- `meta`:
  - `capability_id`
  - `route_used`
  - `reason`
  - optional `attempts`, `pagination`, `timings`, `cost`

Source of truth:

- `packages/ghx-router/src/core/contracts/envelope.ts`

## Operation Card Contract

Each capability is defined by an operation card with:

- capability identity + version
- input/output schema
- route preference/fallback policy
- adapter-specific metadata (GraphQL and CLI)

Source of truth:

- `packages/ghx-router/src/core/registry/types.ts`
- `packages/ghx-router/src/core/registry/cards.ts`
- `packages/ghx-router/src/core/registry/index.ts`

## Agent Tool Surface Contract

- `execute(capability_id, params, options?)`
- `explain(capability_id)`
- `list_capabilities()`

Source of truth:

- `packages/ghx-router/src/agent-interface/tools/`
