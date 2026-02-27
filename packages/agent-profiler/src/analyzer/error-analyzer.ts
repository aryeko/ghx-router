import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"

type ErrorType = "auth" | "not_found" | "timeout" | "parse_error" | "unknown"

function classifyError(message: string): ErrorType {
  const lower = message.toLowerCase()
  if (lower.includes("auth") || lower.includes("token") || lower.includes("permission")) {
    return "auth"
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "not_found"
  }
  if (lower.includes("timeout")) {
    return "timeout"
  }
  if (lower.includes("parse") || lower.includes("syntax") || lower.includes("json")) {
    return "parse_error"
  }
  return "unknown"
}

function isErrorOrFailed(e: TraceEvent): boolean {
  if (e.type === "error") return true
  if (e.type === "tool_call" && !e.success) return true
  return false
}

function getErrorMessage(e: TraceEvent): string {
  if (e.type === "error") return e.message
  if (e.type === "tool_call" && !e.success) return e.error ?? "unknown error"
  return "unknown error"
}

function countErrorCascades(events: readonly TraceEvent[]): number {
  let cascades = 0
  let streak = 0
  for (const e of events) {
    if (isErrorOrFailed(e)) {
      streak += 1
    } else {
      if (streak >= 2) {
        cascades += 1
      }
      streak = 0
    }
  }
  if (streak >= 2) {
    cascades += 1
  }
  return cascades
}

function computeRecoveryPatterns(events: readonly TraceEvent[]): ReadonlyMap<string, number> {
  const patterns = new Map<string, number>()
  for (let i = 0; i < events.length; i++) {
    const current = events[i]
    if (!current || !isErrorOrFailed(current)) continue

    const currentName = current.type === "tool_call" ? current.name : undefined
    const next = events[i + 1]

    if (!next) {
      patterns.set("give_up", (patterns.get("give_up") ?? 0) + 1)
    } else if (next.type === "tool_call") {
      if (currentName !== undefined && next.name === currentName) {
        patterns.set("retry", (patterns.get("retry") ?? 0) + 1)
      } else if (currentName === undefined) {
        patterns.set("tool_followup", (patterns.get("tool_followup") ?? 0) + 1)
      } else {
        patterns.set("alternative", (patterns.get("alternative") ?? 0) + 1)
      }
    }
  }
  return patterns
}

function countWastedTurns(trace: SessionTrace): number {
  let count = 0
  for (const turn of trace.turns) {
    const allErrorOrFailed = turn.events.length > 0 && turn.events.every(isErrorOrFailed)
    if (allErrorOrFailed) {
      count += 1
    }
  }
  return count
}

/**
 * Analyzer that categorizes and quantifies errors encountered during a session.
 *
 * Classifies errors by type (auth, not_found, timeout, parse_error, unknown),
 * identifies recovery patterns (retry, alternative, give_up), counts cascading
 * error sequences, and counts turns where every event was an error or failure.
 */
export const errorAnalyzer: Analyzer = {
  name: "error",

  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    const errorEvents = trace.events.filter(isErrorOrFailed)
    const errorCount = errorEvents.length

    const typeCounts = new Map<ErrorType, number>()
    for (const e of errorEvents) {
      const t = classifyError(getErrorMessage(e))
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
    const errorTypeRows = [...typeCounts.entries()].map(([t, count]) => [t, String(count)] as const)

    const recoveryPatterns = computeRecoveryPatterns(trace.events)
    const recoveryRows = [...recoveryPatterns.entries()].map(
      ([pattern, count]) => [pattern, String(count)] as const,
    )

    const cascades = countErrorCascades(trace.events)
    const wastedTurns = countWastedTurns(trace)

    return {
      analyzer: "error",
      findings: {
        errors_encountered: {
          type: "number",
          value: errorCount,
          unit: "errors",
        },
        error_types: {
          type: "table",
          headers: ["type", "count"],
          rows: errorTypeRows,
        },
        recovery_patterns: {
          type: "table",
          headers: ["pattern", "count"],
          rows: recoveryRows,
        },
        error_cascades: {
          type: "number",
          value: cascades,
          unit: "cascades",
        },
        wasted_turns_from_errors: {
          type: "number",
          value: wastedTurns,
          unit: "turns",
        },
      },
      summary: `${errorCount} errors, ${cascades} cascades, ${wastedTurns} wasted turns`,
    }
  },
}
