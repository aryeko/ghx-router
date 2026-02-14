import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runCommandMock = vi.fn()
const capabilitiesCommandMock = vi.fn()
const setupCommandMock = vi.fn()

vi.mock("../../src/cli/commands/run.js", () => ({
  runCommand: (...args: unknown[]) => runCommandMock(...args)
}))

vi.mock("../../src/cli/commands/capabilities.js", () => ({
  capabilitiesCommand: (...args: unknown[]) => capabilitiesCommandMock(...args)
}))

vi.mock("../../src/cli/commands/setup.js", () => ({
  setupCommand: (...args: unknown[]) => setupCommandMock(...args)
}))

import { main } from "../../src/cli/index.js"

const USAGE = "Usage:\n  ghx run <task> --input '<json>'\n  ghx setup --platform <claude-code|opencode> --scope <user|project> [--profile pr-review-ci] [--dry-run] [--verify] [--yes]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>"

describe("cli index main", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runCommandMock.mockResolvedValue(0)
    capabilitiesCommandMock.mockResolvedValue(0)
    setupCommandMock.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prints usage for empty argv", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main([])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith(`${USAGE}\n`)
  })

  it("prints usage for --help", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main(["--help"])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith(`${USAGE}\n`)
  })

  it("delegates setup command", async () => {
    setupCommandMock.mockResolvedValue(5)

    const code = await main(["setup", "--platform", "claude-code", "--scope", "project"])

    expect(code).toBe(5)
    expect(setupCommandMock).toHaveBeenCalledWith(["--platform", "claude-code", "--scope", "project"])
  })

  it("delegates capabilities command", async () => {
    capabilitiesCommandMock.mockResolvedValue(3)

    const code = await main(["capabilities", "list"])

    expect(code).toBe(3)
    expect(capabilitiesCommandMock).toHaveBeenCalledWith(["list"])
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
    expect(stderr).toHaveBeenCalledWith(`Unknown command: nope\n${USAGE}\n`)
  })
})
