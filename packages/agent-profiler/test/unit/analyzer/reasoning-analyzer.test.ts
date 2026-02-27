import { reasoningAnalyzer } from "@profiler/analyzer/reasoning-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("reasoning-analyzer", () => {
  it("handles empty trace without errors", async () => {
    const trace = makeSessionTrace({
      events: [],
      turns: [],
      summary: {
        totalTurns: 0,
        totalToolCalls: 0,
        totalTokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        totalDuration: 0,
      },
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("reasoning")
    expect(result.findings.reasoning_density).toEqual({
      type: "ratio",
      value: 0,
      label: "reasoning tokens / total tokens",
    })
    expect(result.findings.reasoning_per_tool_call).toEqual({
      type: "number",
      value: 0,
      unit: "tokens/tool_call",
    })
    expect(result.findings.planning_quality).toEqual({
      type: "string",
      value: "mixed",
    })
    expect(result.findings.key_decisions).toEqual({
      type: "list",
      values: [],
    })
    expect(result.findings.confusion_signals).toEqual({
      type: "list",
      values: [],
    })
  })

  it("computes reasoning density and per-tool-call correctly", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "reasoning",
          content: "Let me think about this problem",
          durationMs: 100,
          tokenCount: 50,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "file.ts",
          durationMs: 200,
          success: true,
        },
        {
          type: "reasoning",
          content: "Now I need to check the file",
          durationMs: 80,
          tokenCount: 30,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "file.ts",
          output: "code",
          durationMs: 50,
          success: true,
        },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 2,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 40,
          cacheRead: 0,
          cacheWrite: 0,
          total: 200,
          active: 190,
        },
        totalDuration: 430,
      },
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.reasoning_density).toEqual({
      type: "ratio",
      value: 0.2,
      label: "reasoning tokens / total tokens",
    })
    expect(result.findings.reasoning_per_tool_call).toEqual({
      type: "number",
      value: 20,
      unit: "tokens/tool_call",
    })
  })

  it("detects proactive planning quality when reasoning is first", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "Planning my approach", durationMs: 100, tokenCount: 20 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.planning_quality).toEqual({
      type: "string",
      value: "proactive",
    })
  })

  it("detects reactive planning quality when tool_call is first", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        { type: "reasoning", content: "Let me think", durationMs: 100, tokenCount: 20 },
      ],
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.planning_quality).toEqual({
      type: "string",
      value: "reactive",
    })
  })

  it("detects mixed planning quality for non-reasoning/non-tool first event", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "text_output", content: "Hello", tokenCount: 5 },
        { type: "reasoning", content: "Thinking", durationMs: 50, tokenCount: 10 },
      ],
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.planning_quality).toEqual({
      type: "string",
      value: "mixed",
    })
  })

  it("extracts key decisions (first 50 chars) and confusion signals", async () => {
    const longContent = "A".repeat(100)
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: longContent, durationMs: 50, tokenCount: 20 },
        {
          type: "reasoning",
          content: "I'm not sure what to do here",
          durationMs: 50,
          tokenCount: 15,
        },
        { type: "reasoning", content: "This is confused logic", durationMs: 50, tokenCount: 10 },
        { type: "reasoning", content: "Let me retry the approach", durationMs: 50, tokenCount: 10 },
        { type: "reasoning", content: "Clear plan now", durationMs: 50, tokenCount: 10 },
      ],
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    const keyDecisions = result.findings.key_decisions
    expect(keyDecisions).toEqual({
      type: "list",
      values: [
        "A".repeat(50),
        "I'm not sure what to do here",
        "This is confused logic",
        "Let me retry the approach",
        "Clear plan now",
      ],
    })

    const confusionSignals = result.findings.confusion_signals
    expect(confusionSignals).toEqual({
      type: "list",
      values: [
        "I'm not sure what to do here",
        "This is confused logic",
        "Let me retry the approach",
      ],
    })
  })

  it("handles multi-turn trace with mixed events", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "turn_boundary", turnNumber: 1, timestamp: "2026-01-01T00:00:00Z" },
        { type: "reasoning", content: "Planning step 1", durationMs: 100, tokenCount: 30 },
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        { type: "turn_boundary", turnNumber: 2, timestamp: "2026-01-01T00:01:00Z" },
        {
          type: "reasoning",
          content: "I don't understand the error",
          durationMs: 80,
          tokenCount: 25,
        },
        { type: "error", message: "Something failed", recoverable: true },
        { type: "turn_boundary", turnNumber: 3, timestamp: "2026-01-01T00:02:00Z" },
        {
          type: "reasoning",
          content: "Let me try a wrong approach",
          durationMs: 60,
          tokenCount: 20,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "file.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
      summary: {
        totalTurns: 3,
        totalToolCalls: 2,
        totalTokens: {
          input: 200,
          output: 100,
          reasoning: 75,
          cacheRead: 0,
          cacheWrite: 0,
          total: 400,
          active: 375,
        },
        totalDuration: 2000,
      },
    })

    const result = await reasoningAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.reasoning_density).toEqual({
      type: "ratio",
      value: 75 / 400,
      label: "reasoning tokens / total tokens",
    })
    expect(result.findings.reasoning_per_tool_call).toEqual({
      type: "number",
      value: 75 / 2,
      unit: "tokens/tool_call",
    })
    expect(result.findings.planning_quality).toEqual({
      type: "string",
      value: "mixed",
    })

    const confusion = result.findings.confusion_signals
    expect(confusion).toBeDefined()
    expect(confusion).toHaveProperty("type", "list")
    const confList = confusion as { type: "list"; values: readonly string[] }
    expect(confList.values).toHaveLength(2)
  })
})
