import { CostCollector } from "@profiler/collector/cost-collector.js"
import { describe, expect, it } from "vitest"
import { makeBaseScenario, makeCostBreakdown, makePromptResult } from "../../helpers/factories.js"

describe("CostCollector", () => {
  const collector = new CostCollector()

  it("returns 4 cost metrics with correct values", async () => {
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
        cost: makeCostBreakdown({
          totalUsd: 0.05,
          inputUsd: 0.02,
          outputUsd: 0.02,
          reasoningUsd: 0.01,
        }),
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(4)
    expect(metrics).toEqual([
      { name: "cost_total_usd", value: 0.05, unit: "usd" },
      { name: "cost_input_usd", value: 0.02, unit: "usd" },
      { name: "cost_output_usd", value: 0.02, unit: "usd" },
      { name: "cost_reasoning_usd", value: 0.01, unit: "usd" },
    ])
  })

  it("returns zero values when all costs are zero", async () => {
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
        cost: makeCostBreakdown({
          totalUsd: 0,
          inputUsd: 0,
          outputUsd: 0,
          reasoningUsd: 0,
        }),
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(4)
    for (const m of metrics) {
      expect(m.value).toBe(0)
      expect(m.unit).toBe("usd")
    }
  })
})
