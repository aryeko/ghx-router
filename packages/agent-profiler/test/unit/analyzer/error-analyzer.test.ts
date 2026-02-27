import { errorAnalyzer } from "@profiler/analyzer/error-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("error-analyzer", () => {
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

    const result = await errorAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("error")
    expect(result.findings.errors_encountered).toEqual({
      type: "number",
      value: 0,
      unit: "errors",
    })
    expect(result.findings.error_types).toEqual({
      type: "table",
      headers: ["type", "count"],
      rows: [],
    })
    expect(result.findings.recovery_patterns).toEqual({
      type: "table",
      headers: ["pattern", "count"],
      rows: [],
    })
    expect(result.findings.error_cascades).toEqual({
      type: "number",
      value: 0,
      unit: "cascades",
    })
    expect(result.findings.wasted_turns_from_errors).toEqual({
      type: "number",
      value: 0,
      unit: "turns",
    })
  })

  it("counts error events and failed tool calls", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "error", message: "auth token expired", recoverable: true },
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
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
    })

    const result = await errorAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.errors_encountered).toEqual({
      type: "number",
      value: 2,
      unit: "errors",
    })
  })

  it("classifies error types correctly", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "error", message: "auth token expired", recoverable: true },
        { type: "error", message: "permission denied", recoverable: false },
        { type: "error", message: "file not found", recoverable: true },
        { type: "error", message: "404 page", recoverable: true },
        { type: "error", message: "request timeout", recoverable: true },
        { type: "error", message: "JSON parse failed", recoverable: false },
        { type: "error", message: "syntax error in input", recoverable: false },
        { type: "error", message: "something weird happened", recoverable: false },
      ],
    })

    const result = await errorAnalyzer.analyze(trace, scenario, mode)
    const errorTypes = result.findings.error_types
    expect(errorTypes).toBeDefined()
    expect(errorTypes).toHaveProperty("type", "table")
    const etTable = errorTypes as { type: "table"; rows: readonly (readonly string[])[] }
    const rowMap = new Map(etTable.rows.map((r) => [r[0], r[1]]))
    expect(rowMap.get("auth")).toBe("2")
    expect(rowMap.get("not_found")).toBe("2")
    expect(rowMap.get("timeout")).toBe("1")
    expect(rowMap.get("parse_error")).toBe("2")
    expect(rowMap.get("unknown")).toBe("1")
  })

  it("detects recovery patterns: retry, alternative, tool_followup, give_up", async () => {
    const trace = makeSessionTrace({
      events: [
        // retry: failed bash → bash again
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
        // alternative: failed tool_call → different tool_call
        {
          type: "tool_call",
          name: "bash",
          input: "rm -rf",
          output: "",
          durationMs: 50,
          success: false,
          error: "permission denied",
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        // tool_followup: error (non-tool_call) → tool_call
        { type: "error", message: "something broke", recoverable: true },
        {
          type: "tool_call",
          name: "read_file",
          input: "g.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        // give_up: error with no next event
        { type: "error", message: "final error", recoverable: false },
      ],
    })

    const result = await errorAnalyzer.analyze(trace, scenario, mode)
    const recovery = result.findings.recovery_patterns
    expect(recovery).toBeDefined()
    expect(recovery).toHaveProperty("type", "table")
    const recTable = recovery as { type: "table"; rows: readonly (readonly string[])[] }
    const recMap = new Map(recTable.rows.map((r) => [r[0], r[1]]))
    expect(recMap.get("retry")).toBe("1")
    expect(recMap.get("alternative")).toBe("1")
    expect(recMap.get("tool_followup")).toBe("1")
    expect(recMap.get("give_up")).toBe("1")
  })

  it("counts error cascades (2+ consecutive errors)", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "error", message: "error 1", recoverable: true },
        { type: "error", message: "error 2", recoverable: true },
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
          input: "test",
          output: "",
          durationMs: 50,
          success: false,
          error: "fail",
        },
        { type: "error", message: "error 3", recoverable: false },
        { type: "error", message: "error 4", recoverable: false },
      ],
    })

    const result = await errorAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.error_cascades).toEqual({
      type: "number",
      value: 2,
      unit: "cascades",
    })
  })

  it("counts wasted turns (turns with only errors/failed tool calls)", async () => {
    const trace = makeSessionTrace({
      events: [],
      turns: [
        {
          number: 1,
          events: [
            { type: "error", message: "fail", recoverable: true },
            {
              type: "tool_call",
              name: "bash",
              input: "test",
              output: "",
              durationMs: 50,
              success: false,
              error: "exit 1",
            },
          ],
          startTimestamp: "2026-01-01T00:00:00Z",
          endTimestamp: "2026-01-01T00:00:01Z",
          durationMs: 1000,
        },
        {
          number: 2,
          events: [
            {
              type: "tool_call",
              name: "bash",
              input: "ls",
              output: "ok",
              durationMs: 50,
              success: true,
            },
          ],
          startTimestamp: "2026-01-01T00:00:01Z",
          endTimestamp: "2026-01-01T00:00:02Z",
          durationMs: 1000,
        },
        {
          number: 3,
          events: [{ type: "error", message: "another fail", recoverable: false }],
          startTimestamp: "2026-01-01T00:00:02Z",
          endTimestamp: "2026-01-01T00:00:03Z",
          durationMs: 1000,
        },
      ],
      summary: {
        totalTurns: 3,
        totalToolCalls: 2,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 20,
          cacheRead: 0,
          cacheWrite: 0,
          total: 170,
          active: 150,
        },
        totalDuration: 3000,
      },
    })

    const result = await errorAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.wasted_turns_from_errors).toEqual({
      type: "number",
      value: 2,
      unit: "turns",
    })
  })
})
