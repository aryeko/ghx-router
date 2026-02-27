import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@eval/report/generate.js", () => ({
  generateEvalReport: vi.fn().mockResolvedValue("/reports/output"),
}))

import { generateEvalReport } from "@eval/report/generate.js"

describe("report command", () => {
  let reportFn: (argv: readonly string[]) => Promise<void>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const mod = await import("@eval/cli/report.js")
    reportFn = mod.report
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it("calls generateEvalReport with default options", async () => {
    await reportFn([])

    expect(generateEvalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        runDir: "results",
        format: "all",
      }),
    )
  })

  it("passes --run-dir flag", async () => {
    await reportFn(["--run-dir", "custom/results"])

    expect(generateEvalReport).toHaveBeenCalledWith(
      expect.objectContaining({ runDir: "custom/results" }),
    )
  })

  it("passes --format flag", async () => {
    await reportFn(["--format", "md"])

    expect(generateEvalReport).toHaveBeenCalledWith(expect.objectContaining({ format: "md" }))
  })

  it("passes --results flag as resultsPaths", async () => {
    await reportFn(["--results", "path/to/results.jsonl"])

    expect(generateEvalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsPaths: ["path/to/results.jsonl"],
      }),
    )
  })

  it("uses default results path when --results not provided", async () => {
    await reportFn([])

    expect(generateEvalReport).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsPaths: expect.arrayContaining([expect.stringContaining("results.jsonl")]),
      }),
    )
  })

  it("logs report directory on success", async () => {
    await reportFn([])

    const output = consoleLogSpy.mock.calls.flat().join(" ")
    expect(output).toContain("/reports/output")
  })
})
