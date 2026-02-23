import type { IterData } from "@bench/report/iter-reader.js"
import type { IterReport } from "@bench/report/iter-report.js"
import { buildIterReport, formatIterReport, toMetrics } from "@bench/report/iter-report.js"
import { describe, expect, it, vi } from "vitest"

const readRunDirMock = vi.hoisted(() => vi.fn())
vi.mock("@bench/report/iter-reader.js", () => ({ readRunDir: readRunDirMock }))

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

describe("buildIterReport", () => {
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
        },
      ],
    })

    const output = formatIterReport(report)

    expect(output).toContain("| Scenario |")
    expect(output).toContain("sc-001")
    expect(output).toContain("3.0")
    expect(output).toContain("5.0")
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
        },
      ],
      scenarioSummaries: [],
    })

    const output = formatIterReport(report)

    expect(output).toContain("+3")
  })
})
