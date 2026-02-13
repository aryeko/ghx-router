# Routing Policy

Routing is card-driven and deterministic.

## Planning Rules

For a given capability card:

1. start with `routing.preferred`
2. append ordered `routing.fallbacks`
3. de-duplicate route order
4. apply preflight checks per route

## Route Reasons

Runtime reason codes:

- `CARD_PREFERRED`
- `CARD_FALLBACK`
- `PREFLIGHT_FAILED`
- `ENV_CONSTRAINT`
- `CAPABILITY_LIMIT`
- `DEFAULT_POLICY`

## Current v1 Shape

- shipped cards currently prefer `graphql`
- fallback order is `cli`, then `rest`
- `execute` performs bounded per-route retries and then fallback

Source of truth:

- `packages/ghx-router/src/core/registry/cards.ts`
- `packages/ghx-router/src/core/execute/execute.ts`
- `packages/ghx-router/src/core/execution/preflight.ts`
