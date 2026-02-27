import { LatencyCollector } from "@profiler/collector/latency-collector.js"
import { describe, expect, it } from "vitest"
import { makeBaseScenario, makePromptResult, makeTimingBreakdown } from "../../helpers/factories.js"

describe("LatencyCollector", () => {
  const collector = new LatencyCollector()

  it("returns wall_ms metric", async () => {
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
        timing: makeTimingBreakdown({ wallMs: 2500 }),
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics[0]).toEqual({ name: "latency_wall_ms", value: 2500, unit: "ms" })
  })

  it("returns per-segment metrics when segments exist", async () => {
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
        timing: makeTimingBreakdown({
          wallMs: 3000,
          segments: [
            { label: "reasoning", startMs: 0, endMs: 1200 },
            { label: "tool_execution", startMs: 1200, endMs: 2800 },
          ],
        }),
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(3)
    expect(metrics[0]).toEqual({ name: "latency_wall_ms", value: 3000, unit: "ms" })
    expect(metrics[1]).toEqual({ name: "latency_reasoning_ms", value: 1200, unit: "ms" })
    expect(metrics[2]).toEqual({ name: "latency_tool_execution_ms", value: 1600, unit: "ms" })
  })

  it("returns only wall_ms when segments are empty", async () => {
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
        timing: makeTimingBreakdown({ wallMs: 500, segments: [] }),
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toEqual({ name: "latency_wall_ms", value: 500, unit: "ms" })
  })
})
