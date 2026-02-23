import type { SessionMessageEntry } from "@bench/domain/types.js"
import { extractTimingBreakdown } from "@bench/provider/opencode/extraction-timing.js"
import { describe, expect, it } from "vitest"

function makeAssistantMessage(
  overrides: Record<string, unknown> = {},
  parts: unknown[] = [],
): SessionMessageEntry {
  return {
    info: {
      role: "assistant",
      time: { created: 1000, completed: 2000 },
      ...overrides,
    },
    parts: parts as SessionMessageEntry["parts"],
  } as unknown as SessionMessageEntry
}

describe("extractTimingBreakdown", () => {
  it("skips non-assistant messages", () => {
    const messages = [
      {
        info: { role: "user" },
        parts: [],
      },
    ] as unknown as SessionMessageEntry[]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_total_ms).toBe(0)
    expect(result.observed_assistant_turns).toBe(0)
  })

  it("calculates assistant_total_ms from time.created/time.completed", () => {
    const messages = [makeAssistantMessage({ time: { created: 1000, completed: 3000 } })]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_total_ms).toBe(2000)
    expect(result.observed_assistant_turns).toBe(1)
  })

  it("calculates assistant_reasoning_ms from reasoning part time.start/end", () => {
    const parts = [{ type: "reasoning", time: { start: 1100, end: 1600 } }]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_reasoning_ms).toBe(500)
  })

  it("tracks firstReasoningStart and lastReasoningEnd across multiple reasoning parts", () => {
    const parts = [
      { type: "reasoning", time: { start: 1100, end: 1300 } },
      { type: "reasoning", time: { start: 1400, end: 1700 } },
    ]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_reasoning_ms).toBe(200 + 300)
    // pre_reasoning: created(1000) -> firstReasoningStart(1100) = 100
    expect(result.assistant_pre_reasoning_ms).toBe(100)
  })

  it("calculates tool_total_ms from tool parts via state.time.start/end", () => {
    const parts = [{ type: "tool", tool: "some-tool", state: { time: { start: 1500, end: 1800 } } }]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.tool_total_ms).toBe(300)
  })

  it("accumulates tool_bash_ms for bash tools", () => {
    const parts = [{ type: "tool", tool: "bash", state: { time: { start: 1500, end: 1800 } } }]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.tool_bash_ms).toBe(300)
  })

  it("accumulates tool_structured_output_ms for StructuredOutput tools", () => {
    const parts = [
      { type: "tool", tool: "StructuredOutput", state: { time: { start: 1500, end: 1900 } } },
    ]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.tool_structured_output_ms).toBe(400)
  })

  it("calculates assistant_pre_reasoning_ms (created → firstReasoningStart)", () => {
    const parts = [{ type: "reasoning", time: { start: 1200, end: 1500 } }]
    const messages = [makeAssistantMessage({ time: { created: 1000, completed: 2000 } }, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_pre_reasoning_ms).toBe(200)
  })

  it("calculates assistant_between_reasoning_and_tool_ms (lastReasoningEnd → firstToolStart)", () => {
    const parts = [
      { type: "reasoning", time: { start: 1100, end: 1400 } },
      { type: "tool", tool: "bash", state: { time: { start: 1600, end: 1800 } } },
    ]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_between_reasoning_and_tool_ms).toBe(200) // 1600 - 1400
  })

  it("calculates assistant_post_tool_ms (lastToolEnd → completed)", () => {
    const parts = [{ type: "tool", tool: "bash", state: { time: { start: 1500, end: 1700 } } }]
    const messages = [makeAssistantMessage({ time: { created: 1000, completed: 2000 } }, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_post_tool_ms).toBe(300) // 2000 - 1700
  })

  it("handles missing part.time gracefully (skips)", () => {
    const parts = [{ type: "reasoning" }, { type: "tool", tool: "bash" }]
    const messages = [makeAssistantMessage({}, parts)]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_reasoning_ms).toBe(0)
    expect(result.tool_total_ms).toBe(0)
  })

  it("accumulates correctly across multiple assistant messages", () => {
    const messages = [
      makeAssistantMessage({ time: { created: 1000, completed: 2000 } }),
      makeAssistantMessage({ time: { created: 3000, completed: 4500 } }),
    ]
    const result = extractTimingBreakdown(messages)
    expect(result.assistant_total_ms).toBe(1000 + 1500)
    expect(result.observed_assistant_turns).toBe(2)
  })
})
