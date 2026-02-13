# Repository Structure

This document defines folder responsibilities and scope boundaries for `ghx-router`.

## Top-Level Principles

- Keep execution logic separate from interfaces.
- Keep benchmark harness independent from product runtime logic.
- Keep generated artifacts isolated from handwritten code.
- Keep contracts and normalization rules as first-class, testable modules.

## Directory Map

### `docs/`

Project documentation, design decisions, and implementation plans.

- `docs/architecture/`
  - **Responsibility**: long-lived architecture docs.
  - **Scope**: routing policy, contracts, retry model, repository structure.
  - **Out of scope**: sprint-level planning details.
- `docs/benchmark/`
  - **Responsibility**: benchmark methodology and reporting standards.
  - **Scope**: metrics definitions, measurement method, release gate interpretation.
- `docs/plans/`
  - **Responsibility**: time-scoped plans and design specs.
  - **Scope**: dated implementation plans, benchmark design proposals, phase docs.

### `src/`

Production code for the `ghx` runtime and routing engine.

- `src/cli/`
  - **Responsibility**: command-line interface and command handlers.
  - **Scope**: argument parsing, output formatting, command wiring.
  - **Boundary**: should delegate business logic to `src/core/`.
- `src/core/`
  - **Responsibility**: domain logic and execution orchestration.
  - **Scope**: contracts, routing, adapters, normalization, telemetry, errors.
  - **Boundary**: no CLI-specific presentation logic.
  - `src/core/contracts/`: canonical task and envelope definitions.
  - `src/core/routing/`: policy engine and capability registry.
  - `src/core/execution/`: adapters (`cli`, `rest`, `graphql`) and preflight.
  - `src/core/telemetry/`: runtime metrics collection and logging hooks.
  - `src/core/errors/`: shared error codes and mapping.
- `src/gql/`
  - **Responsibility**: GraphQL integration layer.
  - **Scope**: client setup, handwritten query wrappers, generated client/types.
  - **Boundary**: generated code should remain in `src/gql/generated/` only.
- `src/shared/`
  - **Responsibility**: low-level shared utilities and common types.
  - **Scope**: constants, helper functions, cross-module utility types.

### `bench/`

Benchmark harness and artifacts used to prove efficiency claims.

- `bench/scenarios/`
  - **Responsibility**: canonical benchmark cases.
  - **Scope**: task input, assertions, tags, run parameters.
- `bench/scripts/`
  - **Responsibility**: benchmark execution and aggregation runners.
  - **Scope**: run orchestration, SDK session driving, report generation.
- `bench/fixtures/`
  - **Responsibility**: benchmark fixture metadata and setup helpers.
  - **Scope**: test repos, deterministic setup instructions.
- `bench/results/`
  - **Responsibility**: raw per-run JSONL rows.
  - **Scope**: append-only execution data.
- `bench/reports/`
  - **Responsibility**: aggregated benchmark outputs.
  - **Scope**: summary markdown/json artifacts for release decisions.

### `test/`

Automated tests for production code.

- `test/unit/`
  - **Responsibility**: pure module tests.
  - **Scope**: routing logic, contracts, normalization, utilities.
- `test/integration/`
  - **Responsibility**: cross-module and adapter behavior tests.
  - **Scope**: command-to-core flows, adapter integrations.
- `test/fixtures/`
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

- Changes to contracts (`src/core/contracts/`) require corresponding benchmark and test updates.
- Changes to routing policy (`src/core/routing/`) require policy docs updates and route tests.
- Changes to benchmark metrics must update `docs/benchmark/metrics.md`.
- Generated GraphQL output must remain machine-generated and isolated in `src/gql/generated/`.
