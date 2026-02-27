import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"
import { countBacktracking, isToolCall } from "./utils.js"

function countProductiveTurns(trace: SessionTrace): number {
  let count = 0
  for (const turn of trace.turns) {
    const hasSuccessfulToolCall = turn.events.some((e) => e.type === "tool_call" && e.success)
    const hasTextOutput = turn.events.some((e) => e.type === "text_output")
    if (hasSuccessfulToolCall || hasTextOutput) {
      count += 1
    }
  }
  return count
}

function countDuplicateToolCalls(events: readonly TraceEvent[]): {
  readonly duplicates: number
  readonly total: number
} {
  const toolCalls = events.filter(isToolCall)
  const total = toolCalls.length
  const seen = new Map<string, number>()
  for (const tc of toolCalls) {
    const key = `${tc.name}::${JSON.stringify(tc.input)}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let duplicates = 0
  for (const count of seen.values()) {
    if (count > 1) {
      duplicates += count - 1
    }
  }
  return { duplicates, total }
}

/**
 * Analyzer that measures session efficiency in terms of turn productivity and information redundancy.
 *
 * Classifies each turn as productive (contains a successful tool call or text output) or wasted,
 * computes the fraction of redundant (duplicate) tool calls, and counts backtracking events
 * where the same tool is called with a different input after a previous invocation.
 */
export const efficiencyAnalyzer: Analyzer = {
  name: "efficiency",

  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    const totalTurns = trace.summary.totalTurns
    const productive = countProductiveTurns(trace)
    const wasted = totalTurns - productive
    const turnEfficiency = totalTurns === 0 ? 0 : productive / totalTurns

    const { duplicates, total } = countDuplicateToolCalls(trace.events)
    const redundancy = total === 0 ? 0 : duplicates / total

    const backtracking = countBacktracking(trace.events)

    return {
      analyzer: "efficiency",
      findings: {
        total_turns: {
          type: "number",
          value: totalTurns,
          unit: "turns",
        },
        productive_turns: {
          type: "number",
          value: productive,
          unit: "turns",
        },
        wasted_turns: {
          type: "number",
          value: wasted,
          unit: "turns",
        },
        turn_efficiency: {
          type: "ratio",
          value: turnEfficiency,
          label: "productive / total turns",
        },
        information_redundancy: {
          type: "ratio",
          value: redundancy,
          label: "duplicate / total tool calls",
        },
        backtracking_events: {
          type: "number",
          value: backtracking,
          unit: "events",
        },
      },
      summary: `${productive}/${totalTurns} productive turns (${(turnEfficiency * 100).toFixed(1)}% efficiency), ${backtracking} backtracking events`,
    }
  },
}
