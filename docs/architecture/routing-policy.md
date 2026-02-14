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

- CLI-suitable capabilities (`repo.view`, `issue.view`, `issue.list`, `pr.view`, `pr.list`) use `preferred=cli`, `fallbacks=[graphql]`
- `issue.comments.list` uses `preferred=graphql`, `fallbacks=[cli]`
- global route preference order is `cli`, then `graphql`
- REST is planned but not part of v1 preference ordering
- `execute` performs bounded per-route retries and then fallback

Source of truth:

- `packages/ghx-router/src/core/registry/cards/*.yaml`
- `packages/ghx-router/src/core/execute/execute.ts`
- `packages/ghx-router/src/core/execution/preflight.ts`
