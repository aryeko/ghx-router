import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@eval/fixture/manager.js", () => ({
  FixtureManager: vi.fn().mockImplementation(() => ({
    seed: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ ok: ["pr-fixture"], missing: [] }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe("fixture command", () => {
  let fixtureFn: (argv: readonly string[]) => Promise<void>
  let processExitSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()

    processExitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`)
    })
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const mod = await import("@eval/cli/fixture.js")
    fixtureFn = mod.fixture
  })

  afterEach(() => {
    vi.clearAllMocks()
    processExitSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("seed subcommand", () => {
    it("calls fixtureManager.seed([])", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        seed: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.seed).toHaveBeenCalledWith([])
    })

    it("constructs FixtureManager with env default repo", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed"])

      expect(FixtureManager).toHaveBeenCalled()
    })
  })

  describe("status subcommand", () => {
    it("calls fixtureManager.status() and prints results", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["status"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        status: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.status).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it("prints ok and missing counts from status", async () => {
      await fixtureFn(["status"])

      const calls = consoleLogSpy.mock.calls.flat().join(" ")
      expect(calls).toContain("pr-fixture")
    })
  })

  describe("cleanup subcommand", () => {
    it("calls fixtureManager.cleanup()", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalled()
    })

    it("passes all: true to cleanup when --all flag is present", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup", "--all"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalledWith({ all: true })
    })

    it("passes all: false to cleanup without --all flag", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalledWith({ all: false })
    })
  })

  describe("--repo and --manifest flags", () => {
    it("constructs FixtureManager with specified --repo and --manifest", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["status", "--repo", "owner/custom-repo", "--manifest", "custom/path.json"])

      expect(FixtureManager).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: "owner/custom-repo",
          manifest: "custom/path.json",
        }),
      )
    })
  })

  describe("unknown subcommand", () => {
    it("prints usage and exits 1 on unknown subcommand", async () => {
      await expect(fixtureFn(["unknown"])).rejects.toThrow("process.exit(1)")

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage"))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it("prints usage and exits 1 when no subcommand given", async () => {
      await expect(fixtureFn([])).rejects.toThrow("process.exit(1)")

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
