import type { BenchmarkTimingBreakdown, SessionMessageEntry } from "@bench/domain/types.js"
import { isObject } from "@bench/util/guards.js"
import { asNumber } from "./polling.js"

export function extractTimingBreakdown(messages: SessionMessageEntry[]): BenchmarkTimingBreakdown {
  const breakdown: BenchmarkTimingBreakdown = {
    assistant_total_ms: 0,
    assistant_pre_reasoning_ms: 0,
    assistant_reasoning_ms: 0,
    assistant_between_reasoning_and_tool_ms: 0,
    assistant_post_tool_ms: 0,
    tool_total_ms: 0,
    tool_bash_ms: 0,
    tool_structured_output_ms: 0,
    observed_assistant_turns: 0,
  }

  for (const message of messages) {
    const info = isObject(message.info) ? (message.info as Record<string, unknown>) : null
    if (!info || info.role !== "assistant") {
      continue
    }

    const infoTime = isObject(info.time) ? info.time : null
    const created = asNumber((infoTime?.created as unknown) ?? null)
    const completed = asNumber((infoTime?.completed as unknown) ?? null)
    const parts = Array.isArray(message.parts) ? message.parts : []

    if (typeof created === "number" && typeof completed === "number") {
      breakdown.assistant_total_ms += Math.max(0, completed - created)
    }
    breakdown.observed_assistant_turns += 1

    const reasoningParts = parts.filter((part) => part.type === "reasoning")
    const toolParts = parts.filter((part) => part.type === "tool")

    let firstReasoningStart: number | null = null
    let lastReasoningEnd: number | null = null
    for (const part of reasoningParts) {
      const time = isObject(part.time) ? part.time : null
      const start = asNumber((time?.start as unknown) ?? null)
      const end = asNumber((time?.end as unknown) ?? null)
      if (typeof start === "number" && typeof end === "number") {
        breakdown.assistant_reasoning_ms += Math.max(0, end - start)
        if (firstReasoningStart === null || start < firstReasoningStart) {
          firstReasoningStart = start
        }
        if (lastReasoningEnd === null || end > lastReasoningEnd) {
          lastReasoningEnd = end
        }
      }
    }

    let firstToolStart: number | null = null
    let lastToolEnd: number | null = null
    for (const part of toolParts) {
      const state = isObject(part.state) ? part.state : null
      const time = isObject(state?.time) ? state.time : null
      const tool = typeof part.tool === "string" ? part.tool : ""
      const start = asNumber((time?.start as unknown) ?? null)
      const end = asNumber((time?.end as unknown) ?? null)

      if (typeof start === "number" && typeof end === "number") {
        const duration = Math.max(0, end - start)
        breakdown.tool_total_ms += duration
        if (tool === "bash") {
          breakdown.tool_bash_ms += duration
        }
        if (tool === "StructuredOutput") {
          breakdown.tool_structured_output_ms += duration
        }

        if (firstToolStart === null || start < firstToolStart) {
          firstToolStart = start
        }
        if (lastToolEnd === null || end > lastToolEnd) {
          lastToolEnd = end
        }
      }
    }

    if (typeof created === "number" && firstReasoningStart !== null) {
      breakdown.assistant_pre_reasoning_ms += Math.max(0, firstReasoningStart - created)
    }

    if (lastReasoningEnd !== null && firstToolStart !== null) {
      breakdown.assistant_between_reasoning_and_tool_ms += Math.max(
        0,
        firstToolStart - lastReasoningEnd,
      )
    }

    if (typeof completed === "number" && lastToolEnd !== null) {
      breakdown.assistant_post_tool_ms += Math.max(0, completed - lastToolEnd)
    }
  }

  return breakdown
}
