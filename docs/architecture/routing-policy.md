# Routing Policy

Defines how tasks are routed across `cli`, `rest`, and `graphql`.

## Decision Order

1. `gh` CLI with `--json`
2. `gh api` REST
3. Typed GraphQL client

Only bypass this order with documented reason codes:

- `coverage_gap`
- `efficiency_gain`
- `output_shape_requirement`

## Source of Truth

- Runtime behavior: `src/core/routing/`
- Policy matrix: `README.md` (Routing Decision Matrix)
- Detailed architecture rationale: `docs/plans/2026-02-13-ghx-router-architecture.md`

This file should remain concise and mirror runtime policy.
