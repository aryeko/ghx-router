# Custom Analyzers

Create custom Analyzer implementations to produce structured findings from session traces.

## Analyzer Contract

An analyzer examines a full `SessionTrace` and produces an `AnalysisResult` containing named findings and a human-readable summary. Analyzers run only when a trace is available -- the runner skips them when `sessionExport` is disabled and no trace exists.

```typescript
interface Analyzer {
  readonly name: string
  analyze(trace: SessionTrace, scenario: BaseScenario, mode: string): Promise<AnalysisResult>
}
```

## AnalysisResult Structure

Each analyzer returns an `AnalysisResult` with three fields:

```typescript
interface AnalysisResult {
  readonly analyzer: string
  readonly findings: Readonly<Record<string, AnalysisFinding>>
  readonly summary: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `analyzer` | `string` | Matches the analyzer's `name` field |
| `findings` | `Record<string, AnalysisFinding>` | Named findings keyed by a unique identifier |
| `summary` | `string` | Human-readable summary of the analysis |

## Finding Types

`AnalysisFinding` is a discriminated union with five variants. Each variant has a `type` field that determines the shape of the data.

| Type | Fields | Use Case |
|------|--------|----------|
| `"number"` | `value: number`, `unit: string` | Numeric measurements (e.g., average duration, count) |
| `"string"` | `value: string` | Qualitative observations (e.g., strategy description) |
| `"list"` | `values: readonly string[]` | Collections (e.g., list of tool names used) |
| `"table"` | `headers: readonly string[]`, `rows: readonly (readonly string[])[]` | Tabular data (e.g., per-tool breakdown) |
| `"ratio"` | `value: number`, `label: string` | Proportions and percentages (e.g., success rate) |

```typescript
// Number finding
{ type: "number", value: 342, unit: "ms" }

// String finding
{ type: "string", value: "Agent used a depth-first file exploration strategy" }

// List finding
{ type: "list", values: ["readFile", "writeFile", "runCommand"] }

// Table finding
{ type: "table", headers: ["Tool", "Count", "Avg Duration"], rows: [["readFile", "12", "45ms"]] }

// Ratio finding
{ type: "ratio", value: 0.85, label: "tool success rate" }
```

## Example: Average Tool Call Duration Analyzer

This analyzer computes the average duration of tool calls from the session trace.

```typescript
import type { Analyzer, AnalysisResult, SessionTrace, BaseScenario } from "@ghx-dev/agent-profiler"

const toolDurationAnalyzer: Analyzer = {
  name: "tool-duration",

  async analyze(trace: SessionTrace, _scenario: BaseScenario, _mode: string): Promise<AnalysisResult> {
    // TraceEvent is a discriminated union on `type`. After filtering for "tool_call",
    // fields like `name` and `durationMs` are top-level properties on the event.
    const toolEvents = trace.events.filter((e) => e.type === "tool_call")
    const durations = toolEvents.map((e) => e.durationMs)

    const avgMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0

    const maxMs = durations.length > 0 ? Math.max(...durations) : 0
    const minMs = durations.length > 0 ? Math.min(...durations) : 0

    // Build per-tool breakdown table
    const toolMap = new Map<string, { total: number, count: number }>()
    for (const event of toolEvents) {
      const existing = toolMap.get(event.name) ?? { total: 0, count: 0 }
      toolMap.set(event.name, { total: existing.total + event.durationMs, count: existing.count + 1 })
    }

    const rows = [...toolMap.entries()].map(([name, stats]) => [
      name,
      String(stats.count),
      `${Math.round(stats.total / stats.count)}ms`,
    ])

    return {
      analyzer: "tool-duration",
      findings: {
        average_duration: { type: "number", value: Math.round(avgMs), unit: "ms" },
        min_duration: { type: "number", value: minMs, unit: "ms" },
        max_duration: { type: "number", value: maxMs, unit: "ms" },
        tool_count: { type: "number", value: toolEvents.length, unit: "count" },
        per_tool_breakdown: {
          type: "table",
          headers: ["Tool", "Invocations", "Avg Duration"],
          rows,
        },
      },
      summary: `Analyzed ${toolEvents.length} tool calls. Average duration: ${Math.round(avgMs)}ms (min: ${minMs}ms, max: ${maxMs}ms).`,
    }
  },
}
```

## Registering Analyzers

Pass analyzers to `runProfileSuite` via the `analyzers` array in `ProfileSuiteOptions`:

```typescript
import { runProfileSuite } from "@ghx-dev/agent-profiler"

const result = await runProfileSuite({
  // ... other options
  analyzers: [
    toolDurationAnalyzer,   // your custom analyzer
  ],
  sessionExport: false,      // optional: auto-enabled when analyzers are present
})
```

When analyzers are present, the runner automatically enables session export (even if `sessionExport` is `false`) because analyzers require trace data. You do not need to set `sessionExport: true` explicitly when using analyzers.

## Tier System and Report Integration

Analysis results are grouped by analyzer name into a `SessionAnalysisBundle`. Each bundle aggregates the `AnalysisResult` objects from all iterations where that analyzer ran.

The report generator consumes these bundles to produce the analysis page (`analysis.md`) in the report output. Findings are rendered according to their type: numbers as values with units, lists as bullet points, tables as Markdown tables, and ratios as percentage labels.

```text
reports/<timestamp>/
  analysis.md         <-- your analyzer findings appear here
```

The analysis page groups findings by analyzer name, so each custom analyzer gets its own section with all findings presented in a consistent format.

## Pitfalls

- **Analyzers only run when a trace is available.** If no trace exists for an iteration (e.g., the provider failed before `exportSession`), the analyzer is skipped for that iteration.
- **Analyzer `name` must be unique.** If two analyzers share the same `name`, their results collide in the `SessionAnalysisBundle`. Use descriptive, hyphenated names.
- **Keep analyzers deterministic.** The same trace should produce the same findings. Avoid randomness or external state in analysis logic.
- **Handle empty traces gracefully.** A trace may have zero events if the session completed without any tool calls or reasoning steps.

## Source Reference

- Analyzer contract: `packages/agent-profiler/src/contracts/analyzer.ts`
- Built-in analyzers: `packages/agent-profiler/src/analyzer/`
- Report analysis page: `packages/agent-profiler/src/reporter/orchestrator.ts`

## Related Documentation

- [Custom Collectors](custom-collectors.md) -- extract numeric metrics from prompt results
- [Implementing a Provider](implementing-a-provider.md) -- the exportSession method that produces traces
- [Reports](reports.md) -- how analysis findings appear in generated reports
- [Plugin Contracts](../architecture/plugin-contracts.md) -- full interface definitions
- [Core Concepts](../getting-started/concepts.md) -- mental model and plugin-first architecture
