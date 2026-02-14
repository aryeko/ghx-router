# Repository Structure

## Runtime Package

- `packages/ghx-router/src/core/contracts/` - result envelope + task contracts.
- `packages/ghx-router/src/core/errors/` - error codes, mapping, retryability.
- `packages/ghx-router/src/core/registry/` - operation-card types, YAML cards, schema validation, lookup.
- `packages/ghx-router/src/core/execute/` - execute orchestration (validation, preflight, retry, fallback).
- `packages/ghx-router/src/core/execution/adapters/` - GraphQL and CLI adapters.
- `packages/ghx-router/src/core/routing/` - engine entrypoint and policy helpers.
- `packages/ghx-router/src/core/telemetry/` - structured metric logging with redaction.
- `packages/ghx-router/src/agent-interface/` - tool surface and main-skill text.
- `packages/ghx-router/src/gql/` - GraphQL client and generated operation types.

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
- `.github/workflows/ci-pr.yml` - PR checks (affected CI, GraphQL drift check, benchmark scenario check, coverage upload).
- `.github/workflows/ci-main.yml` - main checks plus release workflow.
- `.changeset/` - changesets configuration and release metadata.
- `codecov.yml` - Codecov status configuration and generated-file ignore rules.
