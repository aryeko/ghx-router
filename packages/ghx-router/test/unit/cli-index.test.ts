import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runCommandMock = vi.fn()

vi.mock("../../src/cli/commands/run.js", () => ({
  runCommand: (...args: unknown[]) => runCommandMock(...args)
}))

import { main } from "../../src/cli/index.js"

describe("cli index main", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runCommandMock.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prints usage for empty argv", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main([])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith("Usage:\n  ghx run <task> --input '<json>'\n")
  })

  it("prints usage for --help", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main(["--help"])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith("Usage:\n  ghx run <task> --input '<json>'\n")
  })

  it("delegates run command to runCommand", async () => {
    runCommandMock.mockResolvedValue(7)

    const code = await main(["run", "repo.view", "--input", "{}"])

    expect(code).toBe(7)
    expect(runCommandMock).toHaveBeenCalledWith(["repo.view", "--input", "{}"])
  })

  it("prints error and exits 1 for unknown command", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await main(["nope"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith("Unknown command: nope\nUsage:\n  ghx run <task> --input '<json>'\n")
  })
})
