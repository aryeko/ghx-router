import { afterEach, describe, expect, it, vi } from "vitest"

describe("cli index entrypoint", () => {
  const originalArgv = process.argv.slice()
  const originalExitCode = process.exitCode

  afterEach(() => {
    process.argv = originalArgv.slice()
    process.exitCode = originalExitCode
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("runs main on direct invocation and sets process.exitCode", async () => {
    process.argv = ["node", "/tmp/ghx-entry.js", "--help"]

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>()
      return {
        ...actual,
        realpathSync: vi.fn(() => "/same/path"),
      }
    })
    vi.doMock("../../src/cli/commands/run.js", () => ({
      runCommand: vi.fn(async () => 0),
    }))

    await import("../../src/cli/index.js")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(process.exitCode).toBe(0)
    expect(stdout).toHaveBeenCalledWith(
      "Usage:\n  ghx run <task> --input '<json>' | --input - [--check-gh-preflight]\n  ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n",
    )
  })

  it("does not run main when argv[1] is missing", async () => {
    process.argv = ["node"]

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    vi.doMock("../../src/cli/commands/run.js", () => ({
      runCommand: vi.fn(async () => 0),
    }))

    await import("../../src/cli/index.js")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(stdout).not.toHaveBeenCalled()
    expect(stderr).not.toHaveBeenCalled()
  })

  it("falls back to URL comparison when realpath throws", async () => {
    process.argv = ["node", "/tmp/ghx-entry.js", "--help"]

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>()
      return {
        ...actual,
        realpathSync: vi.fn(() => {
          throw new Error("boom")
        }),
      }
    })
    vi.doMock("../../src/cli/commands/run.js", () => ({
      runCommand: vi.fn(async () => 0),
    }))

    await import("../../src/cli/index.js")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(stdout).not.toHaveBeenCalled()
  })

  it("prints error and exits on direct invocation failures", async () => {
    process.argv = ["node", "/tmp/ghx-entry.js", "run", "repo.view", "--input", "{}"]

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      process.exitCode = code ?? 0
      return undefined as never
    }) as never)

    vi.doMock("node:fs", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs")>()
      return {
        ...actual,
        realpathSync: vi.fn(() => "/same/path"),
      }
    })
    vi.doMock("../../src/cli/commands/run.js", () => ({
      runCommand: vi.fn(async () => {
        throw new Error("boom")
      }),
    }))

    await import("../../src/cli/index.js")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(stderr).toHaveBeenCalledWith("boom\n")
    expect(exit).toHaveBeenCalledWith(1)
  })
})
