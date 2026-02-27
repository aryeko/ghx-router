# `@ghx-dev/eval` -- Design Document

> **Status:** Draft
> **Date:** 2026-02-27
> **Package:** `packages/eval`
> **Depends on:** `@ghx-dev/agent-profiler`, `@ghx-dev/core`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Dependency Graph](#dependency-graph)
3. [Architecture Overview](#architecture-overview)
4. [Plugin Implementations](#plugin-implementations)
5. [Key Design Decisions](#key-design-decisions)
6. [Deep-Dive References](#deep-dive-references)

---

## Executive Summary

`@ghx-dev/eval` is the ghx-specific evaluation package that uses
`@ghx-dev/agent-profiler` to measure and prove the benefits of `ghx`
(GitHub execution router) against two baselines: **GitHub MCP server** and
**direct `gh` CLI** usage.

This package implements the profiler's plugin contracts with ghx-specific
logic:
- **OpenCode provider** -- drives agent sessions via the OpenCode SDK
- **Checkpoint scorer** -- verifies task correctness using ghx capabilities
- **Mode resolver** -- configures ghx, mcp, and baseline environments
- **Fixture manager** -- seeds and resets GitHub test fixtures
- **ghx-specific collectors** -- captures ghx capability usage, `gh` CLI
  commands, MCP tool invocations

### Relationship to agent-profiler

```
@ghx-dev/agent-profiler (generic framework)
    |
    |  provides: ProfileRunner, Stats, Reporter, Analyzers
    |  defines:  SessionProvider, Scorer, Collector, ModeResolver, RunHooks
    |
    v
@ghx-dev/eval (ghx-specific evaluation)
    |
    |  implements: OpenCodeProvider, CheckpointScorer, EvalModeResolver, ...
    |  provides:   CLI, scenarios, fixtures, mode definitions
    |
    +---> @ghx-dev/core (for checkpoint verification)
    +---> @opencode-ai/sdk (for agent session management)
```

---

## Dependency Graph

```
@ghx-dev/eval
    |
    +-- @ghx-dev/agent-profiler   (profiling framework)
    +-- @ghx-dev/core             (ghx capabilities for checkpoint verification)
    +-- @opencode-ai/sdk          (OpenCode agent SDK)
    +-- zod                       (config/scenario validation)
```

The profiler has zero domain dependencies. The eval package bridges the
profiler to the ghx ecosystem.

---

## Architecture Overview

### Package Structure

```
packages/eval/
  config/
    eval.config.yaml              # Evaluation configuration
  scenarios/
    pr-fix-mixed-threads.json     # Scenario definitions
    pr-review-comment.json
    scenario-sets.json            # Named scenario groups
  fixtures/                       # Fixture manifests (gitignored)
  src/
    cli/
      index.ts                    # Command dispatcher
      run.ts                      # `eval run` command
      analyze.ts                  # `eval analyze` command
      report.ts                   # `eval report` command
      check.ts                    # `eval check` command
      fixture.ts                  # `eval fixture` command
    config/
      loader.ts                   # Config loader (merges profiler + eval config)
      schema.ts                   # Zod schemas for eval-specific config
    scenario/
      loader.ts                   # Scenario file loading + validation
      schema.ts                   # Zod schemas for EvalScenario
      fixture-binder.ts           # Template variable resolution
    provider/
      opencode-provider.ts        # SessionProvider implementation
      event-listener.ts           # SSE-based completion detection
      session-export.ts           # Session trace export
      trace-builder.ts            # Converts OpenCode messages to TraceEvent[]
    scorer/
      checkpoint-scorer.ts        # Scorer implementation using ghx capabilities
    collector/
      ghx-collector.ts            # Tracks ghx capabilities used
      tool-classifier.ts          # Classifies tool calls (ghx, gh, mcp, file, bash)
    mode/
      resolver.ts                 # ModeResolver implementation
      definitions.ts              # Mode definitions (ghx, mcp, baseline)
    fixture/
      manager.ts                  # Fixture lifecycle (seed, reset, cleanup)
      manifest.ts                 # Fixture manifest types and loading
    hooks/
      eval-hooks.ts               # RunHooks: fixture reset, session export
  test/
    unit/
    integration/
  reports/                        # Generated reports (gitignored)
  results/                        # Raw results (gitignored)
```

### How It Uses agent-profiler

The eval package wires its implementations into the profiler's
`runProfileSuite()`:

```typescript
import { runProfileSuite } from "@ghx-dev/agent-profiler"
import { OpenCodeProvider } from "./provider/opencode-provider.js"
import { CheckpointScorer } from "./scorer/checkpoint-scorer.js"
import { EvalModeResolver } from "./mode/resolver.js"
import { GhxCollector } from "./collector/ghx-collector.js"
import { createEvalHooks } from "./hooks/eval-hooks.js"

// In eval run command:
const results = await runProfileSuite({
  // From profiler config
  modes: config.modes,
  scenarios: loadedScenarios,
  repetitions: config.execution.repetitions,
  outputPath: config.output.resultsDir,

  // Eval-specific plugin implementations
  provider: new OpenCodeProvider({
    port: config.provider.port,
    model: currentModel,
  }),
  scorer: new CheckpointScorer(githubToken),
  modeResolver: new EvalModeResolver(),
  collectors: [new GhxCollector()],
  hooks: createEvalHooks({
    fixtureManager,
    sessionExport: config.output.sessionExport,
  }),

  // Profiler uses its built-in analyzers by default
})
```

---

## Plugin Implementations

| Profiler Contract | Eval Implementation | Description |
|-------------------|---------------------|-------------|
| `SessionProvider` | `OpenCodeProvider` | Drives sessions via OpenCode SDK with SSE completion |
| `Scorer` | `CheckpointScorer` | Verifies checkpoints using `@ghx-dev/core` capabilities |
| `Collector` | `GhxCollector` | Classifies tool calls into ghx/mcp/gh/bash categories |
| `ModeResolver` | `EvalModeResolver` | Maps ghx/mcp/baseline to environment configs |
| `RunHooks` | `createEvalHooks()` | Fixture reset, session export, working dir setup |

See deep-dive docs below for implementation details.

---

## Key Design Decisions

### 1. Multi-Model as Outer Loop

**Decision:** The eval CLI handles multi-model evaluation by invoking
`runProfileSuite()` once per model, with model-specific provider config.

**Rationale:**
- The profiler is intentionally model-agnostic -- it does not know about
  "models" as a concept.
- The eval package's CLI iterates over configured models and creates a fresh
  provider per model.
- Results from all models are stored in the same JSONL file, tagged by model.

```typescript
for (const model of config.models) {
  const provider = new OpenCodeProvider({ port: config.provider.port, model: model.id })
  await runProfileSuite({ ...commonConfig, provider })
}
```

### 2. OpenCode Server Reuse

**Decision:** The OpenCode server is started once per (mode, model) group and
reused across iterations. Sessions are isolated, but the server process
persists.

**Rationale:**
- Server startup takes 2-5s. Restarting per iteration would add significant
  overhead across 30+ iterations.
- Session isolation is achieved at the session level (fresh `createSession()`
  per iteration), not the server level.
- If the server becomes unhealthy, the provider detects it via health check
  and restarts.

### 3. Fixture Management as Hooks

**Decision:** Fixture lifecycle (seed, reset, cleanup) is implemented as
`RunHooks` callbacks, not as part of the runner or provider.

**Rationale:**
- Fixtures are a ghx-eval concept, not a profiler concept.
- Hooks provide the right lifecycle points (`beforeScenario` for reset,
  `beforeRun` for seed verification).
- Keeps the provider focused on session management.

### 4. Tool Call Classification

**Decision:** The `GhxCollector` classifies every tool call into categories
(ghx, mcp, gh_cli, bash, file_ops, other) and stores counts in
`ProfileRow.extensions`.

**Rationale:**
- Tool classification is the primary way to show that ghx reduces tool call
  complexity.
- Classification logic is ghx-specific (knowing that `ghx run` is a ghx
  capability, `gh pr view` is gh CLI, etc.).
- Storing in extensions keeps the profiler's `ProfileRow` generic.

---

## Deep-Dive References

| Topic | Document |
|-------|----------|
| OpenCode Provider | [opencode-provider.md](./opencode-provider.md) |
| ghx-Specific Scenarios | [scenarios.md](./scenarios.md) |
| Fixture Management | [fixtures.md](./fixtures.md) |
| Mode Definitions | [modes.md](./modes.md) |
| Configuration Reference | [configuration.md](./configuration.md) |
