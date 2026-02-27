import { strategyAnalyzer } from "@profiler/analyzer/strategy-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("strategy-analyzer", () => {
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

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("strategy")
    expect(result.findings.strategy_summary).toEqual({ type: "string", value: "direct" })
    expect(result.findings.strategy_steps).toEqual({ type: "list", values: [] })
    expect(result.findings.optimality_notes).toEqual({ type: "list", values: [] })
  })

  it("classifies as direct when few tool calls and no backtracking", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "plan", durationMs: 50, tokenCount: 10 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 2,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
          total: 160,
          active: 150,
        },
        totalDuration: 130,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.strategy_summary).toEqual({ type: "string", value: "direct" })
  })

  it("classifies as exploratory when many unique tools", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "tool_call", name: "bash", input: "a", output: "", durationMs: 10, success: true },
        {
          type: "tool_call",
          name: "read_file",
          input: "b",
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "write_file",
          input: "c",
          output: "",
          durationMs: 10,
          success: true,
        },
        { type: "tool_call", name: "grep", input: "d", output: "", durationMs: 10, success: true },
        { type: "tool_call", name: "glob", input: "e", output: "", durationMs: 10, success: true },
        {
          type: "tool_call",
          name: "search",
          input: "f",
          output: "",
          durationMs: 10,
          success: true,
        },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 6,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
          total: 160,
          active: 150,
        },
        totalDuration: 60,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.strategy_summary).toEqual({ type: "string", value: "exploratory" })
  })

  it("classifies as exploratory when reasoning density > 0.3", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "deep thought", durationMs: 100, tokenCount: 80 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 1,
        totalTokens: {
          input: 50,
          output: 30,
          reasoning: 80,
          cacheRead: 0,
          cacheWrite: 0,
          total: 200,
          active: 160,
        },
        totalDuration: 150,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.strategy_summary).toEqual({ type: "string", value: "exploratory" })
  })

  it("classifies as iterative when > 5 tool calls with backtracking", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "ls src",
          output: "ok",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "a.ts",
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls test",
          output: "ok",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "a.ts",
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls test",
          output: "ok",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "a.ts",
          output: "",
          durationMs: 10,
          success: true,
        },
      ],
      summary: {
        totalTurns: 2,
        totalToolCalls: 6,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
          total: 160,
          active: 150,
        },
        totalDuration: 60,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.strategy_summary).toEqual({ type: "string", value: "iterative" })
  })

  it("describes phases correctly", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "think 1", durationMs: 50, tokenCount: 10 },
        { type: "reasoning", content: "think 2", durationMs: 50, tokenCount: 10 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        { type: "reasoning", content: "think 3", durationMs: 50, tokenCount: 10 },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 2,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
          total: 160,
          active: 150,
        },
        totalDuration: 230,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)
    const steps = result.findings.strategy_steps
    expect(steps).toEqual({
      type: "list",
      values: [
        "reasoning phase (2 events)",
        "tool execution phase (2 calls)",
        "reasoning phase (1 events)",
      ],
    })
  })

  it("generates optimality notes for high error rate", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "",
          durationMs: 50,
          success: false,
          error: "fail",
        },
        {
          type: "tool_call",
          name: "bash",
          input: "test2",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "test3",
          output: "",
          durationMs: 50,
          success: false,
          error: "fail",
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "a.ts",
          output: "",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "b.ts",
          output: "",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "c.ts",
          output: "",
          durationMs: 30,
          success: true,
        },
      ],
      summary: {
        totalTurns: 2,
        totalToolCalls: 6,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
          total: 160,
          active: 150,
        },
        totalDuration: 240,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)
    const notes = result.findings.optimality_notes
    expect(notes).toBeDefined()
    expect(notes).toHaveProperty("type", "list")
    const notesList = notes as { type: "list"; values: readonly string[] }
    expect(notesList.values.some((n) => n.includes("High error rate"))).toBe(true)
  })

  it("generates optimality notes for redundant calls and strong reasoning", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "deep analysis", durationMs: 100, tokenCount: 50 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "g.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
      summary: {
        totalTurns: 1,
        totalToolCalls: 6,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 50,
          cacheRead: 0,
          cacheWrite: 0,
          total: 200,
          active: 200,
        },
        totalDuration: 360,
      },
    })

    const result = await strategyAnalyzer.analyze(trace, scenario, mode)
    const notes = result.findings.optimality_notes
    expect(notes).toBeDefined()
    expect(notes).toHaveProperty("type", "list")
    const notesList = notes as { type: "list"; values: readonly string[] }
    expect(notesList.values.some((n) => n.includes("Many redundant calls"))).toBe(true)
    expect(notesList.values.some((n) => n.includes("Strong reasoning foundation"))).toBe(true)
  })
})
