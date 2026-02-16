# Nx Commands

Root scripts map to Nx targets and are the preferred local/CI entrypoints.

## Core Commands

- `pnpm run ci` - run full package CI targets (`format:check` + `lint` + `typecheck` + `test:coverage` + `build`).
- `pnpm run ci:affected` - run CI targets only for affected projects.
- `pnpm run build` / `pnpm run build:affected`
- `pnpm run format` / `pnpm run format:affected` - auto-fix formatting + import sorting (Biome).
- `pnpm run format:check` / `pnpm run format:check:affected` - verify formatting (CI mode).
- `pnpm run lint` / `pnpm run lint:affected`
- `pnpm run test` / `pnpm run test:affected`
- `pnpm run test:coverage` / `pnpm run test:coverage:affected`
- `pnpm run typecheck` / `pnpm run typecheck:affected`

## Project-Specific Commands

- `pnpm run ghx:gql:check` - enforce generated GraphQL artifacts are in sync.
- `pnpm --filter @ghx-dev/benchmark run check:scenarios` - validate benchmark scenarios.
- `pnpm run benchmark`, `pnpm --filter @ghx-dev/benchmark run report`, `pnpm --filter @ghx-dev/benchmark run report:gate`

## Utility Commands

- `pnpm run dep-graph` - open Nx dependency graph.
- `pnpm run cache:clean` - clear Nx cache.
