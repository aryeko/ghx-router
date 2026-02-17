import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runCommandMock = vi.fn()
const setupCommandMock = vi.fn()
const capabilitiesListCommandMock = vi.fn()
const capabilitiesExplainCommandMock = vi.fn()

vi.mock("../../src/cli/commands/run.js", () => ({
  runCommand: (...args: unknown[]) => runCommandMock(...args),
}))

vi.mock("../../src/cli/commands/setup.js", () => ({
  setupCommand: (...args: unknown[]) => setupCommandMock(...args),
}))

vi.mock("../../src/cli/commands/capabilities-list.js", () => ({
  capabilitiesListCommand: (...args: unknown[]) => capabilitiesListCommandMock(...args),
}))

vi.mock("../../src/cli/commands/capabilities-explain.js", () => ({
  capabilitiesExplainCommand: (...args: unknown[]) => capabilitiesExplainCommandMock(...args),
}))

import { main } from "../../src/cli/index.js"

describe("cli index main", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runCommandMock.mockResolvedValue(0)
    setupCommandMock.mockResolvedValue(0)
    capabilitiesListCommandMock.mockResolvedValue(0)
    capabilitiesExplainCommandMock.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prints usage for empty argv", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main([])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith(
      "Usage:\n  ghx run <task> --input '<json>' [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })

  it("prints usage for --help", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await main(["--help"])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith(
      "Usage:\n  ghx run <task> --input '<json>' [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })

  it("delegates run command to runCommand", async () => {
    runCommandMock.mockResolvedValue(7)

    const code = await main(["run", "repo.view", "--input", "{}"])

    expect(code).toBe(7)
    expect(runCommandMock).toHaveBeenCalledWith(["repo.view", "--input", "{}"])
  })

  it("delegates setup command to setupCommand", async () => {
    setupCommandMock.mockResolvedValue(5)

    const code = await main(["setup", "--scope", "project"])

    expect(code).toBe(5)
    expect(setupCommandMock).toHaveBeenCalledWith(["--scope", "project"])
  })

  it("delegates capabilities list command", async () => {
    capabilitiesListCommandMock.mockResolvedValue(3)

    const code = await main(["capabilities", "list"])

    expect(code).toBe(3)
    expect(capabilitiesListCommandMock).toHaveBeenCalledWith([])
  })

  it("delegates capabilities explain command", async () => {
    capabilitiesExplainCommandMock.mockResolvedValue(9)

    const code = await main(["capabilities", "explain", "repo.view"])

    expect(code).toBe(9)
    expect(capabilitiesExplainCommandMock).toHaveBeenCalledWith(["repo.view"])
  })

  it("prints usage for unknown capabilities subcommand", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await main(["capabilities", "nope"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Unknown capabilities subcommand: nope\nUsage:\n  ghx run <task> --input '<json>' [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })

  it("prints usage when capabilities subcommand is missing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await main(["capabilities"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Missing capabilities subcommand.\nUsage:\n  ghx run <task> --input '<json>' [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })

  it("prints error and exits 1 for unknown command", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await main(["nope"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Unknown command: nope\nUsage:\n  ghx run <task> --input '<json>' [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })
})
