import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"
import { isToolCall } from "./utils.js"

function computeBigrams(toolNames: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < toolNames.length - 1; i++) {
    const a = toolNames[i]
    const b = toolNames[i + 1]
    if (a === undefined || b === undefined) continue
    const key = `${a} -> ${b}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function computeRedundantCalls(
  toolCalls: readonly Extract<TraceEvent, { readonly type: "tool_call" }>[],
): ReadonlyMap<
  string,
  { readonly tool: string; readonly inputHash: string; readonly count: number }
> {
  const seen = new Map<
    string,
    { readonly tool: string; readonly inputHash: string; count: number }
  >()
  for (const tc of toolCalls) {
    const inputHash = JSON.stringify(tc.input)
    const key = `${tc.name}::${inputHash}`
    const existing = seen.get(key)
    if (existing) {
      seen.set(key, { ...existing, count: existing.count + 1 })
    } else {
      seen.set(key, { tool: tc.name, inputHash, count: 1 })
    }
  }
  const result = new Map<
    string,
    { readonly tool: string; readonly inputHash: string; readonly count: number }
  >()
  for (const [key, val] of seen) {
    if (val.count > 1) {
      result.set(key, val)
    }
  }
  return result
}

function computeFailedThenRetried(
  toolCalls: readonly Extract<TraceEvent, { readonly type: "tool_call" }>[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < toolCalls.length - 1; i++) {
    const current = toolCalls[i]
    const next = toolCalls[i + 1]
    if (!current || !next) continue
    if (!current.success && next.name === current.name) {
      counts.set(current.name, (counts.get(current.name) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Analyzer that identifies sequential tool usage patterns within a session.
 *
 * Computes bigram frequencies of consecutive tool calls, detects redundant
 * invocations (same tool with identical input), and identifies failed-then-retried
 * patterns where the agent immediately retries a failing tool call.
 */
export const toolPatternAnalyzer: Analyzer = {
  name: "tool-pattern",

  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    const toolCalls = trace.events.filter(isToolCall)
    const toolNames = toolCalls.map((tc) => tc.name)
    const uniqueTools = new Set(toolNames)

    const bigrams = computeBigrams(toolNames)
    const bigramRows = [...bigrams.entries()].map(
      ([pattern, count]) => [pattern, String(count)] as const,
    )

    const redundant = computeRedundantCalls(toolCalls)
    const redundantRows = [...redundant.values()].map(
      (r) => [r.tool, r.inputHash, String(r.count)] as const,
    )

    const failedRetried = computeFailedThenRetried(toolCalls)
    const failedRetriedRows = [...failedRetried.entries()].map(
      ([tool, count]) => [tool, String(count)] as const,
    )

    return {
      analyzer: "tool-pattern",
      findings: {
        tool_sequence: {
          type: "list",
          values: toolNames,
        },
        unique_tools_used: {
          type: "number",
          value: uniqueTools.size,
          unit: "tools",
        },
        tool_call_patterns: {
          type: "table",
          headers: ["pattern", "count"],
          rows: bigramRows,
        },
        redundant_calls: {
          type: "table",
          headers: ["tool", "input_hash", "count"],
          rows: redundantRows,
        },
        failed_then_retried: {
          type: "table",
          headers: ["tool", "occurrences"],
          rows: failedRetriedRows,
        },
      },
      summary: `${toolCalls.length} tool calls, ${uniqueTools.size} unique tools, ${redundantRows.length} redundant patterns, ${failedRetriedRows.length} retry patterns`,
    }
  },
}
