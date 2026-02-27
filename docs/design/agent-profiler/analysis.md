# Session Analysis

> Back to [main design](./README.md)

---

## Overview

Session analysis goes beyond metrics to answer *why* one mode performs
differently from another. The analyzer pipeline reads session traces and
produces qualitative insights about agent behavior -- what the agent did,
where it struggled, and how different modes lead to different strategies.

---

## Analysis Pipeline

```
SessionTrace (from provider.exportSession)
       |
       v
  +------------------+
  | Trace Normalizer  |  Converts provider-specific trace into uniform
  +------------------+  TraceEvent stream
       |
       +-------+--------+--------+---------+
       |       |        |        |         |
       v       v        v        v         v
  Reasoning  Tool     Error   Efficiency  Strategy
  Analyzer   Pattern  Analyzer Analyzer   Analyzer
       |       |        |        |         |
       v       v        v        v         v
  +--------------------------------------------------+
  |            AnalysisResult (per analyzer)          |
  +--------------------------------------------------+
       |
       v
  SessionAnalysisBundle (all results for one session)
       |
       v
  Cross-session comparison (same scenario, different modes)
       |
       v
  Analysis Report Page
```

---

## Trace Types

### TraceEvent

The normalized event stream that all analyzers consume:

```typescript
type TraceEvent =
  | {
      readonly type: "reasoning"
      readonly content: string
      readonly durationMs: number
      readonly tokenCount: number
    }
  | {
      readonly type: "tool_call"
      readonly name: string
      readonly input: unknown
      readonly output: unknown
      readonly durationMs: number
      readonly success: boolean
      readonly error?: string
    }
  | {
      readonly type: "text_output"
      readonly content: string
      readonly tokenCount: number
    }
  | {
      readonly type: "turn_boundary"
      readonly turnNumber: number
      readonly timestamp: string
    }
  | {
      readonly type: "error"
      readonly message: string
      readonly recoverable: boolean
    }
```

### Turn

Events grouped by assistant turn:

```typescript
interface Turn {
  readonly number: number
  readonly events: readonly TraceEvent[]
  readonly startTimestamp: string
  readonly endTimestamp: string
  readonly durationMs: number
}
```

### Trace Normalization

The profiler provides a trace normalizer interface. Consumers implement it to
convert their provider's raw session data into the `TraceEvent` stream:

```typescript
interface TraceNormalizer {
  normalize(rawTrace: SessionTrace): readonly TraceEvent[]
}
```

The profiler ships a default normalizer that works with the generic
`SessionTrace` type. Consumers can override it for provider-specific formats.

---

## Built-in Analyzers

### 1. Reasoning Analyzer

Examines the agent's thinking/reasoning blocks to understand decision-making.

**Findings:**

| Key | Type | Description |
|-----|------|-------------|
| `reasoning_density` | ratio | Reasoning tokens / total tokens |
| `reasoning_per_tool_call` | number | Average reasoning tokens before each tool call |
| `planning_quality` | string | `"proactive"`, `"reactive"`, or `"mixed"` |
| `key_decisions` | list | Extracted decision points from reasoning text |
| `confusion_signals` | list | Phrases indicating uncertainty |

**Detection patterns:**

```
For each reasoning block:
  1. Measure length (tokens, words)
  2. Detect planning patterns ("I need to...", "First...", "The approach is...")
  3. Detect confusion patterns ("not sure...", "Let me try...", "That didn't work")
  4. Track decision points (tool selection reasoning)
  5. Correlate with subsequent tool call success/failure
```

### 2. Tool Pattern Analyzer

Examines the sequence and composition of tool calls.

**Findings:**

| Key | Type | Description |
|-----|------|-------------|
| `tool_sequence` | list | Ordered list of tool names called |
| `unique_tools_used` | number | Count of distinct tool types |
| `tool_call_patterns` | table | Recurring sequences (e.g., "read then edit then read") |
| `redundant_calls` | table | Tool calls that retrieved the same information twice |
| `failed_then_retried` | table | Tool calls that failed and were retried |

**Pattern detection approach:**

```
1. Build n-gram sequences of tool names (n=2,3,4)
2. Count occurrences of each n-gram
3. Flag n-grams that appear > 1 time as patterns
4. Compare input parameters to detect redundant calls
5. Match failed calls with subsequent retry attempts
```

### 3. Error Analyzer

Identifies error patterns and recovery behavior.

**Findings:**

| Key | Type | Description |
|-----|------|-------------|
| `errors_encountered` | number | Total errors during the session |
| `error_types` | table | Classification (auth, not_found, timeout, parse_error, etc.) |
| `recovery_patterns` | table | How the agent recovered (retry, alternative, give up) |
| `error_cascades` | number | Errors that led to subsequent errors |
| `wasted_turns_from_errors` | number | Turns spent on error recovery |

### 4. Efficiency Analyzer

Detects wasted work and suboptimal patterns.

**Findings:**

| Key | Type | Description |
|-----|------|-------------|
| `total_turns` | number | Number of assistant turns |
| `productive_turns` | number | Turns that advanced toward the goal |
| `wasted_turns` | number | Turns spent on errors, re-fetches, or dead ends |
| `turn_efficiency` | ratio | `productive_turns / total_turns` |
| `information_redundancy` | ratio | How often the same info was fetched multiple times |
| `backtracking_events` | number | Times the agent undid previous work |

### 5. Strategy Analyzer

Compares the high-level approach taken across modes for the same scenario.

**Findings:**

| Key | Type | Description |
|-----|------|-------------|
| `strategy_summary` | string | One-line description of the agent's approach |
| `strategy_steps` | list | Ordered high-level steps taken |
| `optimality_notes` | list | Whether the strategy was optimal given available tools |

---

## SessionAnalysisBundle

All analyzer results for one session, bundled together:

```typescript
interface SessionAnalysisBundle {
  readonly sessionId: string
  readonly scenarioId: string
  readonly mode: string
  readonly model: string
  readonly results: Readonly<Record<string, AnalysisResult>>
}
```

---

## Cross-Session Comparison

The analysis pipeline can compare sessions across modes for the same scenario:

```
Given: 3 sessions for "scenario-a"
       - mode-a, iteration 0
       - mode-b, iteration 0
       - mode-c, iteration 0

Output:
  +------------------+---------+---------+---------+
  |                  | mode-a  | mode-b  | mode-c  |
  +------------------+---------+---------+---------+
  | Turns            | 12      | 9       | 7       |
  | Productive turns | 8       | 7       | 7       |
  | Wasted turns     | 4       | 2       | 0       |
  | Tool calls       | 15      | 11      | 8       |
  | Redundant calls  | 3       | 1       | 0       |
  | Errors           | 2       | 1       | 0       |
  | Strategy         | Multi   | Direct  | Direct  |
  |                  | step    | call    | call    |
  +------------------+---------+---------+---------+
```

This comparison table is the centerpiece of the analysis report page.

---

## Adding Custom Analyzers

Consumers implement the `Analyzer` interface (see [contracts.md](./contracts.md))
and pass instances to `runProfileSuite({ analyzers: [...] })`.

Custom analyzer results are included in the analysis report page alongside
built-in analyzer results.
