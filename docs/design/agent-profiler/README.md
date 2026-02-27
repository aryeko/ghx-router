# `@ghx-dev/agent-profiler` -- Design Document

> **Status:** Draft
> **Date:** 2026-02-27
> **Package:** `packages/agent-profiler`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Plugin Architecture](#plugin-architecture)
5. [Key Design Decisions](#key-design-decisions)
6. [Deep-Dive References](#deep-dive-references)

---

## Executive Summary

`@ghx-dev/agent-profiler` is a generic, reusable framework for profiling AI
agent session performance. It measures execution metrics (latency, tokens, tool
calls, cost), analyzes session traces for behavioral insights, and produces
rich multi-page reports with statistical rigor.

The profiler is **not** an answer-correctness evaluator. It answers: "How
efficiently did the agent complete the task?" rather than "Was the answer
right?" Correctness is handled by pluggable scorers provided by consumers.

### Why a Separate Package?

No OSS library exists for agent execution performance profiling. Existing eval
frameworks (Promptfoo, Braintrust, DeepEval, etc.) measure output quality --
they compare agent answers to expected outputs. Agent-profiler fills a
different gap:

| Concern | Existing Eval Frameworks | agent-profiler |
|---------|--------------------------|----------------|
| What it measures | Output correctness | Execution performance |
| Key metrics | Accuracy, F1, BLEU | Latency, tokens, tool calls, cost |
| Session analysis | None | Reasoning, tool patterns, errors, efficiency |
| Statistical rigor | Basic averages | p50/p90/p95, bootstrap CI, Cohen's d |
| Multi-mode comparison | Provider A vs B | Mode A vs Mode B (same provider) |

### What agent-profiler Delivers

```
                  Plugin Contracts
                       |
     +--------+--------+--------+--------+
     |        |        |        |        |
     v        v        v        v        v
  Provider  Scorer  Collector Analyzer  Hooks
     |        |        |        |        |
     v        v        v        v        v
+-------------------------------------------------------+
|                   Profile Runner                       |
|  (matrix expansion, iteration loop, metric collection) |
+-------------------------------------------------------+
     |                    |                    |
     v                    v                    v
+-----------+      +-----------+        +-----------+
| ProfileRow|      | Statistics|        | Analyzers |
|   Store   |      |  Engine   |        |  Pipeline |
+-----------+      +-----------+        +-----------+
     |                    |                    |
     +--------------------+--------------------+
                          |
                          v
                   +-----------+
                   |  Reporter |
                   |  (pages)  |
                   +-----------+
                          |
                          v
                   +-----------+
                   |  Report   |
                   |  Folder   |
                   +-----------+
```

---

## Goals and Non-Goals

### Goals

1. **Generic agent profiling** -- profile any AI agent session, not tied to a
   specific provider or use case. The profiler does not iterate over models or
   select providers based on model -- it stores the model label on ProfileRow
   for grouping and reporting but never interprets it.
2. **Plugin architecture** -- every integration point (provider, scorer,
   collector, analyzer) is a pluggable interface.
3. **Statistical rigor** -- p50/p90/p95, IQR, CV, bootstrap confidence
   intervals, Cohen's d effect sizes.
4. **Session analysis** -- deep-dive into agent behavior: reasoning chains,
   tool patterns, error recovery, wasted turns.
5. **Rich reporting** -- folder-based reports with summary, metrics, analysis,
   comparison, and per-scenario pages.
6. **Exportable data** -- CSV, JSON, and Markdown outputs.
7. **Extensible metrics** -- consumers can inject custom metrics via collectors.
8. **Declarative configuration** -- YAML config defines the profiling matrix.

### Non-Goals

- Answer correctness evaluation (handled by consumer-provided scorers)
- Real-time monitoring (use Langfuse/AgentOps for that)
- Python support (TypeScript-only)
- Provider implementation (consumers bring their own)
- Scenario definition format (consumers define their own schema)

---

## Architecture Overview

### Package Structure

```
packages/agent-profiler/
  src/
    index.ts                          # Public API exports
    runner/
      profile-runner.ts               # Main run loop (matrix expansion)
      iteration.ts                    # Single iteration execution
      warmup.ts                       # Canary/warmup logic
    contracts/
      provider.ts                     # SessionProvider interface
      scorer.ts                       # Scorer interface
      collector.ts                    # Collector interface
      analyzer.ts                     # Analyzer interface
      mode-resolver.ts                # ModeResolver interface
      hooks.ts                        # RunHooks type
    types/
      profile-row.ts                  # ProfileRow (core result record)
      metrics.ts                      # TokenBreakdown, TimingBreakdown, etc.
      trace.ts                        # SessionTrace, TraceEvent
      scenario.ts                     # BaseScenario (minimal contract)
    collector/
      token-collector.ts              # Built-in token metric collector
      latency-collector.ts            # Built-in latency metric collector
      tool-call-collector.ts          # Built-in tool call metric collector
      cost-collector.ts               # Built-in cost metric collector
    analyzer/
      reasoning-analyzer.ts           # Reasoning quality analysis
      tool-pattern-analyzer.ts        # Tool usage pattern detection
      error-analyzer.ts               # Error recovery pattern analysis
      efficiency-analyzer.ts          # Wasted turns, redundancy detection
      strategy-analyzer.ts            # High-level approach comparison
    stats/
      descriptive.ts                  # Mean, median, p50, p90, p95, IQR, CV
      bootstrap.ts                    # Bootstrap confidence intervals
      comparison.ts                   # A/B comparison, Cohen's d
    store/
      types.ts                        # Store types
      jsonl-store.ts                  # JSONL read/write
      run-manifest.ts                 # Run metadata
    reporter/
      orchestrator.ts                 # Report generation coordinator
      summary-page.ts                 # High-level summary (index.md)
      metrics-page.ts                 # Detailed metrics breakdown
      analysis-page.ts                # Session analysis findings
      comparison-page.ts              # Cross-mode/model comparison
      scenario-page.ts                # Per-scenario deep dive
      csv-exporter.ts                 # CSV export
      json-exporter.ts                # JSON export
    config/
      loader.ts                       # YAML config loader
      schema.ts                       # Zod schemas for profiler config
    shared/
      logger.ts                       # Structured logging
      constants.ts                    # Defaults
  test/
    unit/
    integration/
```

### Layer Responsibilities

| Layer | Responsibility | Depends On |
|-------|---------------|------------|
| **Runner** | Expand profiling matrix (modes x scenarios x reps), execute iterations | Provider, Collector, Scorer |
| **Contracts** | Define plugin interfaces -- no implementation | Types only |
| **Types** | Core data types (ProfileRow, metrics, traces) | -- |
| **Collector** | Extract metrics from provider responses | Contract types |
| **Analyzer** | Deep-dive into session traces | Trace types |
| **Stats** | Statistical computations | -- |
| **Store** | Persist and retrieve profiling results | Types |
| **Reporter** | Generate multi-page reports | Store, Stats |
| **Config** | Load and validate profiler YAML config | Zod |

### Data Flow

```
1. Config loaded --> profiling matrix defined
2. Runner expands matrix: modes x scenarios x repetitions
3. For each iteration:
   a. Provider.createSession()
   b. Provider.prompt(scenario.prompt)         --> PromptResult (metrics)
   c. Collectors extract metrics from PromptResult
   d. Scorer evaluates correctness
   e. ProfileRow assembled and persisted
   f. Provider.exportSession()                 --> SessionTrace
   g. Analyzers process trace
4. Stats engine computes aggregates
5. Reporter generates pages
6. Report folder written to disk
```

### Single-Turn Assumption

Each iteration sends one prompt and waits for completion. Multi-turn scenarios
(multiple user messages in one session) are not supported in v1. If needed
later, `prompt()` can be called multiple times on the same session handle --
the contract already supports this, but the runner does not orchestrate it.

### Error Handling

If `prompt()` throws, the runner records a failed ProfileRow with
`success: false` and the `error` field populated. The runner retries up to
`allowedRetries` (configurable, default 0). If all retries fail, the failed
row is persisted to the result store -- it is never silently skipped. Failed
rows are included in statistics (as data points) and flagged in reports.

### Warmup

Before the real iteration loop begins, the runner executes the first scenario
once in a throwaway iteration to prime caches (provider connection, model
warm-up) and verify connectivity. The warmup row is discarded from results.
The `--skip-warmup` flag (or `execution.warmup: false` in config) skips this
step. Warmup is recommended for consistent timing in the first real iteration.

---

## Plugin Architecture

The profiler defines six plugin contracts. Consumers provide implementations
tailored to their specific agent platform and evaluation needs.

| Contract | Purpose | Who Implements |
|----------|---------|----------------|
| `SessionProvider` | Drive agent sessions (create, prompt, export) | Consumer (e.g., `@ghx-dev/eval`) |
| `Scorer` | Evaluate task correctness | Consumer |
| `Collector` | Extract custom metrics beyond built-ins | Consumer (optional) |
| `Analyzer` | Add domain-specific analysis | Consumer (optional) |
| `ModeResolver` | Map mode names to environment configs | Consumer |
| `RunHooks` | Inject lifecycle logic (setup, teardown) | Consumer (optional) |

See [contracts.md](./contracts.md) for full TypeScript interface definitions.

### Wiring Example

```typescript
import { runProfileSuite } from "@ghx-dev/agent-profiler"

const results = await runProfileSuite({
  modes: ["ghx", "mcp", "baseline"],
  scenarios: loadedScenarios,
  repetitions: 5,
  outputPath: "./results/run.jsonl",

  // Consumer-provided plugins
  provider: new OpencodeProvider({ port, model }),
  scorer: new CheckpointScorer(githubToken),
  modeResolver: new EvalModeResolver(),

  // Optional plugins
  collectors: [new GhxLogCollector()],
  analyzers: [new ReasoningAnalyzer(), new ToolPatternAnalyzer()],
  hooks: {
    beforeScenario: resetFixtures,
    afterScenario: exportSession,
  },
})
```

---

## Key Design Decisions

### 1. Plugin-First Architecture

**Decision:** Every integration point is a pluggable interface. The profiler
owns the run loop and statistics; consumers own the agent interaction and
domain-specific evaluation.

**Rationale:**
- The profiler will eventually move to a standalone repo. It cannot depend on
  any specific agent SDK, GitHub API, or evaluation domain.
- Plugin interfaces enable the same profiler to compare different agent
  platforms (OpenCode, Claude SDK, Copilot, etc.).

### 2. ProfileRow with Extensions

**Decision:** The core result record (`ProfileRow`) has typed fields for
standard metrics and an `extensions: Record<string, unknown>` field for
consumer-specific data.

**Rationale:**
- Standard metrics (tokens, latency, tool calls, cost) are universal across
  agent platforms.
- Domain-specific metrics (e.g., "ghx capabilities used", "MCP tools invoked")
  vary by consumer and should not pollute the core type.
- Extensions are preserved through storage, stats, and reporting.

### 3. TimingBreakdown as Segments Array

**Decision:** Instead of hardcoded timing fields (`reasoning_ms`, `tool_ms`),
use a `segments: Array<{ label, start_ms, end_ms }>` model.

**Rationale:**
- Different providers expose different timing granularity.
- A segments array is provider-agnostic -- any provider can contribute whatever
  timing data it has.
- The reporter can render segments as a timeline regardless of source.

### 4. Built-in Analyzers, Extensible Pipeline

**Decision:** Ship five built-in analyzers (reasoning, tool patterns, errors,
efficiency, strategy) but allow consumers to add more. Analyzers are organized
into two tiers based on cost and latency.

**Analyzer Tiers:**

| Tier | Name | Analyzers | When They Run |
|------|------|-----------|---------------|
| Tier 1 | Inline (deterministic) | reasoning, tool-pattern, error, efficiency | During suite execution -- no LLM calls, pure trace inspection |
| Tier 2 | Post-hoc (heavy) | strategy, LLM-judge (future) | After suite via `eval analyze` CLI on exported traces -- may involve LLM calls |

Tier 1 analyzers run automatically during the suite and their results are
included in the report. Tier 2 analyzers are optional and run separately on
exported session traces, keeping the main suite fast and deterministic.

**Rationale:**
- The five built-in analyzers cover universal agent behaviors.
- Consumers may want domain-specific analysis (e.g., "did the agent use the
  optimal ghx capability?") -- the analyzer interface supports this.
- Tiering keeps the main suite fast while allowing heavy analysis as a
  separate step.

### 5. Statistical Rigor by Default

**Decision:** All aggregate metrics include p50/p90/p95, IQR, CV, bootstrap
CI, and Cohen's d -- not just means.

**Rationale:**
- Agent performance is noisy. Means hide outliers and variability.
- Bootstrap CI provides distribution-free confidence intervals.
- Cohen's d quantifies practical significance, not just statistical.

---

## Deep-Dive References

| Topic | Document |
|-------|----------|
| Plugin Contracts | [contracts.md](./contracts.md) |
| Metric Types | [metrics.md](./metrics.md) |
| Base Scenario Schema | [scenarios.md](./scenarios.md) |
| Session Analysis | [analysis.md](./analysis.md) |
| Report Structure | [reports.md](./reports.md) |
| Statistical Utilities | [statistics.md](./statistics.md) |
| Configuration Reference | [configuration.md](./configuration.md) |
