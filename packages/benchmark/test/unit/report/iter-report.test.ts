import type { BenchmarkRow } from "@bench/domain/types.js"
import type { IterData } from "@bench/report/iter-reader.js"
import type { IterReport } from "@bench/report/iter-report.js"
import {
  buildIterReport,
  formatIterReport,
  toMetrics,
  toResultsMetrics,
} from "@bench/report/iter-report.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const readRunDirMock = vi.hoisted(() => vi.fn())
const loadResultsMapMock = vi.hoisted(() => vi.fn())
vi.mock("@bench/report/iter-reader.js", () => ({ readRunDir: readRunDirMock }))
vi.mock("@bench/report/results-reader.js", () => ({ loadResultsMap: loadResultsMapMock }))

function makeIterData(overrides: Partial<IterData> = {}): IterData {
  return {
    iterDir: "/run/iter-1",
    mode: "ghx",
    scenarioId: "test-001",
    iteration: 1,
    session: {
      toolCallCount: 3,
      toolCallCommands: ["gh issue list", "gh pr view", ""],
      assistantTurns: 2,
      reasoningBlocks: 1,
      tokens: { input: 100, output: 50, reasoning: 20, cache_read: 5, cache_write: 5, total: 180 },
    },
    ghxLogs: {
      capabilities: [{ capability_id: "issues.list", route: "graphql", ok: true }],
      errorCount: 0,
    },
    ...overrides,
  }
}

function makeBenchmarkRow(overrides: Record<string, unknown> = {}): BenchmarkRow {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    run_id: "run-001",
    scenario_id: "sc-001",
    scenario_set: null,
    iteration: 1,
    mode: "ghx",
    session_id: null,
    success: true,
    output_valid: true,
    cost: 0.0123,
    latency_ms_wall: 5000,
    latency_ms_agent: 4500,
    sdk_latency_ms: null,
    tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 0 },
    tool_calls: 0,
    api_calls: 0,
    internal_retry_count: 0,
    external_retry_count: 0,
    model: { provider_id: "anthropic", model_id: "claude-sonnet-4-6", mode: null },
    git: { repo: null, commit: null },
    error: null,
    ...overrides,
  } as BenchmarkRow
}

describe("toMetrics", () => {
  it("returns correct metrics when session has all data", () => {
    const iter = makeIterData()
    const metrics = toMetrics(iter)

    expect(metrics.toolCallCount).toBe(3)
    expect(metrics.totalTokens).toBe(180)
    expect(metrics.reasoningBlocks).toBe(1)
    expect(metrics.bashCommandCount).toBe(2)
  })

  it("returns zero/null values when session is null", () => {
    const iter = makeIterData({ session: null })
    const metrics = toMetrics(iter)

    expect(metrics.toolCallCount).toBe(0)
    expect(metrics.totalTokens).toBeNull()
    expect(metrics.reasoningBlocks).toBe(0)
    expect(metrics.bashCommandCount).toBe(0)
  })

  it("bashCommandCount counts only non-empty commands", () => {
    const iter = makeIterData({
      session: {
        toolCallCount: 5,
        toolCallCommands: ["gh issue list", "", "gh pr view", "", "gh repo view"],
        assistantTurns: 2,
        reasoningBlocks: 0,
        tokens: null,
      },
    })
    const metrics = toMetrics(iter)

    expect(metrics.bashCommandCount).toBe(3)
  })

  it("returns null totalTokens when tokens is null in session", () => {
    const iter = makeIterData({
      session: {
        toolCallCount: 1,
        toolCallCommands: ["gh issue list"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: null,
      },
    })
    const metrics = toMetrics(iter)

    expect(metrics.totalTokens).toBeNull()
  })

  it("returns zero bashCommandCount when all commands are empty strings", () => {
    const iter = makeIterData({
      session: {
        toolCallCount: 2,
        toolCallCommands: ["", ""],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: null,
      },
    })
    const metrics = toMetrics(iter)

    expect(metrics.bashCommandCount).toBe(0)
  })
})

describe("toResultsMetrics", () => {
  it("maps all fields from BenchmarkRow correctly", () => {
    const row = makeBenchmarkRow({
      success: true,
      output_valid: false,
      cost: 0.0456,
      latency_ms_wall: 7000,
      internal_retry_count: 2,
      external_retry_count: 1,
      error: { type: "timeout", message: "timed out after 60s" },
    })

    const metrics = toResultsMetrics(row)

    expect(metrics.success).toBe(true)
    expect(metrics.outputValid).toBe(false)
    expect(metrics.cost).toBe(0.0456)
    expect(metrics.latencyMsWall).toBe(7000)
    expect(metrics.internalRetryCount).toBe(2)
    expect(metrics.externalRetryCount).toBe(1)
    expect(metrics.error).toEqual({ type: "timeout", message: "timed out after 60s" })
  })

  it("preserves null error", () => {
    const row = makeBenchmarkRow({ error: null })
    const metrics = toResultsMetrics(row)

    expect(metrics.error).toBeNull()
  })
})

describe("buildIterReport", () => {
  beforeEach(() => {
    loadResultsMapMock.mockResolvedValue(new Map())
  })

  it("returns correct pairs when both dirs have matching iterations", async () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const adIter = makeIterData({ mode: "agent_direct", scenarioId: "sc-001", iteration: 1 })

    readRunDirMock.mockResolvedValueOnce([ghxIter]).mockResolvedValueOnce([adIter])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.pairs).toHaveLength(1)
    const pair = report.pairs[0]
    expect(pair?.scenarioId).toBe("sc-001")
    expect(pair?.iteration).toBe(1)
    expect(pair?.ghx).toEqual(ghxIter)
    expect(pair?.agentDirect).toEqual(adIter)
    expect(pair?.ghxMetrics).not.toBeNull()
    expect(pair?.adMetrics).not.toBeNull()
  })

  it("handles missing ghx side (null ghx)", async () => {
    const adIter = makeIterData({ mode: "agent_direct", scenarioId: "sc-002", iteration: 1 })

    readRunDirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([adIter])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.pairs).toHaveLength(1)
    const pair = report.pairs[0]
    expect(pair?.ghx).toBeNull()
    expect(pair?.ghxMetrics).toBeNull()
    expect(pair?.agentDirect).toEqual(adIter)
    expect(pair?.adMetrics).not.toBeNull()
  })

  it("handles missing ad side (null agentDirect)", async () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-003", iteration: 2 })

    readRunDirMock.mockResolvedValueOnce([ghxIter]).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.pairs).toHaveLength(1)
    const pair = report.pairs[0]
    expect(pair?.ghx).toEqual(ghxIter)
    expect(pair?.ghxMetrics).not.toBeNull()
    expect(pair?.agentDirect).toBeNull()
    expect(pair?.adMetrics).toBeNull()
  })

  it("pairs are sorted by scenarioId then iteration", async () => {
    const items: IterData[] = [
      makeIterData({ mode: "ghx", scenarioId: "sc-b", iteration: 2 }),
      makeIterData({ mode: "ghx", scenarioId: "sc-a", iteration: 2 }),
      makeIterData({ mode: "ghx", scenarioId: "sc-a", iteration: 1 }),
    ]

    readRunDirMock.mockResolvedValueOnce(items).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.pairs[0]?.scenarioId).toBe("sc-a")
    expect(report.pairs[0]?.iteration).toBe(1)
    expect(report.pairs[1]?.scenarioId).toBe("sc-a")
    expect(report.pairs[1]?.iteration).toBe(2)
    expect(report.pairs[2]?.scenarioId).toBe("sc-b")
    expect(report.pairs[2]?.iteration).toBe(2)
  })

  it("scenarioSummaries compute correct averages", async () => {
    const ghxIter1 = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 1,
      session: {
        toolCallCount: 4,
        toolCallCommands: ["a", "b", "c", "d"],
        assistantTurns: 2,
        reasoningBlocks: 0,
        tokens: { input: 100, output: 50, reasoning: 0, cache_read: 0, cache_write: 0, total: 150 },
      },
    })
    const ghxIter2 = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 2,
      session: {
        toolCallCount: 2,
        toolCallCommands: ["x", "y"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: { input: 50, output: 25, reasoning: 0, cache_read: 0, cache_write: 0, total: 75 },
      },
    })
    const adIter1 = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-001",
      iteration: 1,
      session: {
        toolCallCount: 6,
        toolCallCommands: ["a", "b", "c", "d", "e", "f"],
        assistantTurns: 3,
        reasoningBlocks: 0,
        tokens: {
          input: 200,
          output: 100,
          reasoning: 0,
          cache_read: 0,
          cache_write: 0,
          total: 300,
        },
      },
    })
    const adIter2 = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-001",
      iteration: 2,
      session: {
        toolCallCount: 4,
        toolCallCommands: ["p", "q", "r", "s"],
        assistantTurns: 2,
        reasoningBlocks: 0,
        tokens: { input: 100, output: 50, reasoning: 0, cache_read: 0, cache_write: 0, total: 150 },
      },
    })

    readRunDirMock
      .mockResolvedValueOnce([ghxIter1, ghxIter2])
      .mockResolvedValueOnce([adIter1, adIter2])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.scenarioSummaries).toHaveLength(1)
    const summary = report.scenarioSummaries[0]
    expect(summary?.scenarioId).toBe("sc-001")
    expect(summary?.iterCount).toBe(2)
    expect(summary?.avgGhxToolCalls).toBe(3)
    expect(summary?.avgAdToolCalls).toBe(5)
    expect(summary?.avgGhxTokens).toBe(112.5)
    expect(summary?.avgAdTokens).toBe(225)
  })

  it("scenarioSummaries returns null averages when no data available", async () => {
    readRunDirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.scenarioSummaries).toHaveLength(0)
  })

  it("includes ghxRunDir and adRunDir in report", async () => {
    readRunDirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const report = await buildIterReport("/my/ghx/run", "/my/ad/run")

    expect(report.ghxRunDir).toBe("/my/ghx/run")
    expect(report.adRunDir).toBe("/my/ad/run")
  })

  it("includes generatedAt ISO timestamp in report", async () => {
    readRunDirMock.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("scenarioSummaries returns null avgGhxTokens when ghx data has null tokens", async () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-nulltok",
      iteration: 1,
      session: {
        toolCallCount: 2,
        toolCallCommands: ["a", "b"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: null,
      },
    })

    readRunDirMock.mockResolvedValueOnce([ghxIter]).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    const summary = report.scenarioSummaries.find((s) => s.scenarioId === "sc-nulltok")
    expect(summary?.avgGhxTokens).toBeNull()
  })

  it("populates ghxResults and adResults from results map", async () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const adIter = makeIterData({ mode: "agent_direct", scenarioId: "sc-001", iteration: 1 })
    const ghxRow = makeBenchmarkRow({
      scenario_id: "sc-001",
      iteration: 1,
      success: true,
      output_valid: true,
      cost: 0.01,
      latency_ms_wall: 3000,
      internal_retry_count: 0,
      external_retry_count: 0,
      error: null,
    })
    const adRow = makeBenchmarkRow({
      scenario_id: "sc-001",
      iteration: 1,
      success: false,
      output_valid: false,
      cost: 0.02,
      latency_ms_wall: 6000,
      internal_retry_count: 1,
      external_retry_count: 0,
      error: { type: "timeout", message: "timed out" },
    })

    readRunDirMock.mockResolvedValueOnce([ghxIter]).mockResolvedValueOnce([adIter])
    loadResultsMapMock
      .mockResolvedValueOnce(new Map([["sc-001::1", ghxRow]]))
      .mockResolvedValueOnce(new Map([["sc-001::1", adRow]]))

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    const pair = report.pairs[0]
    expect(pair?.ghxResults).toEqual({
      success: true,
      outputValid: true,
      cost: 0.01,
      latencyMsWall: 3000,
      internalRetryCount: 0,
      externalRetryCount: 0,
      error: null,
    })
    expect(pair?.adResults).toEqual({
      success: false,
      outputValid: false,
      cost: 0.02,
      latencyMsWall: 6000,
      internalRetryCount: 1,
      externalRetryCount: 0,
      error: { type: "timeout", message: "timed out" },
    })
  })

  it("scenarioSummaries compute correct success and outputValid rates", async () => {
    const ghxIter1 = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const ghxIter2 = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 2 })
    const adIter1 = makeIterData({ mode: "agent_direct", scenarioId: "sc-001", iteration: 1 })
    const adIter2 = makeIterData({ mode: "agent_direct", scenarioId: "sc-001", iteration: 2 })

    readRunDirMock
      .mockResolvedValueOnce([ghxIter1, ghxIter2])
      .mockResolvedValueOnce([adIter1, adIter2])
    loadResultsMapMock
      .mockResolvedValueOnce(
        new Map([
          [
            "sc-001::1",
            makeBenchmarkRow({
              scenario_id: "sc-001",
              iteration: 1,
              success: true,
              output_valid: true,
              cost: 0.01,
              latency_ms_wall: 3000,
            }),
          ],
          [
            "sc-001::2",
            makeBenchmarkRow({
              scenario_id: "sc-001",
              iteration: 2,
              success: false,
              output_valid: false,
              cost: 0.02,
              latency_ms_wall: 5000,
            }),
          ],
        ]),
      )
      .mockResolvedValueOnce(
        new Map([
          [
            "sc-001::1",
            makeBenchmarkRow({
              scenario_id: "sc-001",
              iteration: 1,
              success: true,
              output_valid: false,
              cost: 0.03,
              latency_ms_wall: 4000,
            }),
          ],
          [
            "sc-001::2",
            makeBenchmarkRow({
              scenario_id: "sc-001",
              iteration: 2,
              success: true,
              output_valid: true,
              cost: 0.04,
              latency_ms_wall: 6000,
            }),
          ],
        ]),
      )

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    const summary = report.scenarioSummaries[0]
    expect(summary?.ghxSuccessRate).toBe(50)
    expect(summary?.adSuccessRate).toBe(100)
    expect(summary?.ghxOutputValidRate).toBe(50)
    expect(summary?.adOutputValidRate).toBe(50)
    expect(summary?.avgGhxCost).toBe(0.015)
    expect(summary?.avgAdCost).toBe(0.035)
    expect(summary?.avgGhxLatencyWall).toBe(4000)
    expect(summary?.avgAdLatencyWall).toBe(5000)
  })

  it("scenarioSummaries returns null rates when results map is empty", async () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })

    readRunDirMock.mockResolvedValueOnce([ghxIter]).mockResolvedValueOnce([])

    const report = await buildIterReport("/runs/ghx", "/runs/ad")

    const summary = report.scenarioSummaries[0]
    expect(summary?.ghxSuccessRate).toBeNull()
    expect(summary?.adSuccessRate).toBeNull()
    expect(summary?.ghxOutputValidRate).toBeNull()
    expect(summary?.adOutputValidRate).toBeNull()
    expect(summary?.avgGhxCost).toBeNull()
    expect(summary?.avgAdCost).toBeNull()
  })
})

describe("formatIterReport", () => {
  function makeReport(overrides: Partial<IterReport> = {}): IterReport {
    return {
      generatedAt: "2026-01-01T00:00:00.000Z",
      ghxRunDir: "/runs/ghx",
      adRunDir: "/runs/ad",
      pairs: [],
      scenarioSummaries: [],
      ...overrides,
    }
  }

  it("contains the Benchmark Iteration Report header", () => {
    const report = makeReport()
    const output = formatIterReport(report)

    expect(output).toContain("# Benchmark Iteration Report")
  })

  it("contains the Summary Table section", () => {
    const report = makeReport()
    const output = formatIterReport(report)

    expect(output).toContain("## Summary Table")
  })

  it("contains scenario section headings", () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [
        {
          scenarioId: "sc-001",
          iterCount: 1,
          avgGhxToolCalls: 3,
          avgAdToolCalls: null,
          avgGhxTokens: 180,
          avgAdTokens: null,
          ghxSuccessRate: null,
          adSuccessRate: null,
          ghxOutputValidRate: null,
          adOutputValidRate: null,
          avgGhxCost: null,
          avgAdCost: null,
          avgGhxLatencyWall: null,
          avgAdLatencyWall: null,
        },
      ],
    })

    const output = formatIterReport(report)

    expect(output).toContain("## Scenario: sc-001")
  })

  it("contains iteration section headings", () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("### Iteration 1")
  })

  it("shows ghx capabilities when present", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 1,
      ghxLogs: {
        capabilities: [
          { capability_id: "issues.list", route: "graphql", ok: true },
          { capability_id: "pr.create", route: "cli", ok: false },
        ],
        errorCount: 1,
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("**ghx capabilities invoked:**")
    expect(output).toContain("`issues.list` via graphql (ok)")
    expect(output).toContain("`pr.create` via cli (fail)")
  })

  it("shows agent_direct bash commands when present", () => {
    const adIter = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-001",
      iteration: 1,
      ghxLogs: null,
      session: {
        toolCallCount: 2,
        toolCallCommands: ["gh issue list", "gh pr view 42"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: null,
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: null,
          agentDirect: adIter,
          ghxMetrics: null,
          adMetrics: toMetrics(adIter),
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("**agent_direct bash commands:**")
    expect(output).toContain("`gh issue list`")
    expect(output).toContain("`gh pr view 42`")
  })

  it("shows delta values in iteration tables", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 1,
      session: {
        toolCallCount: 3,
        toolCallCommands: ["a", "b", "c"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: { input: 100, output: 50, reasoning: 0, cache_read: 0, cache_write: 0, total: 150 },
      },
    })
    const adIter = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-001",
      iteration: 1,
      ghxLogs: null,
      session: {
        toolCallCount: 6,
        toolCallCommands: ["a", "b", "c", "d", "e", "f"],
        assistantTurns: 2,
        reasoningBlocks: 0,
        tokens: {
          input: 200,
          output: 100,
          reasoning: 0,
          cache_read: 0,
          cache_write: 0,
          total: 300,
        },
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: adIter,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: toMetrics(adIter),
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("-3")
    expect(output).toContain("-150")
  })

  it("shows n/a when one side metrics is null", () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("n/a")
  })

  it("includes the summary table header row", () => {
    const report = makeReport({
      scenarioSummaries: [
        {
          scenarioId: "sc-001",
          iterCount: 2,
          avgGhxToolCalls: 3.0,
          avgAdToolCalls: 5.0,
          avgGhxTokens: 150.0,
          avgAdTokens: 300.0,
          ghxSuccessRate: 100,
          adSuccessRate: 50,
          ghxOutputValidRate: 100,
          adOutputValidRate: 50,
          avgGhxCost: null,
          avgAdCost: null,
          avgGhxLatencyWall: null,
          avgAdLatencyWall: null,
        },
      ],
    })

    const output = formatIterReport(report)

    expect(output).toContain("| Scenario |")
    expect(output).toContain("sc-001")
    expect(output).toContain("3.0")
    expect(output).toContain("5.0")
  })

  it("summary table includes ok% and valid% columns", () => {
    const report = makeReport({
      scenarioSummaries: [
        {
          scenarioId: "sc-001",
          iterCount: 2,
          avgGhxToolCalls: null,
          avgAdToolCalls: null,
          avgGhxTokens: null,
          avgAdTokens: null,
          ghxSuccessRate: 75,
          adSuccessRate: 100,
          ghxOutputValidRate: 50,
          adOutputValidRate: 100,
          avgGhxCost: 0.01,
          avgAdCost: 0.02,
          avgGhxLatencyWall: null,
          avgAdLatencyWall: null,
        },
      ],
    })

    const output = formatIterReport(report)

    expect(output).toContain("75%")
    expect(output).toContain("100%")
    expect(output).toContain("50%")
  })

  it("handles ghx capabilities with null route", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 1,
      ghxLogs: {
        capabilities: [{ capability_id: "issues.get", route: null, ok: true }],
        errorCount: 0,
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("`issues.get` via unknown (ok)")
  })

  it("does not show bash commands section when agentDirect session is null", () => {
    const adIter = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-001",
      iteration: 1,
      session: null,
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: null,
          agentDirect: adIter,
          ghxMetrics: null,
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).not.toContain("**agent_direct bash commands:**")
  })

  it("does not show capabilities section when ghxLogs capabilities is empty", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-001",
      iteration: 1,
      ghxLogs: { capabilities: [], errorCount: 0 },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).not.toContain("**ghx capabilities invoked:**")
  })

  it("renders delta as positive when ghx exceeds agentDirect", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-delta",
      iteration: 1,
      session: {
        toolCallCount: 10,
        toolCallCommands: Array(10).fill("gh cmd"),
        assistantTurns: 3,
        reasoningBlocks: 0,
        tokens: {
          input: 200,
          output: 100,
          reasoning: 0,
          cache_read: 0,
          cache_write: 0,
          total: 300,
        },
      },
    })
    const adIter = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-delta",
      iteration: 1,
      ghxLogs: null,
      session: {
        toolCallCount: 5,
        toolCallCommands: Array(5).fill("gh cmd"),
        assistantTurns: 2,
        reasoningBlocks: 0,
        tokens: { input: 100, output: 50, reasoning: 0, cache_read: 0, cache_write: 0, total: 150 },
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-delta",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: adIter,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: toMetrics(adIter),
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("+5")
    expect(output).toContain("+150")
  })

  it("renders delta as n/a when adVal is zero (avoid division by zero)", () => {
    const ghxIter = makeIterData({
      mode: "ghx",
      scenarioId: "sc-zero",
      iteration: 1,
      session: {
        toolCallCount: 3,
        toolCallCommands: ["a", "b", "c"],
        assistantTurns: 1,
        reasoningBlocks: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 0 },
      },
    })
    const adIter = makeIterData({
      mode: "agent_direct",
      scenarioId: "sc-zero",
      iteration: 1,
      ghxLogs: null,
      session: {
        toolCallCount: 0,
        toolCallCommands: [],
        assistantTurns: 0,
        reasoningBlocks: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 0 },
      },
    })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-zero",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: adIter,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: toMetrics(adIter),
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("+3")
  })

  it("shows results rows (Success, Cost, Latency) when ghxResults or adResults is present", () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: {
            success: true,
            outputValid: true,
            cost: 0.0123,
            latencyMsWall: 5000,
            internalRetryCount: 0,
            externalRetryCount: 0,
            error: null,
          },
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("| Success")
    expect(output).toContain("| Output valid")
    expect(output).toContain("| Cost (USD)")
    expect(output).toContain("| Latency wall (ms)")
    expect(output).toContain("pass")
    expect(output).toContain("$0.0123")
    expect(output).toContain("5000")
  })

  it("shows fail for failed results and error text", () => {
    const adIter = makeIterData({ mode: "agent_direct", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: null,
          agentDirect: adIter,
          ghxMetrics: null,
          adMetrics: toMetrics(adIter),
          ghxResults: null,
          adResults: {
            success: false,
            outputValid: false,
            cost: 0.0,
            latencyMsWall: 60000,
            internalRetryCount: 0,
            externalRetryCount: 1,
            error: { type: "timeout", message: "request timed out" },
          },
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("fail")
    expect(output).toContain("timeout: request timed out")
  })

  it("does not show results rows when both ghxResults and adResults are null", () => {
    const ghxIter = makeIterData({ mode: "ghx", scenarioId: "sc-001", iteration: 1 })
    const report = makeReport({
      pairs: [
        {
          scenarioId: "sc-001",
          iteration: 1,
          ghx: ghxIter,
          agentDirect: null,
          ghxMetrics: toMetrics(ghxIter),
          adMetrics: null,
          ghxResults: null,
          adResults: null,
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).not.toContain("| Success")
    expect(output).not.toContain("| Cost (USD)")
  })
})
