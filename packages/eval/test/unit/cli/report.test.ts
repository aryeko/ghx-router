import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

  it("logs output with default run-dir when no --run-dir flag", async () => {
    await reportFn([])

    const output = consoleLogSpy.mock.calls.flat().join(" ")
    expect(output).toContain("results")
  })

  it("logs output with specified --run-dir", async () => {
    await reportFn(["--run-dir", "custom/results"])

    const output = consoleLogSpy.mock.calls.flat().join(" ")
    expect(output).toContain("custom/results")
  })

  it("includes 'not yet implemented' notice in output", async () => {
    await reportFn([])

    const output = consoleLogSpy.mock.calls.flat().join(" ")
    expect(output).toContain("not yet implemented")
  })
})
