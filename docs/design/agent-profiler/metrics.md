# Metric Types

> Back to [main design](./README.md)

---

## Overview

The profiler defines generic metric types that work across any agent platform.
These types are used by built-in collectors, stored in `ProfileRow`, and
rendered by the reporter.

---

## Core Metric Types

### TokenBreakdown

Token usage across standard categories. Every provider should populate at
least `input` and `output`; other fields are optional.

```typescript
interface TokenBreakdown {
  readonly input: number
  readonly output: number
  readonly reasoning: number           // Thinking/reasoning tokens (0 if not supported)
  readonly cacheRead: number           // Tokens served from prompt cache
  readonly cacheWrite: number          // Tokens written to prompt cache
  readonly total: number               // input + output
  readonly active: number              // total - cacheRead (actual compute cost)
}
```

**Why `active` matters:** `active` strips out cache hits, reflecting the real
computational cost. This is the primary token metric for comparisons because
structured tool calls (like ghx) tend to be more cache-friendly than free-form
CLI invocations.

### TimingBreakdown

Provider-agnostic timing model using labeled segments rather than hardcoded
fields. Different providers expose different timing granularity -- segments
accommodate all of them.

```typescript
interface TimingBreakdown {
  /** Total wall time for the agent turn (ms) */
  readonly wallMs: number
  /** Time segments with start/end offsets relative to turn start */
  readonly segments: readonly TimingSegment[]
}

interface TimingSegment {
  /** Human-readable label (e.g., "reasoning", "tool_execution", "first_token") */
  readonly label: string
  /** Start offset in ms from turn start */
  readonly startMs: number
  /** End offset in ms from turn start */
  readonly endMs: number
}
```

**Standard segment labels** (conventions, not enforced):

| Label | Description |
|-------|-------------|
| `first_token` | Time to first output token (0 to TTFT) |
| `reasoning` | Time spent in reasoning/thinking blocks |
| `tool_execution` | Time spent executing tools |
| `between_turns` | Gap between tool completion and next reasoning |
| `sdk_latency` | Provider's internal latency measure |

### CostBreakdown

```typescript
interface CostBreakdown {
  readonly totalUsd: number
  readonly inputUsd: number
  readonly outputUsd: number
  readonly reasoningUsd: number
}
```

### ToolCallRecord

A single tool invocation recorded during a session.

```typescript
interface ToolCallRecord {
  /** Tool name as reported by the provider */
  readonly name: string
  /** Tool category (see classification below) */
  readonly category: string
  /** Whether the tool call succeeded */
  readonly success: boolean
  /** Duration in ms (if available) */
  readonly durationMs: number | null
  /** Error message if failed */
  readonly error?: string
}
```

**Tool category classification** is consumer-defined. The profiler provides a
default classifier that uses the tool name, but consumers can override it via
a `Collector` to apply domain-specific categorization.

---

## ProfileRow

The core result record for one profiling iteration. One `ProfileRow` is
produced per (scenario, mode, model, iteration) tuple.

```typescript
interface ProfileRow {
  // Identity
  readonly runId: string
  readonly scenarioId: string
  readonly mode: string
  readonly model: string
  readonly iteration: number

  // Timestamps
  readonly startedAt: string             // ISO timestamp
  readonly completedAt: string           // ISO timestamp

  // Metrics
  readonly tokens: TokenBreakdown
  readonly timing: TimingBreakdown
  readonly toolCalls: {
    readonly total: number
    readonly byCategory: Readonly<Record<string, number>>
    readonly failed: number
    readonly retried: number
    readonly errorRate: number             // failed / total (0.0 - 1.0)
    readonly records: readonly ToolCallRecord[]
  }
  readonly cost: CostBreakdown

  // Correctness (from Scorer)
  readonly success: boolean
  readonly checkpointsPassed: number
  readonly checkpointsTotal: number
  readonly checkpointDetails: readonly CheckpointResult[]
  readonly outputValid: boolean

  // Session metadata
  readonly provider: string
  readonly sessionId: string
  readonly agentTurns: number
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"

  // Consumer extensions (domain-specific metrics)
  readonly extensions: Readonly<Record<string, unknown>>

  // Error (if iteration failed)
  readonly error?: string
  readonly errorCode?: string
}

interface CheckpointResult {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected?: unknown
}
```

### Extensions Field

The `extensions` field carries consumer-specific metrics injected by
`Collector` plugins. For example, `@ghx-dev/eval` might add:

```typescript
{
  "ghx.capabilities_used": ["pr.view", "pr.review_threads.list"],
  "ghx.gh_cli_commands": 0,
  "ghx.mcp_tools_invoked": 0,
  "eval.fixture_reset_ms": 1200
}
```

Extensions are preserved through storage, included in CSV/JSON exports, and
rendered in reports.

---

## Aggregate Metric Types

Computed by the statistics engine during report generation, not per-iteration.

### DescriptiveStats

```typescript
interface DescriptiveStats {
  readonly count: number
  readonly mean: number
  readonly median: number                // p50
  readonly p90: number
  readonly p95: number
  readonly min: number
  readonly max: number
  readonly iqr: number                   // Interquartile range
  readonly cv: number                    // Coefficient of variation
  readonly stddev: number
}
```

### ComparisonResult

Produced when comparing two modes (e.g., ghx vs baseline):

```typescript
interface ComparisonResult {
  readonly modeA: string
  readonly modeB: string
  readonly metric: string
  readonly reductionPct: number          // (1 - A/B) * 100
  readonly ci95: readonly [number, number]  // Bootstrap 95% CI
  readonly effectSize: number            // Cohen's d
  readonly effectMagnitude: "negligible" | "small" | "medium" | "large"
  readonly pValue: number                // Permutation test p-value
}
```

See [statistics.md](./statistics.md) for computation details.

---

## Metric Collection Flow

```
Provider.prompt()
    |
    v
PromptResult { tokens, timing, toolCalls, cost }
    |
    +---> Built-in collectors extract standard metrics
    |
    +---> Consumer collectors extract extensions
    |
    v
ProfileRow assembled
    |
    v
JSONL store
    |
    v
Stats engine computes DescriptiveStats per group
    |
    v
Comparison engine computes ComparisonResult across modes
    |
    v
Reporter renders tables and charts
```
