import { TraceBuilder } from "@eval/provider/trace-builder.js"
import { describe, expect, it } from "vitest"

const builder = new TraceBuilder()

describe("TraceBuilder.buildEvents", () => {
  it("returns empty array for empty messages", () => {
    expect(builder.buildEvents([])).toEqual([])
  })

  it("skips non-assistant messages", () => {
    const messages = [{ role: "user", parts: [{ type: "text", text: "hello" }] }]
    expect(builder.buildEvents(messages)).toEqual([])
  })

  it("emits turn_boundary for each assistant message", () => {
    const messages = [
      { role: "assistant", parts: [] },
      { role: "assistant", parts: [] },
    ]
    const events = builder.buildEvents(messages)
    const boundaries = events.filter((e) => e.type === "turn_boundary")
    expect(boundaries).toHaveLength(2)
  })

  it("converts reasoning parts to reasoning events", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "reasoning", reasoning: "Let me think..." }],
      },
    ]
    const events = builder.buildEvents(messages)
    const reasoningEvents = events.filter((e) => e.type === "reasoning")
    expect(reasoningEvents).toHaveLength(1)
    expect(reasoningEvents[0]).toMatchObject({ type: "reasoning", content: "Let me think..." })
  })

  it("converts tool parts to tool_call events", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "tool",
            state: {
              name: "pr.view",
              input: { owner: "o", repo: "r" },
              output: { title: "Fix bug" },
            },
          },
        ],
      },
    ]
    const events = builder.buildEvents(messages)
    const toolEvents = events.filter((e) => e.type === "tool_call")
    expect(toolEvents).toHaveLength(1)
    expect(toolEvents[0]).toMatchObject({ type: "tool_call", name: "pr.view", success: true })
  })

  it("marks tool call as failed when state has error", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "tool",
            state: { name: "pr.view", input: {}, error: "Not found" },
          },
        ],
      },
    ]
    const events = builder.buildEvents(messages)
    const toolEvent = events.find((e) => e.type === "tool_call")
    expect(toolEvent).toMatchObject({ type: "tool_call", success: false, error: "Not found" })
  })

  it("converts text parts to text_output events", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "text", text: "I completed the task." }],
      },
    ]
    const events = builder.buildEvents(messages)
    const textEvents = events.filter((e) => e.type === "text_output")
    expect(textEvents).toHaveLength(1)
    expect(textEvents[0]).toMatchObject({ type: "text_output", content: "I completed the task." })
  })

  it("skips step-finish parts", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          { type: "text", text: "Done" },
          { type: "step-finish", reason: "stop" },
        ],
      },
    ]
    const events = builder.buildEvents(messages)
    expect(events.filter((e) => e.type === "text_output")).toHaveLength(1)
    expect(events.some((e) => (e as Record<string, unknown>)["type"] === "step-finish")).toBe(false)
  })

  it("handles split reasoning blocks (consecutive reasoning parts)", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          { type: "reasoning", reasoning: "First part..." },
          { type: "reasoning", reasoning: "Second part..." },
        ],
      },
    ]
    const events = builder.buildEvents(messages)
    const reasoningEvents = events.filter((e) => e.type === "reasoning")
    expect(reasoningEvents).toHaveLength(2)
  })

  it("handles messages without parts", () => {
    const messages = [{ role: "assistant" }]
    expect(() => builder.buildEvents(messages)).not.toThrow()
  })

  it("uses time_created from message for turn_boundary timestamp", () => {
    const messages = [
      {
        role: "assistant",
        time_created: "2026-01-01T00:00:00Z",
        parts: [],
      },
    ]
    const events = builder.buildEvents(messages)
    const boundary = events.find((e) => e.type === "turn_boundary")
    expect(boundary).toMatchObject({ type: "turn_boundary", timestamp: "2026-01-01T00:00:00Z" })
  })

  it("assigns sequential turn numbers", () => {
    const messages = [
      { role: "assistant", parts: [] },
      { role: "assistant", parts: [] },
      { role: "assistant", parts: [] },
    ]
    const events = builder.buildEvents(messages)
    const boundaries = events.filter((e) => e.type === "turn_boundary")
    expect(boundaries[0]).toMatchObject({ type: "turn_boundary", turnNumber: 0 })
    expect(boundaries[1]).toMatchObject({ type: "turn_boundary", turnNumber: 1 })
    expect(boundaries[2]).toMatchObject({ type: "turn_boundary", turnNumber: 2 })
  })

  it("estimates token count for reasoning as ceil(length/4)", () => {
    const content = "1234" // 4 chars → 1 token
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "reasoning", reasoning: content }],
      },
    ]
    const events = builder.buildEvents(messages)
    const reasoningEvent = events.find((e) => e.type === "reasoning")
    expect(reasoningEvent).toMatchObject({ type: "reasoning", tokenCount: 1 })
  })

  it("estimates token count for text_output as ceil(length/4)", () => {
    const content = "12345" // 5 chars → 2 tokens (ceil(5/4))
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "text", text: content }],
      },
    ]
    const events = builder.buildEvents(messages)
    const textEvent = events.find((e) => e.type === "text_output")
    expect(textEvent).toMatchObject({ type: "text_output", tokenCount: 2 })
  })

  it("returns null for unknown part types (no event emitted)", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "unknown-future-type", someData: 42 }],
      },
    ]
    const events = builder.buildEvents(messages)
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe("turn_boundary")
  })

  it("handles tool part with missing state gracefully", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "tool" }], // no state field
      },
    ]
    const events = builder.buildEvents(messages)
    const toolEvents = events.filter((e) => e.type === "tool_call")
    expect(toolEvents).toHaveLength(0)
  })
})

describe("TraceBuilder.groupIntoTurns", () => {
  it("returns empty array for no events", () => {
    expect(builder.groupIntoTurns([])).toEqual([])
  })

  it("groups events between turn boundaries", () => {
    const events = builder.buildEvents([
      {
        role: "assistant",
        time_created: "2026-01-01T00:00:00Z",
        parts: [{ type: "text", text: "Hello" }],
      },
    ])
    const turns = builder.groupIntoTurns(events)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.events).toHaveLength(1)
  })

  it("creates separate turns for separate assistant messages", () => {
    const events = builder.buildEvents([
      {
        role: "assistant",
        time_created: "2026-01-01T00:00:00Z",
        parts: [{ type: "text", text: "First" }],
      },
      {
        role: "assistant",
        time_created: "2026-01-01T00:01:00Z",
        parts: [{ type: "text", text: "Second" }],
      },
    ])
    const turns = builder.groupIntoTurns(events)
    expect(turns).toHaveLength(2)
    expect(turns[0]?.number).toBe(0)
    expect(turns[1]?.number).toBe(1)
  })

  it("preserves turn start timestamp from boundary event", () => {
    const events = builder.buildEvents([
      {
        role: "assistant",
        time_created: "2026-03-15T12:00:00Z",
        parts: [{ type: "text", text: "Hello" }],
      },
    ])
    const turns = builder.groupIntoTurns(events)
    expect(turns[0]?.startTimestamp).toBe("2026-03-15T12:00:00Z")
  })

  it("returns empty array for events with no turn boundaries", () => {
    const turns = builder.groupIntoTurns([
      { type: "text_output", content: "orphan", tokenCount: 1 },
    ])
    expect(turns).toHaveLength(0)
  })

  it("sets durationMs to 0 on each turn", () => {
    const events = builder.buildEvents([
      { role: "assistant", parts: [{ type: "text", text: "Hi" }] },
    ])
    const turns = builder.groupIntoTurns(events)
    expect(turns[0]?.durationMs).toBe(0)
  })
})

describe("TraceBuilder.buildTrace", () => {
  it("returns a SessionTrace with correct sessionId", () => {
    const trace = builder.buildTrace("ses_abc", [])
    expect(trace.sessionId).toBe("ses_abc")
  })

  it("returns empty events and turns for empty messages", () => {
    const trace = builder.buildTrace("ses_empty", [])
    expect(trace.events).toHaveLength(0)
    expect(trace.turns).toHaveLength(0)
  })

  it("summarizes total turns correctly", () => {
    const messages = [
      { role: "assistant", parts: [{ type: "text", text: "First" }] },
      { role: "assistant", parts: [{ type: "text", text: "Second" }] },
    ]
    const trace = builder.buildTrace("ses_turns", messages)
    expect(trace.summary.totalTurns).toBe(2)
  })

  it("summarizes total tool calls correctly", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "tool",
            state: { name: "pr.view", input: {}, output: {} },
          },
          {
            type: "tool",
            state: { name: "issue.list", input: {}, output: {} },
          },
        ],
      },
    ]
    const trace = builder.buildTrace("ses_tools", messages)
    expect(trace.summary.totalToolCalls).toBe(2)
  })

  it("returns zero token breakdown", () => {
    const trace = builder.buildTrace("ses_tok", [])
    expect(trace.summary.totalTokens).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
      active: 0,
    })
  })

  it("returns totalDuration of 0", () => {
    const trace = builder.buildTrace("ses_dur", [])
    expect(trace.summary.totalDuration).toBe(0)
  })

  it("sums token counts from message.tokens", () => {
    const messages = [
      {
        role: "assistant",
        tokens: { input: 100, output: 50, cache_read: 20, cache_write: 10 },
        parts: [],
      },
      {
        role: "assistant",
        tokens: { input: 200, output: 80 },
        parts: [],
      },
    ]
    const trace = builder.buildTrace("ses_tok_sum", messages)
    expect(trace.summary.totalTokens.input).toBe(300)
    expect(trace.summary.totalTokens.output).toBe(130)
    expect(trace.summary.totalTokens.cacheRead).toBe(20)
    expect(trace.summary.totalTokens.cacheWrite).toBe(10)
    expect(trace.summary.totalTokens.total).toBe(460) // 300+130+20+10
    expect(trace.summary.totalTokens.active).toBe(430) // 300+130+0 reasoning
  })

  it("returns non-negative totalDuration for non-empty messages", () => {
    const messages = [
      {
        role: "assistant",
        time_created: "2026-01-01T00:00:00.000Z",
        parts: [{ type: "text", text: "Hello" }],
      },
    ]
    const trace = builder.buildTrace("ses_dur_pos", messages)
    expect(trace.summary.totalDuration).toBeGreaterThanOrEqual(0)
  })
})
