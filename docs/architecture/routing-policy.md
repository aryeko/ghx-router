# Routing Policy

Defines how tasks are routed across `cli`, `rest`, and `graphql`.

## Current Runtime Behavior

- Task-specific defaults come from `packages/ghx-router/src/core/routing/capability-registry.ts`.
- Route fallback order comes from `packages/ghx-router/src/core/routing/policy.ts` (`cli` -> `rest` -> `graphql`).
- Runtime builds route attempts as: `[defaultRoute, ...fallbackRoutes, ...globalOrder]` with de-duplication.
- Routes are attempted in order until success or terminal error.

Current shipped task entries default to GraphQL.

Preflight behavior:

- GraphQL requires a token.
- CLI/REST can enforce `gh` availability and authentication when those signals are provided to the engine.

Only bypass configured defaults with documented reason codes:

- `coverage_gap`
- `efficiency_gain`
- `output_shape_requirement`

## Source of Truth

- Runtime behavior: `packages/ghx-router/src/core/routing/`
- Policy matrix: `README.md` (Routing Decision Matrix)
- Detailed architecture rationale: `docs/architecture/system-design.md`

This file should remain concise and mirror runtime policy.
