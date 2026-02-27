import type { TraceEvent } from "@profiler/types/trace.js"

export function isToolCall(
  e: TraceEvent,
): e is Extract<TraceEvent, { readonly type: "tool_call" }> {
  return e.type === "tool_call"
}

export function countBacktracking(events: readonly TraceEvent[]): number {
  const toolCalls = events.filter(isToolCall)
  const seenInputs = new Map<string, string>()
  let count = 0
  for (const tc of toolCalls) {
    const inputStr = JSON.stringify(tc.input)
    const prev = seenInputs.get(tc.name)
    if (prev !== undefined && prev !== inputStr) {
      count += 1
    }
    seenInputs.set(tc.name, inputStr)
  }
  return count
}

export function countRedundant(events: readonly TraceEvent[]): number {
  const toolCalls = events.filter(isToolCall)
  const seen = new Map<string, number>()
  for (const tc of toolCalls) {
    const key = `${tc.name}::${JSON.stringify(tc.input)}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let total = 0
  for (const count of seen.values()) {
    if (count > 1) {
      total += count - 1
    }
  }
  return total
}
