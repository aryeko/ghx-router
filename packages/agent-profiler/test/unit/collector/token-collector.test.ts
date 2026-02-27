import { TokenCollector } from "@profiler/collector/token-collector.js"
import { describe, expect, it } from "vitest"
import { makeBaseScenario, makePromptResult, makeTokenBreakdown } from "../../helpers/factories.js"

describe("TokenCollector", () => {
  const collector = new TokenCollector()

  it("returns 7 metrics with correct names and values", async () => {
    const result = makePromptResult()
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(7)
    expect(metrics).toEqual([
      { name: "tokens_input", value: 100, unit: "tokens" },
      { name: "tokens_output", value: 50, unit: "tokens" },
      { name: "tokens_reasoning", value: 20, unit: "tokens" },
      { name: "tokens_cache_read", value: 10, unit: "tokens" },
      { name: "tokens_cache_write", value: 5, unit: "tokens" },
      { name: "tokens_total", value: 150, unit: "tokens" },
      { name: "tokens_active", value: 140, unit: "tokens" },
    ])
  })

  it("returns zero values when all tokens are zero", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: makeTokenBreakdown({
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        }),
        timing: { wallMs: 0, segments: [] },
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics).toHaveLength(7)
    for (const m of metrics) {
      expect(m.value).toBe(0)
      expect(m.unit).toBe("tokens")
    }
  })

  it("extracts custom token values correctly", async () => {
    const result = makePromptResult({
      metrics: {
        tokens: makeTokenBreakdown({
          input: 500,
          output: 200,
          reasoning: 80,
          cacheRead: 30,
          cacheWrite: 15,
          total: 700,
          active: 680,
        }),
        timing: { wallMs: 0, segments: [] },
        toolCalls: [],
        cost: { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 },
      },
    })
    const metrics = await collector.collect(result, makeBaseScenario(), "test", null)

    expect(metrics[0]).toEqual({ name: "tokens_input", value: 500, unit: "tokens" })
    expect(metrics[1]).toEqual({ name: "tokens_output", value: 200, unit: "tokens" })
    expect(metrics[2]).toEqual({ name: "tokens_reasoning", value: 80, unit: "tokens" })
    expect(metrics[3]).toEqual({ name: "tokens_cache_read", value: 30, unit: "tokens" })
    expect(metrics[4]).toEqual({ name: "tokens_cache_write", value: 15, unit: "tokens" })
    expect(metrics[5]).toEqual({ name: "tokens_total", value: 700, unit: "tokens" })
    expect(metrics[6]).toEqual({ name: "tokens_active", value: 680, unit: "tokens" })
  })
})
