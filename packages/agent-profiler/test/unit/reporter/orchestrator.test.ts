import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@profiler/reporter/metrics-page.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("@profiler/reporter/metrics-page.js")>()
  return {
    ...original,
    generateMetricsPage: vi.fn(original.generateMetricsPage),
  }
})

import { mkdir, writeFile } from "node:fs/promises"
import { generateMetricsPage } from "@profiler/reporter/metrics-page.js"
import { generateReport } from "@profiler/reporter/orchestrator.js"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates report directories", async () => {
    const rows = [makeProfileRow()]
    await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
    })
    expect(mkdir).toHaveBeenCalledTimes(2)
    const mkdirMock = vi.mocked(mkdir)
    const firstCall = mkdirMock.mock.calls[0]
    const secondCall = mkdirMock.mock.calls[1]
    expect(firstCall?.[0]).toMatch(/scenarios$/)
    expect(secondCall?.[0]).toMatch(/data$/)
  })

  it("writes all expected files", async () => {
    const rows = [makeProfileRow({ scenarioId: "s1" }), makeProfileRow({ scenarioId: "s2" })]
    await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
    })

    const writeFileMock = vi.mocked(writeFile)
    const writtenPaths = writeFileMock.mock.calls.map((c) => String(c[0]))

    // 4 pages + 2 scenario pages + 3 data files = 9
    expect(writtenPaths.length).toBe(9)

    expect(writtenPaths.some((p) => p.endsWith("index.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("metrics.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("analysis.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("comparison.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("s1.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("s2.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.csv"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.json"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("summary.json"))).toBe(true)
  })

  it("returns the report directory path", async () => {
    const result = await generateReport({
      runId: "run_1",
      rows: [makeProfileRow()],
      reportsDir: "/tmp/reports",
    })
    expect(result).toMatch(/^\/tmp\/reports\//)
  })

  it("handles empty rows", async () => {
    await generateReport({
      runId: "run_empty",
      rows: [],
      reportsDir: "/tmp/reports",
    })

    const writeFileMock = vi.mocked(writeFile)
    // 4 pages + 0 scenario pages + 3 data files = 7
    expect(writeFileMock.mock.calls.length).toBe(7)
  })

  it("continues generating other pages when one page generator throws", async () => {
    vi.mocked(generateMetricsPage).mockImplementationOnce(() => {
      throw new Error("metrics kaboom")
    })

    const logger = { warn: vi.fn() }
    const rows = [makeProfileRow()]
    const result = await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
      logger,
    })

    expect(result).toBeDefined()

    // logger.warn should have been called with the error
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("metrics kaboom"))

    // Other pages should still be written (all except metrics.md)
    const writeFileMock = vi.mocked(writeFile)
    const writtenPaths = writeFileMock.mock.calls.map((c) => String(c[0]))

    expect(writtenPaths.some((p) => p.endsWith("index.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("comparison.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.csv"))).toBe(true)
    // metrics.md should NOT have been written since the generator threw
    expect(writtenPaths.some((p) => p.endsWith("metrics.md"))).toBe(false)
  })

  it("logs warning and continues when writeFile rejects for a single page", async () => {
    const writeFileMock = vi.mocked(writeFile)
    writeFileMock.mockRejectedValueOnce(new Error("ENOSPC: no space left on device"))

    const logger = { warn: vi.fn() }
    const rows = [makeProfileRow()]
    const result = await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
      logger,
    })

    expect(result).toBeDefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ENOSPC: no space left on device"),
    )

    // Other pages should still be written
    const writtenPaths = writeFileMock.mock.calls.map((c) => String(c[0]))
    expect(writtenPaths.some((p) => p.endsWith("metrics.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.csv"))).toBe(true)
  })

  it("passes analysis results to analysis page", async () => {
    const rows = [makeProfileRow()]
    const result = await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
      analysisResults: [
        {
          sessionId: "ses_001",
          scenarioId: "s1",
          mode: "mode_a",
          model: "test-model",
          results: {},
        },
      ],
    })
    expect(result).toBeDefined()

    const writeFileMock = vi.mocked(writeFile)
    const analysisCall = writeFileMock.mock.calls.find((c) => String(c[0]).endsWith("analysis.md"))
    expect(analysisCall).toBeDefined()
    // Should not contain "No session analysis data available" since we passed bundles
    const content = String(analysisCall?.[1] ?? "")
    expect(content).toContain("# Session Analysis")
    expect(content).not.toContain("No session analysis data available")
  })
})
