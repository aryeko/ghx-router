import { ToolCallCollector } from "@profiler/collector/tool-call-collector.js"
import { describe, expect, it } from "vitest"
import { makeBaseScenario, makePromptResult, makeToolCallRecord } from "../../helpers/factories.js"

describe("ToolCallCollector", () => {
  const collector = new ToolCallCollector()

  it("returns correct total, failed, error_rate, and unique count", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        timing: { wallMs: 0, segments: [] },
        toolCalls: [
          makeToolCallRecord({ name: "bash", category: "shell", success: true }),
          makeToolCallRecord({ name: "read", category: "file", success: true }),
          makeToolCallRecord({ name: "bash", category: "shell", success: false }),
        ],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toContainEqual({ name: "tool_calls_total", value: 3, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_failed", value: 1, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_error_rate", value: 1 / 3, unit: "ratio" })
    expect(metrics).toContainEqual({ name: "tool_calls_unique", value: 2, unit: "count" })
  })

  it("returns zero values when there are no tool calls", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        timing: { wallMs: 0, segments: [] },
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(4)
    expect(metrics).toContainEqual({ name: "tool_calls_total", value: 0, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_failed", value: 0, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_error_rate", value: 0, unit: "ratio" })
    expect(metrics).toContainEqual({ name: "tool_calls_unique", value: 0, unit: "count" })
  })

  it("returns per-category counts", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        timing: { wallMs: 0, segments: [] },
        toolCalls: [
          makeToolCallRecord({ name: "bash", category: "shell", success: true }),
          makeToolCallRecord({ name: "read", category: "file", success: true }),
          makeToolCallRecord({ name: "write", category: "file", success: true }),
          makeToolCallRecord({ name: "grep", category: "search", success: true }),
        ],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toContainEqual({ name: "tool_calls_category_file", value: 2, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_category_search", value: 1, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_category_shell", value: 1, unit: "count" })
  })

  it("handles mixed success and failure tool calls", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        timing: { wallMs: 0, segments: [] },
        toolCalls: [
          makeToolCallRecord({ name: "bash", category: "shell", success: true }),
          makeToolCallRecord({ name: "bash", category: "shell", success: false }),
          makeToolCallRecord({ name: "read", category: "file", success: false }),
          makeToolCallRecord({ name: "write", category: "file", success: true }),
        ],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toContainEqual({ name: "tool_calls_total", value: 4, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_failed", value: 2, unit: "count" })
    expect(metrics).toContainEqual({ name: "tool_calls_error_rate", value: 0.5, unit: "ratio" })
    expect(metrics).toContainEqual({ name: "tool_calls_unique", value: 3, unit: "count" })
  })
})
