# Repository Structure

## Runtime Package

- `packages/core/src/core/contracts/` - result envelope + task contracts.
- `packages/core/src/core/errors/` - error codes, mapping, retryability.
- `packages/core/src/core/registry/` - operation-card types, YAML cards, schema validation, lookup.
- `packages/core/src/core/execute/` - execute orchestration (validation, preflight, retry, fallback).
- `packages/core/src/core/execution/adapters/` - GraphQL and CLI adapters.
- `packages/core/src/core/routing/` - engine entrypoint and policy helpers.
- `packages/core/src/core/telemetry/` - structured metric logging with redaction.
- `packages/core/src/agent-interface/` - tool surface and main-skill text.
- `packages/core/src/gql/` - GraphQL client and generated operation types.

## Benchmark Package

- `packages/benchmark/scenarios/` - scenario definitions.
- `packages/benchmark/src/scenario/` - scenario schema + loading.
- `packages/benchmark/src/runner/` - benchmark orchestration.
- `packages/benchmark/src/extract/` - envelope/tool/attempt extraction.
- `packages/benchmark/src/report/` - aggregate reporting.

## Documentation

- `docs/architecture/` - architecture contracts and runtime behavior.
- `docs/benchmark/` - methodology, metrics, and reporting criteria.

## Tooling and CI

- `nx.json` - workspace target defaults and Nx plugin wiring.
- `biome.json` - Biome formatter configuration (formatting + import sorting).
- `lefthook.yml` - pre-commit hooks (format, lint, typecheck).
- `.npmrc` - pnpm settings (`strict-peer-dependencies`, `auto-install-peers`).
- `pnpm-workspace.yaml` - workspace package discovery + pnpm catalog for shared devDependencies.
- `packages/core/tsup.config.ts` / `packages/benchmark/tsup.config.ts` - per-package build configuration.
- `.github/workflows/ci-pr.yml` - PR checks (affected CI, audit, GraphQL drift check, benchmark scenario check, coverage upload).
- `.github/workflows/ci-main.yml` - main checks, audit, plus release workflow.
- `.github/dependabot.yml` - automated dependency update PRs (npm + GitHub Actions).
- `.changeset/` - changesets configuration and release metadata.
- `codecov.yml` - Codecov status configuration and generated-file ignore rules.
