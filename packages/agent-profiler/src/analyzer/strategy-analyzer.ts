import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"
import { countBacktracking, countRedundant, isToolCall } from "./utils.js"

const EXPLORATORY_UNIQUE_TOOL_THRESHOLD = 5
const EXPLORATORY_REASONING_DENSITY_THRESHOLD = 0.3
const DIRECT_MAX_TOOL_CALLS = 5
const HIGH_ERROR_RATE_THRESHOLD = 20
const REDUNDANT_CALL_THRESHOLD = 2
const STRONG_REASONING_DENSITY_THRESHOLD = 0.2

function countUniqueTools(events: readonly TraceEvent[]): number {
  const names = new Set(events.filter(isToolCall).map((e) => e.name))
  return names.size
}

function computeErrorRate(events: readonly TraceEvent[]): number {
  const toolCalls = events.filter(isToolCall)
  if (toolCalls.length === 0) return 0
  const failed = toolCalls.filter((tc) => !tc.success).length
  const errorEvents = events.filter((e) => e.type === "error").length
  return ((failed + errorEvents) / toolCalls.length) * 100
}

function describePhases(events: readonly TraceEvent[]): readonly string[] {
  const phases: string[] = []
  let currentType: string | undefined
  let count = 0

  for (const e of events) {
    const phaseType =
      e.type === "reasoning" ? "reasoning" : e.type === "tool_call" ? "tool execution" : undefined

    if (phaseType === undefined) continue

    if (phaseType === currentType) {
      count += 1
    } else {
      if (currentType !== undefined) {
        const label = currentType === "reasoning" ? "events" : "calls"
        phases.push(`${currentType} phase (${String(count)} ${label})`)
      }
      currentType = phaseType
      count = 1
    }
  }

  if (currentType !== undefined) {
    const label = currentType === "reasoning" ? "events" : "calls"
    phases.push(`${currentType} phase (${String(count)} ${label})`)
  }

  return phases
}

/**
 * Analyzer that classifies the agent's high-level problem-solving strategy.
 *
 * Derives a strategy label ("direct", "iterative", or "exploratory") based on
 * tool diversity and reasoning density, then describes the sequence of reasoning
 * and tool-execution phases and notes potential optimality concerns such as high
 * error rate, redundant calls, or strong reasoning usage.
 */
export const strategyAnalyzer: Analyzer = {
  name: "strategy",

  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    const totalToolCalls = trace.summary.totalToolCalls
    const uniqueTools = countUniqueTools(trace.events)
    const backtracking = countBacktracking(trace.events)
    const totalTokens = trace.summary.totalTokens.total
    const reasoningTokens = trace.summary.totalTokens.reasoning
    const reasoningDensity = totalTokens === 0 ? 0 : reasoningTokens / totalTokens

    let strategy: string
    if (
      uniqueTools > EXPLORATORY_UNIQUE_TOOL_THRESHOLD ||
      reasoningDensity > EXPLORATORY_REASONING_DENSITY_THRESHOLD
    ) {
      strategy = "exploratory"
    } else if (totalToolCalls <= DIRECT_MAX_TOOL_CALLS && backtracking === 0) {
      strategy = "direct"
    } else {
      strategy = "iterative"
    }

    const phases = describePhases(trace.events)

    const notes: string[] = []
    const errorRate = computeErrorRate(trace.events)
    if (errorRate > HIGH_ERROR_RATE_THRESHOLD) {
      notes.push(`High error rate (${errorRate.toFixed(0)}%)`)
    }
    const redundant = countRedundant(trace.events)
    if (redundant > REDUNDANT_CALL_THRESHOLD) {
      notes.push("Many redundant calls")
    }
    if (reasoningDensity > STRONG_REASONING_DENSITY_THRESHOLD) {
      notes.push("Strong reasoning foundation")
    }

    return {
      analyzer: "strategy",
      findings: {
        strategy_summary: {
          type: "string",
          value: strategy,
        },
        strategy_steps: {
          type: "list",
          values: phases,
        },
        optimality_notes: {
          type: "list",
          values: notes,
        },
      },
      summary: `Strategy: ${strategy}, ${phases.length} phases, ${notes.length} notes`,
    }
  },
}
