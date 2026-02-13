# Nx Commands

Root scripts map to Nx targets and are the preferred local/CI entrypoints.

## Core Commands

- `pnpm run ci` - run full package CI targets.
- `pnpm run ci:affected` - run CI targets only for affected projects.
- `pnpm run build` / `pnpm run build:affected`
- `pnpm run lint` / `pnpm run lint:affected`
- `pnpm run test` / `pnpm run test:affected`
- `pnpm run test:coverage` / `pnpm run test:coverage:affected`
- `pnpm run typecheck` / `pnpm run typecheck:affected`

## Project-Specific Commands

- `pnpm run ghx:gql:check` - enforce generated GraphQL artifacts are in sync.
- `pnpm run benchmark:check` - validate benchmark scenarios.
- `pnpm run benchmark:run`, `pnpm run benchmark:report`, `pnpm run benchmark:gate`

## Utility Commands

- `pnpm run dep-graph` - open Nx dependency graph.
- `pnpm run cache:clean` - clear Nx cache.
