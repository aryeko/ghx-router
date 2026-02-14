# Architecture Codemap

**Last Updated:** 2026-02-14  
**Workspace Type:** Nx + pnpm monorepo (`packages/*`)  
**Primary Runtime:** Node.js + TypeScript (ESM)

## System Overview

ghx is split into two main packages:

- `@ghx/core` - capability router and CLI for GitHub tasks
- `@ghx/benchmark` - benchmark harness that measures success, cost, latency, and tool usage across execution modes

The core package provides a normalized `ResultEnvelope` contract and routes each capability to CLI/GraphQL/REST adapters based on operation cards and preflight checks.

## High-Level Architecture

```text
┌──────────────────────────┐
│ User / Agent / Script    │
└────────────┬─────────────┘
             │ ghx run <task> --input <json>
             ▼
┌──────────────────────────┐
│ @ghx/core CLI            │
│ packages/core/src/cli/*  │
└────────────┬─────────────┘
             │ TaskRequest
             ▼
┌────────────────────────────────────────────────────┐
│ Routing Engine                                     │
│ packages/core/src/core/routing/engine.ts          │
│ - loads operation card                            │
│ - preflight route checks                          │
│ - executes preferred + fallback routes            │
└────────────┬───────────────────────────────────────┘
             │
      ┌──────┴─────────┬───────────────┐
      ▼                ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ CLI Adapter  │ │ GraphQL Adpt │ │ REST Adapter │
│ (gh cli)     │ │ (GitHub GQL) │ │ (stubbed v1) │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       └────────────┬───┴───────────────┘
                    ▼
         ┌────────────────────────┐
         │ ResultEnvelope         │
         │ { ok, data, error,meta }│
         └────────────────────────┘
```

## Package Relationships

```text
@ghx/benchmark
  ├─ depends on @ghx/core (workspace dependency)
  ├─ runs scenarios against multiple modes:
  │   - agent_direct
  │   - mcp
  │   - ghx_router
  └─ writes suite results + summary artifacts

@ghx/core
  ├─ defines capability contracts and registry cards
  ├─ executes route selection and fallback logic
  └─ exposes CLI binary: ghx
```

## Core Execution Data Flow

1. CLI parses `task` and `--input` JSON in `packages/core/src/cli/commands/run.ts`.
2. `executeTask()` in `packages/core/src/core/routing/engine.ts` loads the operation card.
3. `execute()` in `packages/core/src/core/execute/execute.ts` validates input schema and computes route plan.
4. Per-route preflight runs (`token`, `gh` availability/auth checks, etc.).
5. Matching adapter executes capability:
   - CLI: `runCliCapability()`
   - GraphQL: `runGraphqlCapability()`
   - REST: normalized unsupported error (v1)
6. Output schema is validated, then normalized envelope is returned.

## Benchmark Data Flow

1. `packages/benchmark/src/cli/benchmark.ts` parses mode/repetitions.
2. `runSuite()` loads JSON scenarios from `packages/benchmark/scenarios/`.
3. `runScenario()` sends prompts through OpenCode SDK sessions and captures assistant output.
4. Envelope extraction + assertion validation runs via `src/extract/*`.
5. Result rows are appended to `packages/benchmark/results/*.jsonl`.
6. `src/cli/report.ts` aggregates rows into summary markdown/json artifacts.

## Entry Points

- `packages/core/src/cli/index.ts` - `ghx` executable entrypoint
- `packages/benchmark/src/cli/benchmark.ts` - benchmark runner CLI
- `packages/benchmark/src/cli/check-scenarios.ts` - scenario validity check
- `packages/benchmark/src/cli/report.ts` - report + gate evaluation

## Related Docs

- `docs/architecture/overview.md`
- `docs/architecture/system-design.md`
- `docs/benchmark/harness-design.md`
