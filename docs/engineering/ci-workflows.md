# CI Workflows

This repo uses two workflows:

- `.github/workflows/ci-pr.yml` for pull requests.
- `.github/workflows/ci-main.yml` for pushes to `main`.

## PR Workflow

- Runs a Node matrix (`22`, `24`).
- Installs dependencies with pnpm and configures Nx SHAs.
- Runs affected validation via `pnpm run ci:affected` (includes `format:check`, `lint`, `typecheck`, `test:coverage`, `build`).
- Enforces GraphQL codegen drift check with `pnpm run ghx:gql:check`.
- Validates benchmark scenarios with `pnpm --filter @ghx-dev/benchmark run check:scenarios`.
- Generates and uploads coverage on Node `24`.
- Runs `pnpm audit --audit-level=high` in a separate audit job.

## Main Workflow

- Runs full validation via `pnpm run ci` (includes `format:check`, `lint`, `typecheck`, `test:coverage`, `build`).
- Runs `pnpm run ghx:gql:check` and `pnpm --filter @ghx-dev/benchmark run check:scenarios`.
- Generates coverage and uploads to Codecov.
- Runs `pnpm audit --audit-level=high` in a separate audit job.
- On version commits (`chore: version packages`), uploads dist artifacts and runs release steps with Changesets.

## Release Artifact Notes

- Artifacts are uploaded from `packages/*/dist`.
- Artifacts are downloaded into `packages/` and normalized before publish to ensure expected package layout.
