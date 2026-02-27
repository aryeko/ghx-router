import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"

const CONFUSION_KEYWORDS = ["confused", "unclear", "not sure", "don't understand", "retry", "wrong"]

function isReasoningEvent(e: TraceEvent): e is Extract<TraceEvent, { readonly type: "reasoning" }> {
  return e.type === "reasoning"
}

function extractConfusionSignals(events: readonly TraceEvent[]): readonly string[] {
  return events.filter(isReasoningEvent).flatMap((e) => {
    const lower = e.content.toLowerCase()
    const matched = CONFUSION_KEYWORDS.some((kw) => lower.includes(kw))
    return matched ? [e.content.slice(0, 50)] : []
  })
}

function determinePlanningQuality(events: readonly TraceEvent[]): string {
  const first = events[0]
  if (!first) return "mixed"
  if (first.type === "reasoning") return "proactive"
  if (first.type === "tool_call") return "reactive"
  return "mixed"
}

/**
 * Analyzer that measures the agent's use of extended reasoning.
 *
 * Computes reasoning density (reasoning tokens / total tokens), reasoning tokens
 * per tool call, planning quality classification, key decision snippets, and
 * confusion signal detection based on keyword matching in reasoning blocks.
 */
export const reasoningAnalyzer: Analyzer = {
  name: "reasoning",

  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    const totalTokens = trace.summary.totalTokens.total
    const reasoningTokens = trace.summary.totalTokens.reasoning
    const totalToolCalls = trace.summary.totalToolCalls

    const reasoningDensity = totalTokens === 0 ? 0 : reasoningTokens / totalTokens
    const reasoningPerToolCall = totalToolCalls === 0 ? 0 : reasoningTokens / totalToolCalls

    const reasoningEvents = trace.events.filter(isReasoningEvent)
    const keyDecisions = reasoningEvents.map((e) => e.content.slice(0, 50))
    const confusionSignals = extractConfusionSignals(trace.events)

    return {
      analyzer: "reasoning",
      findings: {
        reasoning_density: {
          type: "ratio",
          value: reasoningDensity,
          label: "reasoning tokens / total tokens",
        },
        reasoning_per_tool_call: {
          type: "number",
          value: reasoningPerToolCall,
          unit: "tokens/tool_call",
        },
        planning_quality: {
          type: "string",
          value: determinePlanningQuality(trace.events),
        },
        key_decisions: {
          type: "list",
          values: keyDecisions,
        },
        confusion_signals: {
          type: "list",
          values: confusionSignals,
        },
      },
      summary: `Reasoning density: ${(reasoningDensity * 100).toFixed(1)}%, ${reasoningEvents.length} reasoning events, ${confusionSignals.length} confusion signals`,
    }
  },
}
