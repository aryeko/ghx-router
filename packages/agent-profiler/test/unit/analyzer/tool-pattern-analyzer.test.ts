import { toolPatternAnalyzer } from "@profiler/analyzer/tool-pattern-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("tool-pattern-analyzer", () => {
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

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("tool-pattern")
    expect(result.findings.tool_sequence).toEqual({ type: "list", values: [] })
    expect(result.findings.unique_tools_used).toEqual({ type: "number", value: 0, unit: "tools" })
    expect(result.findings.tool_call_patterns).toEqual({
      type: "table",
      headers: ["pattern", "count"],
      rows: [],
    })
    expect(result.findings.redundant_calls).toEqual({
      type: "table",
      headers: ["tool", "input_hash", "count"],
      rows: [],
    })
    expect(result.findings.failed_then_retried).toEqual({
      type: "table",
      headers: ["tool", "occurrences"],
      rows: [],
    })
  })

  it("computes tool sequence and unique tools", async () => {
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
          name: "bash",
          input: "test",
          output: "pass",
          durationMs: 100,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["bash", "read_file", "bash"],
    })
    expect(result.findings.unique_tools_used).toEqual({
      type: "number",
      value: 2,
      unit: "tools",
    })
  })

  it("computes bigram patterns", async () => {
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
        { type: "tool_call", name: "bash", input: "c", output: "", durationMs: 10, success: true },
        {
          type: "tool_call",
          name: "read_file",
          input: "d",
          output: "",
          durationMs: 10,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const patterns = result.findings.tool_call_patterns
    expect(patterns).toBeDefined()
    expect(patterns).toHaveProperty("type", "table")
    const pTable = patterns as { type: "table"; rows: readonly (readonly string[])[] }
    expect(pTable.rows).toContainEqual(["bash -> read_file", "2"])
    expect(pTable.rows).toContainEqual(["read_file -> bash", "1"])
  })

  it("detects redundant calls (same tool + same input)", async () => {
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
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const redundant = result.findings.redundant_calls
    expect(redundant).toBeDefined()
    expect(redundant).toHaveProperty("type", "table")
    const rTable = redundant as { type: "table"; rows: readonly (readonly string[])[] }
    expect(rTable.rows).toHaveLength(1)
    const rRow = rTable.rows[0] as readonly string[]
    expect(rRow[0]).toBe("bash")
    expect(rRow[2]).toBe("3")
  })

  it("detects failed-then-retried patterns", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "",
          durationMs: 50,
          success: false,
          error: "exit 1",
        },
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "pass",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "",
          durationMs: 30,
          success: false,
          error: "not found",
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
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const retried = result.findings.failed_then_retried
    expect(retried).toBeDefined()
    expect(retried).toHaveProperty("type", "table")
    const rtTable = retried as { type: "table"; rows: readonly (readonly string[])[] }
    expect(rtTable.rows).toContainEqual(["bash", "1"])
    expect(rtTable.rows).toContainEqual(["read_file", "1"])
  })

  it("handles multi-turn trace with mixed event types", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "thinking", durationMs: 50, tokenCount: 10 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        { type: "turn_boundary", turnNumber: 2, timestamp: "2026-01-01T00:01:00Z" },
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
          name: "write_file",
          input: "f.ts",
          output: "ok",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["bash", "bash", "write_file"],
    })
    expect(result.findings.unique_tools_used).toEqual({
      type: "number",
      value: 2,
      unit: "tools",
    })
  })
})
