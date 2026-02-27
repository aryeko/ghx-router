import { describe, expect, it, vi } from "vitest"
import type { Analyzer } from "../../src/contracts/analyzer.js"
import type { ProfileSuiteOptions } from "../../src/runner/profile-runner.js"
import { runProfileSuite } from "../../src/runner/profile-runner.js"
import { makeScenario } from "../helpers/factories.js"
import { createMockModeResolver } from "../helpers/mock-mode-resolver.js"
import { createMockProvider } from "../helpers/mock-provider.js"
import { createMockScorer } from "../helpers/mock-scorer.js"

vi.mock("@profiler/store/jsonl-store.js", () => ({
  appendJsonlLine: vi.fn().mockResolvedValue(undefined),
}))

function makeOptions(overrides?: Partial<ProfileSuiteOptions>): ProfileSuiteOptions {
  return {
    modes: ["mode_a", "mode_b"],
    scenarios: [makeScenario({ id: "s1" }), makeScenario({ id: "s2" })],
    repetitions: 2,
    provider: createMockProvider(),
    scorer: createMockScorer(),
    modeResolver: createMockModeResolver({
      mode_a: { providerOverrides: { model: "model-a" } },
      mode_b: { providerOverrides: { model: "model-b" } },
    }),
    collectors: [],
    analyzers: [],
    hooks: {},
    warmup: true,
    sessionExport: false,
    outputJsonlPath: "/tmp/integration-test.jsonl",
    logLevel: "error",
    ...overrides,
  }
}

describe("profile-runner integration", () => {
  it("runs full pipeline: 2 modes x 2 scenarios x 2 reps = 8 rows", async () => {
    const options = makeOptions()

    const result = await runProfileSuite(options)

    expect(result.rows).toHaveLength(8)
    expect(result.runId).toMatch(/^run_\d+$/)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.outputJsonlPath).toBe("/tmp/integration-test.jsonl")
    expect(result.analysisResults).toBeDefined()
    expect(result.analysisResults).toHaveLength(0) // no analyzers in default makeOptions
  })

  it("populates every row with correct structure", async () => {
    const options = makeOptions()

    const result = await runProfileSuite(options)

    for (const row of result.rows) {
      expect(row.runId).toBe(result.runId)
      expect(row.success).toBe(true)
      expect(row.checkpointsTotal).toBeGreaterThan(0)
      expect(row.checkpointsPassed).toBeGreaterThan(0)
      expect(row.tokens).toBeDefined()
      expect(row.toolCalls).toBeDefined()
      expect(row.completionReason).toBe("stop")
      expect(row.provider).toBe("mock-provider")
    }
  })

  it("distributes rows correctly across modes and scenarios", async () => {
    const options = makeOptions()

    const result = await runProfileSuite(options)

    const modeARows = result.rows.filter((r) => r.mode === "mode_a")
    const modeBRows = result.rows.filter((r) => r.mode === "mode_b")
    expect(modeARows).toHaveLength(4) // 2 scenarios x 2 reps
    expect(modeBRows).toHaveLength(4)

    const s1Rows = result.rows.filter((r) => r.scenarioId === "s1")
    const s2Rows = result.rows.filter((r) => r.scenarioId === "s2")
    expect(s1Rows).toHaveLength(4) // 2 modes x 2 reps
    expect(s2Rows).toHaveLength(4)
  })

  it("assigns correct model per mode from mode resolver", async () => {
    const options = makeOptions()

    const result = await runProfileSuite(options)

    const modeARows = result.rows.filter((r) => r.mode === "mode_a")
    const modeBRows = result.rows.filter((r) => r.mode === "mode_b")

    for (const row of modeARows) {
      expect(row.model).toBe("model-a")
    }
    for (const row of modeBRows) {
      expect(row.model).toBe("model-b")
    }
  })

  it("calls appendJsonlLine for each row", async () => {
    const { appendJsonlLine } = await import("@profiler/store/jsonl-store.js")
    vi.mocked(appendJsonlLine).mockClear()

    const options = makeOptions()

    await runProfileSuite(options)

    expect(appendJsonlLine).toHaveBeenCalledTimes(8)
  })

  it("runs warmup iteration and discards it from results", async () => {
    const provider = createMockProvider()
    const options = makeOptions({ provider, warmup: true })

    const result = await runProfileSuite(options)

    // warmup (1) + 8 iterations = 9 createSession calls
    expect(provider.calls.createSession?.length ?? 0).toBe(9)
    // but only 8 rows in results (warmup discarded)
    expect(result.rows).toHaveLength(8)
  })

  it("calls hooks in correct lifecycle order", async () => {
    const order: string[] = []
    const hooks = {
      beforeRun: vi.fn(async () => {
        order.push("beforeRun")
      }),
      afterRun: vi.fn(async () => {
        order.push("afterRun")
      }),
      beforeMode: vi.fn(async (mode: string) => {
        order.push(`beforeMode:${mode}`)
      }),
      afterMode: vi.fn(async (mode: string) => {
        order.push(`afterMode:${mode}`)
      }),
      beforeScenario: vi.fn(async () => {
        order.push("beforeScenario")
      }),
      afterScenario: vi.fn(async () => {
        order.push("afterScenario")
      }),
    }

    const options = makeOptions({
      modes: ["mode_a"],
      scenarios: [makeScenario({ id: "s1" })],
      repetitions: 1,
      hooks,
    })

    await runProfileSuite(options)

    expect(order).toEqual([
      "beforeRun",
      "beforeMode:mode_a",
      "beforeScenario",
      "afterScenario",
      "afterMode:mode_a",
      "afterRun",
    ])
  })

  it("calls provider.shutdown after all iterations", async () => {
    const provider = createMockProvider()
    const options = makeOptions({ provider })

    await runProfileSuite(options)

    expect(provider.calls.shutdown?.length ?? 0).toBe(1)
  })

  it("calls analyzers and returns analysis bundles", async () => {
    const mockAnalyzer: Analyzer = {
      name: "test-analyzer",
      async analyze(_trace, _scenario, _mode) {
        return {
          analyzer: "test-analyzer",
          findings: { score: { type: "number", value: 1, unit: "pts" } },
          summary: "all good",
        }
      },
    }
    const options = makeOptions({
      analyzers: [mockAnalyzer],
      sessionExport: true,
      modes: ["mode_a"],
      scenarios: [makeScenario({ id: "s1" })],
      repetitions: 1,
      warmup: false,
    })
    const result = await runProfileSuite(options)
    expect(result.analysisResults).toHaveLength(1)
    expect(result.analysisResults[0]?.mode).toBe("mode_a")
    expect(result.analysisResults[0]?.results["test-analyzer"]).toBeDefined()
  })

  it("handles provider errors gracefully (failed rows persisted, not skipped)", async () => {
    let callCount = 0
    const provider = createMockProvider()
    const originalPrompt = provider.prompt.bind(provider)
    provider.prompt = async (handle, text, timeoutMs) => {
      callCount++
      if (callCount === 3) {
        throw new Error("provider timeout on iteration 3")
      }
      return originalPrompt(handle, text, timeoutMs)
    }

    const options = makeOptions({
      provider,
      modes: ["mode_a"],
      scenarios: [makeScenario({ id: "s1" })],
      repetitions: 3,
      warmup: false,
    })

    const result = await runProfileSuite(options)

    // All 3 rows present (failed row not skipped)
    expect(result.rows).toHaveLength(3)

    const failedRows = result.rows.filter((r) => !r.success)
    expect(failedRows).toHaveLength(1)
    expect(failedRows[0]?.error).toBe("provider timeout on iteration 3")

    const successRows = result.rows.filter((r) => r.success)
    expect(successRows).toHaveLength(2)
  })
})
