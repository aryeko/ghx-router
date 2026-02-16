# Architecture Codemap

**Last Updated:** 2026-02-16  
**Workspace Type:** Nx + pnpm monorepo (`packages/*`)  
**Primary Runtime:** Node.js + TypeScript (ESM)

## System Overview

ghx is split into two runtime packages:

- `@ghx-dev/core` - capability router + typed adapters + `ghx` CLI
- `@ghx-dev/benchmark` - benchmark harness that compares `agent_direct`, `mcp`, and `ghx` execution modes

The core package routes capability requests from operation cards (`core/registry/cards/*.yaml`) into CLI or GraphQL adapters, then normalizes responses to a stable `ResultEnvelope` contract. The benchmark package drives repeatable scenario runs against the same capability surface and computes verification gates.

## High-Level Architecture

```text
┌──────────────────────────┐
│ User / Agent / Script    │
└────────────┬─────────────┘
             │ ghx run <capability_id> --input '<json>'
             ▼
┌──────────────────────────┐
│ Core CLI / Agent Tools   │
│ packages/core/src/cli/*  │
│ packages/core/src/agent* │
└────────────┬─────────────┘
             │ TaskRequest
             ▼
┌────────────────────────────────────────────────────┐
│ Routing Engine + Execute Pipeline                 │
│ core/routing/engine.ts + core/execute/execute.ts │
│ - loads operation card                            │
│ - evaluates preflight + suitability               │
│ - applies preferred and fallback routes           │
└────────────┬───────────────────────────────────────┘
             │
      ┌──────┴─────────┬───────────────┐
      ▼                ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ CLI Adapter  │ │ GraphQL Adpt │ │ REST Adapter │
│ (gh + gh api)│ │ (GitHub GQL) │ │ (stub only)  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       └────────────┬───┴───────────────┘
                    ▼
         ┌────────────────────────────┐
         │ ResultEnvelope             │
         │ { ok, data, error, meta } │
         └────────────────────────────┘
```

## Package Relationships

```text
@ghx-dev/benchmark
  ├─ depends on @ghx-dev/core (workspace dependency)
  ├─ runs scenario sets against modes:
  │   - agent_direct
  │   - mcp
  │   - ghx
  ├─ writes `results/*-suite.jsonl`
  └─ emits `reports/latest-summary.{json,md}`

@ghx-dev/core
  ├─ defines operation-card contracts + task identifiers
  ├─ executes route selection, retries, and normalization
  └─ exposes CLI binary: ghx
```

## Core CLI Assets

- `packages/core/src/cli/assets/skills/ghx/SKILL.md` is the canonical setup skill template.
- `packages/core/scripts/copy-registry-cards.mjs` copies `src/cli/assets/skills/**` into
  `dist/cli/assets/skills/**` so published builds can install the same template.

## Core Execution Data Flow

1. CLI dispatches one of three command families in `packages/core/src/cli/index.ts`:
   - `run`: parse `task` + `--input` JSON in `packages/core/src/cli/commands/run.ts`
   - `setup`: load `packages/core/src/cli/assets/skills/ghx/SKILL.md` (or copied dist asset), then
     install/verify `~/.agents/skills/ghx/SKILL.md` (or project-level `.agents/...`) in
     `packages/core/src/cli/commands/setup.ts`
   - `capabilities`: list/explain capability contracts in `packages/core/src/cli/commands/capabilities-list.ts` and `packages/core/src/cli/commands/capabilities-explain.ts`
2. `executeTask()` in `packages/core/src/core/routing/engine.ts` resolves card metadata and route dependencies.
3. `execute()` in `packages/core/src/core/execute/execute.ts` validates input schema and computes the route plan from card suitability/fallbacks.
4. Per-route preflight runs (`GITHUB_TOKEN` for GraphQL, `gh --version` and `gh auth status` for CLI unless preflight skip is explicitly enabled).
5. Matching adapter executes capability:
   - CLI: `runCliCapability()` in `core/execution/adapters/cli-capability-adapter.ts`
   - GraphQL: `runGraphqlCapability()`
   - REST: normalized unsupported error
6. Output schema is validated, then normalized envelope is returned.

## Benchmark Data Flow

1. `packages/benchmark/src/cli/benchmark.ts` parses mode/repetitions and optional selectors (`--scenario`, `--scenario-set`).
2. `runSuite()` resolves scenario selection by precedence: explicit `--scenario`, then `--scenario-set`, then implicit `default` from `packages/benchmark/scenario-sets.json`.
3. `runSuite()` loads JSON scenarios from `packages/benchmark/scenarios/`.
4. `runScenario()` creates isolated OpenCode sessions, renders enforced prompt constraints, and captures assistant/tool traces.
5. Envelope + tool + attempt extraction runs via `src/extract/*`, then assertions are validated against per-scenario schema.
6. Result rows are appended to `packages/benchmark/results/*.jsonl`, including scenario set and timing breakdown metadata.
7. `src/cli/report.ts` aggregates latest rows into summary artifacts and evaluates gate checks (`verify_pr` or `verify_release`).

## Entry Points

- `packages/core/src/index.ts` - public `@ghx-dev/core` package API entrypoint
- `packages/core/src/agent.ts` - public agent-facing exports (`listCapabilities`, `createExecuteTool`, `explainCapability`)
- `packages/core/src/cli/index.ts` - `ghx` executable entrypoint
- `packages/benchmark/src/cli/benchmark.ts` - benchmark runner CLI
- `packages/benchmark/src/cli/check-scenarios.ts` - scenario validity check
- `packages/benchmark/src/cli/report.ts` - report + gate evaluation

## Related Docs

- `docs/architecture/overview.md`
- `docs/architecture/system-design.md`
- `docs/benchmark/harness-design.md`
- `docs/guides/publishing.md`
