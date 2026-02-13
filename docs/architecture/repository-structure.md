# Repository Structure

This document defines folder responsibilities and scope boundaries for `ghx-router`.

## Top-Level Principles

- Keep execution logic separate from interfaces.
- Keep benchmark harness independent from product runtime logic.
- Keep generated artifacts isolated from handwritten code.
- Keep contracts and normalization rules as first-class, testable modules.

## Directory Map

### `docs/`

Project documentation and long-lived design references.

- `docs/architecture/`
  - **Responsibility**: long-lived architecture docs.
  - **Scope**: routing policy, contracts, retry model, repository structure.
  - **Out of scope**: sprint-level planning details.
- `docs/benchmark/`
  - **Responsibility**: benchmark methodology and reporting standards.
  - **Scope**: metrics definitions, measurement method, release gate interpretation.

### `packages/ghx-router/src/`

Production code for the `ghx` runtime and routing engine.

- `packages/ghx-router/src/cli/`
  - **Responsibility**: command-line interface and command handlers.
  - **Scope**: argument parsing, output formatting, command wiring.
  - **Boundary**: should delegate business logic to `packages/ghx-router/src/core/`.
- `packages/ghx-router/src/core/`
  - **Responsibility**: domain logic and execution orchestration.
  - **Scope**: contracts, routing, adapters, normalization, telemetry, errors.
  - **Boundary**: no CLI-specific presentation logic.
  - `packages/ghx-router/src/core/contracts/`: canonical task and envelope definitions.
  - `packages/ghx-router/src/core/routing/`: policy engine and capability registry.
  - `packages/ghx-router/src/core/execution/`: adapters (`cli`, `rest`, `graphql`) and preflight.
  - `packages/ghx-router/src/core/telemetry/`: runtime metrics collection and logging hooks.
  - `packages/ghx-router/src/core/errors/`: shared error codes and mapping.
- `packages/ghx-router/src/gql/`
  - **Responsibility**: GraphQL integration layer.
  - **Scope**: client setup, handwritten query wrappers, generated client/types.
  - **Boundary**: generated code should remain in `packages/ghx-router/src/gql/generated/` only.
- `packages/ghx-router/src/shared/`
  - **Responsibility**: low-level shared utilities and common types.
  - **Scope**: constants, helper functions, cross-module utility types.

### `packages/benchmark/`

Benchmark harness and artifacts used to prove efficiency claims.

- `packages/benchmark/scenarios/`
  - **Responsibility**: canonical benchmark cases.
  - **Scope**: task input, assertions, tags, run parameters.
- `packages/benchmark/src/`
  - **Responsibility**: benchmark execution and aggregation runners.
  - **Scope**: run orchestration, SDK session driving, report generation.
- `packages/benchmark/results/`
  - **Responsibility**: raw per-run JSONL rows.
  - **Scope**: append-only execution data.
- `packages/benchmark/reports/`
  - **Responsibility**: aggregated benchmark outputs.
  - **Scope**: summary markdown/json artifacts for release decisions.

### `packages/ghx-router/test/`

Automated tests for production code.

- `packages/ghx-router/test/unit/`
  - **Responsibility**: pure module tests.
  - **Scope**: routing logic, contracts, normalization, utilities.
- `packages/ghx-router/test/integration/`
  - **Responsibility**: cross-module and adapter behavior tests.
  - **Scope**: command-to-core flows, adapter integrations.
- `packages/ghx-router/test/fixtures/`
  - **Responsibility**: reusable test data and stubs.

### `scripts/`

Developer and build scripts not part of runtime execution.

- **Responsibility**: maintenance automation.
- **Scope**: scenario validation, capability generation, GraphQL codegen.
- **Boundary**: should not contain product runtime business logic.

### `.github/workflows/`

CI and automation workflows.

- **Responsibility**: validation and repeatable automation in GitHub Actions.
- **Scope**: CI checks, benchmark runs, report publication triggers.

## Ownership and Change Guidelines

- Changes to contracts (`packages/ghx-router/src/core/contracts/`) require corresponding benchmark and test updates.
- Changes to routing policy (`packages/ghx-router/src/core/routing/`) require policy docs updates and route tests.
- Changes to benchmark metrics must update `docs/benchmark/metrics.md`.
- Generated GraphQL output must remain machine-generated and isolated in `packages/ghx-router/src/gql/generated/`.
