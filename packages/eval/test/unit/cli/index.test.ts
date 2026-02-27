import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the subcommand modules before any imports
vi.mock("@eval/cli/run.js", () => ({ run: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@eval/cli/analyze.js", () => ({ analyze: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@eval/cli/report.js", () => ({ report: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@eval/cli/check.js", () => ({ check: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@eval/cli/fixture.js", () => ({ fixture: vi.fn().mockResolvedValue(undefined) }))

describe("CLI index: main()", () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`)
    })
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    processExitSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it("dispatches 'run' command with argv slice", async () => {
    const { main } = await import("@eval/cli/index.js")
    const { run } = await import("@eval/cli/run.js")

    await main(["run", "--config", "eval.config.yaml"])

    expect(run).toHaveBeenCalledWith(["--config", "eval.config.yaml"])
  })

  it("dispatches 'analyze' command with argv slice", async () => {
    const { main } = await import("@eval/cli/index.js")
    const { analyze } = await import("@eval/cli/analyze.js")

    await main(["analyze", "--run-dir", "results"])

    expect(analyze).toHaveBeenCalledWith(["--run-dir", "results"])
  })

  it("dispatches 'report' command with argv slice", async () => {
    const { main } = await import("@eval/cli/index.js")
    const { report } = await import("@eval/cli/report.js")

    await main(["report", "--run-dir", "results"])

    expect(report).toHaveBeenCalledWith(["--run-dir", "results"])
  })

  it("dispatches 'check' command with argv slice", async () => {
    const { main } = await import("@eval/cli/index.js")
    const { check } = await import("@eval/cli/check.js")

    await main(["check", "--config"])

    expect(check).toHaveBeenCalledWith(["--config"])
  })

  it("dispatches 'fixture' command with argv slice", async () => {
    const { main } = await import("@eval/cli/index.js")
    const { fixture } = await import("@eval/cli/fixture.js")

    await main(["fixture", "seed"])

    expect(fixture).toHaveBeenCalledWith(["seed"])
  })

  it("logs error and exits with 1 on unknown command", async () => {
    const { main } = await import("@eval/cli/index.js")

    await expect(main(["unknown-cmd"])).rejects.toThrow("process.exit(1)")

    expect(consoleErrorSpy).toHaveBeenCalledWith("Unknown command: unknown-cmd")
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("logs usage hint on unknown command", async () => {
    const { main } = await import("@eval/cli/index.js")

    await expect(main(["bogus"])).rejects.toThrow("process.exit(1)")

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Usage: eval <run|analyze|report|check|fixture> [options]",
    )
  })
})
