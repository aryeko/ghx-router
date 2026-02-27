import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@ghx-dev/agent-profiler", () => ({
  readJsonlFile: vi.fn(),
  generateReport: vi.fn().mockResolvedValue("/reports/2026-02-28"),
}))

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
}))

import { readdir, readFile, rm } from "node:fs/promises"
import { generateEvalReport } from "@eval/report/generate.js"
import { generateReport, readJsonlFile } from "@ghx-dev/agent-profiler"

const mockRow = {
  runId: "run-1",
  scenarioId: "sc-001",
  mode: "ghx",
  model: "test-model",
  iteration: 0,
  startedAt: "2026-02-28T00:00:00Z",
  completedAt: "2026-02-28T00:01:00Z",
  tokens: { input: 100, output: 50, reasoning: 0 },
  timing: {
    totalMs: 60000,
    promptMs: 55000,
    scoringMs: 5000,
    segments: [],
  },
  toolCalls: {
    total: 5,
    byCategory: {},
    failed: 0,
    retried: 0,
    errorRate: 0,
    records: [],
  },
  cost: { inputCost: 0.01, outputCost: 0.005, totalCost: 0.015 },
  success: true,
  checkpointsPassed: 1,
  checkpointsTotal: 1,
  checkpointDetails: [],
  outputValid: true,
  provider: "opencode",
  sessionId: "sess-1",
  agentTurns: 3,
  completionReason: "stop",
  extensions: {},
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("generateEvalReport", () => {
  it("loads rows and calls generateReport", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([mockRow])
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    const reportDir = await generateEvalReport({
      runDir: "results",
      resultsPaths: ["results/results.jsonl"],
      outputDir: "reports",
      format: "all",
    })

    expect(readJsonlFile).toHaveBeenCalled()
    expect(generateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        reportsDir: "reports",
      }),
    )
    expect(reportDir).toBe("/reports/2026-02-28")
  })

  it("loads analysis bundles when present", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([mockRow])
    vi.mocked(readdir).mockImplementation(async (path) => {
      if (String(path).endsWith("analysis"))
        return ["sc-001"] as unknown as Awaited<ReturnType<typeof readdir>>
      return ["ghx-iter-0-analysis.json"] as unknown as Awaited<ReturnType<typeof readdir>>
    })
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        sessionId: "sess-1",
        scenarioId: "sc-001",
        mode: "ghx",
        model: "",
        results: {},
      }),
    )

    await generateEvalReport({
      runDir: "results",
      resultsPaths: ["results/results.jsonl"],
      outputDir: "reports",
      format: "all",
    })

    expect(generateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisResults: expect.arrayContaining([expect.objectContaining({ sessionId: "sess-1" })]),
      }),
    )
  })

  it("throws when no rows found", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([])
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    await expect(
      generateEvalReport({
        runDir: "results",
        resultsPaths: ["results/results.jsonl"],
        outputDir: "reports",
        format: "all",
      }),
    ).rejects.toThrow("No profile rows found")
  })

  it("filters csv files when format is md", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([mockRow])
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    await generateEvalReport({
      runDir: "results",
      resultsPaths: ["results/results.jsonl"],
      outputDir: "reports",
      format: "md",
    })

    expect(rm).toHaveBeenCalledWith(
      expect.stringContaining("results.csv"),
      expect.objectContaining({ force: true }),
    )
  })
})
