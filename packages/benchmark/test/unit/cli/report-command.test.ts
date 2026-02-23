import type { BenchmarkRow } from "@bench/domain/types.js"
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"

const buildSummaryMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    generatedAt: "2026-02-13T00:00:00.000Z",
    modes: {
      agent_direct: {
        mode: "agent_direct",
        modelSignature: "openai/gpt-4",
        runs: 3,
        successRate: 100,
        outputValidityRate: 100,
        runnerFailureRate: 0,
        timeoutStallRate: 0,
        retryRate: 0,
        medianLatencyMs: 100,
        medianLatencyMsWall: 100,
        medianTokensTotal: 100,
        medianTokensActive: 100,
        medianToolCalls: 4,
        p90LatencyMs: 120,
        p95LatencyMs: 140,
        iqrLatencyMs: 20,
        cvLatency: 0.1,
        p90TokensActive: 110,
        p95TokensActive: 120,
        medianCostUsd: 0.01,
      },
      ghx: {
        mode: "ghx",
        modelSignature: "openai/gpt-4",
        runs: 3,
        successRate: 100,
        outputValidityRate: 100,
        runnerFailureRate: 0,
        timeoutStallRate: 0,
        retryRate: 0,
        medianLatencyMs: 70,
        medianLatencyMsWall: 70,
        medianTokensTotal: 70,
        medianTokensActive: 70,
        medianToolCalls: 2,
        p90LatencyMs: 80,
        p95LatencyMs: 90,
        iqrLatencyMs: 15,
        cvLatency: 0.12,
        p90TokensActive: 80,
        p95TokensActive: 90,
        medianCostUsd: 0.005,
      },
    },
    profiling: {},
    delta: null,
    gate: {
      profile: "verify_pr",
      passed: true,
      reliability: null,
      efficiency: null,
      checks: [],
    },
  }),
)
const toMarkdownMock = vi.hoisted(() => vi.fn().mockReturnValue("# Benchmark Report"))
const loadHistoryMock = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const appendFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const writeFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mkdirMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const readdirMock = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const readJsonlFileMock = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const detectRegressionsMock = vi.hoisted(() => vi.fn().mockReturnValue([]))
const formatRegressionWarningsMock = vi.hoisted(() => vi.fn().mockReturnValue(""))
const expectationsConfigExistsMock = vi.hoisted(() => vi.fn().mockResolvedValue(false))
const inferModelSignatureFromRowsMock = vi.hoisted(() => vi.fn().mockReturnValue(null))
const loadExpectationsConfigMock = vi.hoisted(() => vi.fn())
const resolveGateThresholdsForModelMock = vi.hoisted(() => vi.fn())
const resolveModelForExpectationsMock = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock("@bench/report/aggregate.js", () => ({ buildSummary: buildSummaryMock }))
vi.mock("@bench/report/formatter.js", () => ({ toMarkdown: toMarkdownMock }))
vi.mock("@bench/report/regression.js", () => ({
  detectRegressions: detectRegressionsMock,
  formatRegressionWarnings: formatRegressionWarningsMock,
  loadHistory: loadHistoryMock,
}))
vi.mock("@bench/report/expectations.js", () => ({
  expectationsConfigExists: expectationsConfigExistsMock,
  inferModelSignatureFromRows: inferModelSignatureFromRowsMock,
  loadExpectationsConfig: loadExpectationsConfigMock,
  resolveGateThresholdsForModel: resolveGateThresholdsForModelMock,
  resolveModelForExpectations: resolveModelForExpectationsMock,
}))
vi.mock("@bench/util/jsonl.js", () => ({ readJsonlFile: readJsonlFileMock }))
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    appendFile: appendFileMock,
    writeFile: writeFileMock,
    mkdir: mkdirMock,
    readdir: readdirMock,
  }
})

import { main } from "@bench/cli/report-command.js"

let consoleLogSpy: MockInstance
let consoleErrorSpy: MockInstance
let processExitSpy: MockInstance

function mockBenchmarkRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
  return {
    timestamp: "2026-02-13T00:00:00.000Z",
    run_id: "run",
    mode: "agent_direct",
    scenario_id: "s1",
    scenario_set: null,
    iteration: 1,
    session_id: "session",
    success: true,
    output_valid: true,
    latency_ms_wall: 100,
    latency_ms_agent: 70,
    sdk_latency_ms: 90,
    tokens: {
      input: 10,
      output: 10,
      reasoning: 5,
      cache_read: 0,
      cache_write: 0,
      total: 25,
    },
    cost: 0.01,
    tool_calls: 4,
    api_calls: 2,
    internal_retry_count: 0,
    external_retry_count: 0,
    model: { provider_id: "openai", model_id: "gpt-4", mode: null },
    git: { repo: null, commit: null },
    error: null,
    ...overrides,
  }
}

describe("report-command main", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never)

    buildSummaryMock.mockReturnValue({
      generatedAt: "2026-02-13T00:00:00.000Z",
      modes: {
        agent_direct: {
          mode: "agent_direct",
          modelSignature: "openai/gpt-4",
          runs: 3,
          successRate: 100,
          outputValidityRate: 100,
          runnerFailureRate: 0,
          timeoutStallRate: 0,
          retryRate: 0,
          medianLatencyMs: 100,
          medianLatencyMsWall: 100,
          medianTokensTotal: 100,
          medianTokensActive: 100,
          medianToolCalls: 4,
          p90LatencyMs: 120,
          p95LatencyMs: 140,
          iqrLatencyMs: 20,
          cvLatency: 0.1,
          p90TokensActive: 110,
          p95TokensActive: 120,
          medianCostUsd: 0.01,
        },
        ghx: {
          mode: "ghx",
          modelSignature: "openai/gpt-4",
          runs: 3,
          successRate: 100,
          outputValidityRate: 100,
          runnerFailureRate: 0,
          timeoutStallRate: 0,
          retryRate: 0,
          medianLatencyMs: 70,
          medianLatencyMsWall: 70,
          medianTokensTotal: 70,
          medianTokensActive: 70,
          medianToolCalls: 2,
          p90LatencyMs: 80,
          p95LatencyMs: 90,
          iqrLatencyMs: 15,
          cvLatency: 0.12,
          p90TokensActive: 80,
          p95TokensActive: 90,
          medianCostUsd: 0.005,
        },
      },
      profiling: {},
      delta: null,
      gate: {
        profile: "verify_pr",
        passed: true,
        reliability: null,
        efficiency: null,
        checks: [],
      },
    })
    toMarkdownMock.mockReturnValue("# Benchmark Report")
    loadHistoryMock.mockResolvedValue([])
    appendFileMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
    mkdirMock.mockResolvedValue(undefined)
    detectRegressionsMock.mockReturnValue([])
    formatRegressionWarningsMock.mockReturnValue("")
    expectationsConfigExistsMock.mockResolvedValue(false)
    inferModelSignatureFromRowsMock.mockReturnValue(null)
    resolveModelForExpectationsMock.mockReturnValue(null)
    readJsonlFileMock.mockResolvedValue([mockBenchmarkRow()])
    readdirMock.mockResolvedValue([
      "2026-02-13-00-00-00-agent_direct-suite.jsonl",
      "2026-02-13-00-00-00-ghx-suite.jsonl",
    ])
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  it("loads latest results per mode when no --suite-jsonl provided", async () => {
    await main([])

    expect(readdirMock).toHaveBeenCalled()
  })

  it("throws error when no benchmark rows found", async () => {
    readJsonlFileMock.mockResolvedValue([])

    await expect(main([])).rejects.toThrow("No benchmark result rows found")
  })

  it("writes summary JSON and markdown files", async () => {
    await main([])

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining("latest-summary.json"),
      expect.any(String),
      "utf8",
    )
    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining("latest-summary.md"),
      expect.any(String),
      "utf8",
    )
  })

  it("appends history entry", async () => {
    await main([])

    expect(appendFileMock).toHaveBeenCalled()
  })

  it("logs output file paths to console", async () => {
    await main([])

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Wrote.*latest-summary\.json/))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Wrote.*latest-summary\.md/))
  })

  it("defaults to verify_pr gate profile", async () => {
    await main([])

    expect(buildSummaryMock).toHaveBeenCalledWith(
      expect.any(Array),
      "verify_pr",
      expect.any(Object),
    )
  })

  it("respects --gate-profile=verify_release", async () => {
    await main(["--gate-profile=verify_release"])

    expect(buildSummaryMock).toHaveBeenCalledWith(
      expect.any(Array),
      "verify_release",
      expect.any(Object),
    )
  })

  it("gate flag passes when gate.passed is true", async () => {
    await main(["--gate"])

    expect(processExitSpy).not.toHaveBeenCalledWith(1)
  })

  it("gate flag fails when gate.passed is false", async () => {
    buildSummaryMock.mockReturnValue({
      generatedAt: "2026-02-13T00:00:00.000Z",
      modes: {},
      profiling: {},
      delta: null,
      gate: {
        profile: "verify_pr",
        passed: false,
        reliability: null,
        efficiency: null,
        checks: [],
      },
    })

    await expect(main(["--gate"])).rejects.toThrow("Benchmark gate failed")
  })

  it("logs gate profile and result when --gate provided", async () => {
    await main(["--gate"])

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Benchmark verify profile: verify_pr/),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Benchmark verify result:/))
  })

  it("logs individual gate checks when gate provided", async () => {
    buildSummaryMock.mockReturnValue({
      generatedAt: "2026-02-13T00:00:00.000Z",
      modes: {
        agent_direct: buildSummaryMock().modes.agent_direct,
        ghx: buildSummaryMock().modes.ghx,
      },
      profiling: {},
      delta: null,
      gate: {
        profile: "verify_pr",
        passed: true,
        reliability: null,
        efficiency: null,
        checks: [
          {
            name: "test_check",
            passed: true,
            value: 50,
            threshold: 40,
            operator: ">=",
          },
        ],
      },
    })

    await main(["--gate"])

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[PASS\].*test_check/))
  })

  it("loads and uses expectations config when available", async () => {
    expectationsConfigExistsMock.mockResolvedValue(true)
    resolveGateThresholdsForModelMock.mockReturnValue({
      minTokensActiveReductionPct: 20,
      minLatencyReductionPct: 20,
      minToolCallReductionPct: 30,
      minEfficiencyCoveragePct: 95,
      maxSuccessRateDropPct: 1,
      minOutputValidityRatePct: 99,
      maxRunnerFailureRatePct: 2,
      maxTimeoutStallRatePct: 1,
      maxRetryRatePct: 8,
      minSamplesPerScenarioPerMode: 2,
      minCostReductionPct: 15,
    })

    await main([])

    expect(expectationsConfigExistsMock).toHaveBeenCalled()
    expect(resolveGateThresholdsForModelMock).toHaveBeenCalled()
  })

  it("throws error when expectations model specified but config not found", async () => {
    expectationsConfigExistsMock.mockResolvedValue(false)

    await expect(main(["--expectations-model=custom"])).rejects.toThrow(
      "Expectations config not found",
    )
  })

  it("respects --summary-json custom path", async () => {
    await main(["--summary-json=/custom/path.json"])

    expect(writeFileMock).toHaveBeenCalledWith("/custom/path.json", expect.any(String), "utf8")
  })

  it("respects --summary-md custom path", async () => {
    await main(["--summary-md=/custom/path.md"])

    expect(writeFileMock).toHaveBeenCalledWith("/custom/path.md", expect.any(String), "utf8")
  })

  it("loads multiple suite files when --suite-jsonl provided", async () => {
    await main(["--suite-jsonl=/path/1.jsonl", "--suite-jsonl=/path/2.jsonl"])

    expect(readJsonlFileMock).toHaveBeenCalledWith("/path/1.jsonl", expect.any(Object))
    expect(readJsonlFileMock).toHaveBeenCalledWith("/path/2.jsonl", expect.any(Object))
  })

  it("detects and formats regressions when history available", async () => {
    const regressions = [{ metric: "latency", value: 150, expected: 100 }]
    detectRegressionsMock.mockReturnValue(regressions)
    formatRegressionWarningsMock.mockReturnValue("\n## Regressions Detected")

    await main([])

    expect(detectRegressionsMock).toHaveBeenCalled()
    expect(formatRegressionWarningsMock).toHaveBeenCalledWith(regressions)
  })

  it("creates reports directory if missing", async () => {
    await main([])

    expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining("reports"), {
      recursive: true,
    })
  })

  it("creates results directory if missing", async () => {
    await main([])

    expect(mkdirMock).toHaveBeenCalledWith(expect.stringContaining("results"), {
      recursive: true,
    })
  })
})
