import type { SessionTrace, TraceEvent, Turn } from "@ghx-dev/agent-profiler"

// OpenCode message types (based on SDK structure)
interface OpenCodeMessagePart {
  type: string
  [key: string]: unknown
}

interface OpenCodeMessage {
  role: "user" | "assistant"
  parts?: readonly OpenCodeMessagePart[]
  tokens?: {
    input?: number
    output?: number
    cache_read?: number
    cache_write?: number
  }
  time_created?: string
}

export class TraceBuilder {
  /**
   * Convert an array of OpenCode session messages into TraceEvent[].
   * This bridges OpenCode's message format to the profiler's generic trace model.
   */
  buildEvents(messages: readonly unknown[]): readonly TraceEvent[] {
    const events: TraceEvent[] = []
    let turnNumber = 0

    for (const msg of messages) {
      const message = msg as OpenCodeMessage
      if (message.role !== "assistant") continue

      events.push({
        type: "turn_boundary",
        turnNumber,
        timestamp: message.time_created ?? new Date().toISOString(),
      })
      turnNumber++

      if (!message.parts) continue

      for (const part of message.parts) {
        const event = this.convertPart(part)
        if (event) events.push(event)
      }
    }

    return events
  }

  private convertPart(part: OpenCodeMessagePart): TraceEvent | null {
    switch (part.type) {
      case "reasoning": {
        const content = (part["reasoning"] as string) ?? ""
        return {
          type: "reasoning",
          content,
          durationMs: 0,
          tokenCount: Math.ceil(content.length / 4),
        }
      }
      case "tool": {
        const state = part["state"] as Record<string, unknown> | undefined
        if (!state) return null
        const name = (state["name"] as string) ?? "unknown"
        const hasError = state["error"] !== undefined
        return {
          type: "tool_call",
          name,
          input: state["input"] ?? {},
          output: state["output"] ?? state["error"] ?? null,
          durationMs: 0,
          success: !hasError,
          ...(hasError ? { error: String(state["error"]) } : {}),
        }
      }
      case "text": {
        const content = (part["text"] as string) ?? ""
        return {
          type: "text_output",
          content,
          tokenCount: Math.ceil(content.length / 4),
        }
      }
      case "step-finish":
        // step-finish parts signal completion — no trace event needed
        return null
      default:
        return null
    }
  }

  /**
   * Group TraceEvents into Turns using turn_boundary markers.
   */
  groupIntoTurns(events: readonly TraceEvent[]): readonly Turn[] {
    const turns: Turn[] = []
    let currentTurnEvents: TraceEvent[] = []
    let currentTurnNumber = -1
    let currentStartTimestamp = new Date().toISOString()

    for (const event of events) {
      if (event.type === "turn_boundary") {
        if (currentTurnNumber >= 0 && currentTurnEvents.length > 0) {
          turns.push({
            number: currentTurnNumber,
            events: currentTurnEvents,
            startTimestamp: currentStartTimestamp,
            endTimestamp: event.timestamp,
            durationMs: 0,
          })
        }
        currentTurnNumber = event.turnNumber
        currentStartTimestamp = event.timestamp
        currentTurnEvents = []
      } else {
        currentTurnEvents.push(event)
      }
    }

    // Push the last turn
    if (currentTurnNumber >= 0 && currentTurnEvents.length > 0) {
      const endTimestamp = new Date().toISOString()
      turns.push({
        number: currentTurnNumber,
        events: currentTurnEvents,
        startTimestamp: currentStartTimestamp,
        endTimestamp,
        durationMs: 0,
      })
    }

    return turns
  }

  /**
   * Build a full SessionTrace from raw OpenCode messages.
   */
  buildTrace(sessionId: string, messages: readonly unknown[]): SessionTrace {
    const events = this.buildEvents(messages)
    const turns = this.groupIntoTurns(events)

    let inputTokens = 0
    let outputTokens = 0
    let cacheReadTokens = 0
    let cacheWriteTokens = 0

    for (const msg of messages) {
      const message = msg as OpenCodeMessage
      if (message.role !== "assistant" || !message.tokens) continue
      inputTokens += message.tokens.input ?? 0
      outputTokens += message.tokens.output ?? 0
      cacheReadTokens += message.tokens.cache_read ?? 0
      cacheWriteTokens += message.tokens.cache_write ?? 0
    }

    let reasoningTokens = 0
    for (const event of events) {
      if (event.type === "reasoning") {
        reasoningTokens += event.tokenCount ?? 0
      }
    }

    const total = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens
    const active = inputTokens + outputTokens + reasoningTokens

    const totalTokens = {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheWriteTokens,
      total,
      active,
    }

    const firstTurn = turns[0]
    const lastTurn = turns[turns.length - 1]
    const totalDuration =
      firstTurn !== undefined && lastTurn !== undefined
        ? new Date(lastTurn.endTimestamp).getTime() - new Date(firstTurn.startTimestamp).getTime()
        : 0

    return {
      sessionId,
      events,
      turns,
      summary: {
        totalTurns: turns.length,
        totalToolCalls: events.filter((e) => e.type === "tool_call").length,
        totalTokens,
        totalDuration,
      },
    }
  }
}
