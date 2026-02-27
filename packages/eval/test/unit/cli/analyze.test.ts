import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@eval/analysis/run-analyzers.js", () => ({
  runAnalyzers: vi
    .fn()
    .mockResolvedValue([
      { sessionId: "s1", scenarioId: "sc1", mode: "ghx", model: "", results: {} },
    ]),
}))

import { runAnalyzers } from "@eval/analysis/run-analyzers.js"

describe("analyze command", () => {
  let analyzeFn: (argv: readonly string[]) => Promise<void>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const mod = await import("@eval/cli/analyze.js")
    analyzeFn = mod.analyze
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it("calls runAnalyzers with default run-dir and output", async () => {
    await analyzeFn([])

    expect(runAnalyzers).toHaveBeenCalledWith({
      runDir: "results",
      outputDir: expect.stringContaining("analysis"),
    })
  })

  it("passes --run-dir flag to runAnalyzers", async () => {
    await analyzeFn(["--run-dir", "custom/results"])

    expect(runAnalyzers).toHaveBeenCalledWith(expect.objectContaining({ runDir: "custom/results" }))
  })

  it("passes --output flag to runAnalyzers", async () => {
    await analyzeFn(["--output", "custom/analysis"])

    expect(runAnalyzers).toHaveBeenCalledWith(
      expect.objectContaining({ outputDir: "custom/analysis" }),
    )
  })

  it("logs analysis results summary", async () => {
    await analyzeFn([])

    const output = consoleLogSpy.mock.calls.flat().join(" ")
    expect(output).toContain("1 session(s) analyzed")
  })
})
