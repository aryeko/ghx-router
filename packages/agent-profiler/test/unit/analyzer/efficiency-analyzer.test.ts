import { efficiencyAnalyzer } from "@profiler/analyzer/efficiency-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("efficiency-analyzer", () => {
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

    const result = await efficiencyAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("efficiency")
    expect(result.findings.total_turns).toEqual({ type: "number", value: 0, unit: "turns" })
    expect(result.findings.productive_turns).toEqual({ type: "number", value: 0, unit: "turns" })
    expect(result.findings.wasted_turns).toEqual({ type: "number", value: 0, unit: "turns" })
    expect(result.findings.turn_efficiency).toEqual({
      type: "ratio",
      value: 0,
      label: "productive / total turns",
    })
    expect(result.findings.information_redundancy).toEqual({
      type: "ratio",
      value: 0,
      label: "duplicate / total tool calls",
    })
    expect(result.findings.backtracking_events).toEqual({
      type: "number",
      value: 0,
      unit: "events",
    })
  })

  it("counts productive and wasted turns correctly", async () => {
    const trace = makeSessionTrace({
      events: [],
      turns: [
        {
          number: 1,
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
          startTimestamp: "2026-01-01T00:00:00Z",
          endTimestamp: "2026-01-01T00:00:01Z",
          durationMs: 1000,
        },
        {
          number: 2,
          events: [{ type: "error", message: "fail", recoverable: true }],
          startTimestamp: "2026-01-01T00:00:01Z",
          endTimestamp: "2026-01-01T00:00:02Z",
          durationMs: 1000,
        },
        {
          number: 3,
          events: [{ type: "text_output", content: "Done", tokenCount: 5 }],
          startTimestamp: "2026-01-01T00:00:02Z",
          endTimestamp: "2026-01-01T00:00:03Z",
          durationMs: 1000,
        },
      ],
      summary: {
        totalTurns: 3,
        totalToolCalls: 1,
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

    const result = await efficiencyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.total_turns).toEqual({ type: "number", value: 3, unit: "turns" })
    expect(result.findings.productive_turns).toEqual({ type: "number", value: 2, unit: "turns" })
    expect(result.findings.wasted_turns).toEqual({ type: "number", value: 1, unit: "turns" })
    expect(result.findings.turn_efficiency).toEqual({
      type: "ratio",
      value: 2 / 3,
      label: "productive / total turns",
    })
  })

  it("computes information redundancy from duplicate tool calls", async () => {
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
      ],
    })

    const result = await efficiencyAnalyzer.analyze(trace, scenario, mode)

    // 3 calls to bash with same input = 2 duplicates out of 4 total
    expect(result.findings.information_redundancy).toEqual({
      type: "ratio",
      value: 2 / 4,
      label: "duplicate / total tool calls",
    })
  })

  it("counts backtracking events (same tool, different input)", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "ls src",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "a.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls test",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "b.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await efficiencyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.backtracking_events).toEqual({
      type: "number",
      value: 2,
      unit: "events",
    })
  })

  it("handles multi-turn trace with mixed productive and wasted turns", async () => {
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
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
      turns: [
        {
          number: 1,
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
          startTimestamp: "2026-01-01T00:00:00Z",
          endTimestamp: "2026-01-01T00:00:01Z",
          durationMs: 1000,
        },
        {
          number: 2,
          events: [{ type: "reasoning", content: "thinking", durationMs: 50, tokenCount: 10 }],
          startTimestamp: "2026-01-01T00:00:01Z",
          endTimestamp: "2026-01-01T00:00:02Z",
          durationMs: 1000,
        },
      ],
      summary: {
        totalTurns: 2,
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
        totalDuration: 2000,
      },
    })

    const result = await efficiencyAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.productive_turns).toEqual({ type: "number", value: 1, unit: "turns" })
    expect(result.findings.wasted_turns).toEqual({ type: "number", value: 1, unit: "turns" })
    expect(result.findings.information_redundancy).toEqual({
      type: "ratio",
      value: 1 / 2,
      label: "duplicate / total tool calls",
    })
  })
})
