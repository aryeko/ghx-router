import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}))

const VALID_CONFIG_YAML = `
modes:
  - ghx
models:
  - id: gpt-4o
    label: GPT-4o
`

const VALID_SCENARIO_JSON = JSON.stringify({
  id: "pr-fix-001",
  name: "PR fix test",
  description: "Tests PR fixing",
  prompt: "Fix the PR",
  timeoutMs: 60000,
  category: "pr",
  difficulty: "basic",
  assertions: { checkpoints: [] },
})

const INVALID_SCENARIO_JSON = JSON.stringify({
  id: "bad-id", // missing numeric suffix
  name: "Bad scenario",
})

describe("check command", () => {
  let checkFn: (argv: readonly string[]) => Promise<void>
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

    const mod = await import("@eval/cli/check.js")
    checkFn = mod.check
  })

  afterEach(() => {
    vi.clearAllMocks()
    processExitSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("no flags", () => {
    it("prints usage and exits 1 when no flags provided", async () => {
      await expect(checkFn([])).rejects.toThrow("process.exit(1)")
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage"))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe("--config flag", () => {
    it("validates config file and prints success", async () => {
      const { readFile } = await import("node:fs/promises")
      vi.mocked(readFile).mockResolvedValue(VALID_CONFIG_YAML)

      await checkFn(["--config"])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("eval.config.yaml"))
    })

    it("validates config file from specified --config path", async () => {
      const { readFile } = await import("node:fs/promises")
      vi.mocked(readFile).mockResolvedValue(VALID_CONFIG_YAML)

      await checkFn(["--config", "custom.yaml"])

      expect(readFile).toHaveBeenCalledWith("custom.yaml", "utf-8")
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("custom.yaml"))
    })

    it("prints error and exits 1 for invalid config", async () => {
      const { readFile } = await import("node:fs/promises")
      vi.mocked(readFile).mockResolvedValue("invalid: yaml: content\nmodels: []")

      await expect(checkFn(["--config"])).rejects.toThrow("process.exit(1)")

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("eval.config.yaml"))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe("--scenarios flag", () => {
    it("validates scenario files and prints success for valid scenarios", async () => {
      const { readFile, readdir } = await import("node:fs/promises")
      vi.mocked(readdir).mockResolvedValue(["pr-fix-001.json"] as never)
      vi.mocked(readFile).mockResolvedValue(VALID_SCENARIO_JSON)

      await checkFn(["--scenarios"])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("pr-fix-001.json"))
    })

    it("prints error and exits 1 for invalid scenario", async () => {
      const { readFile, readdir } = await import("node:fs/promises")
      vi.mocked(readdir).mockResolvedValue(["bad-scenario.json"] as never)
      vi.mocked(readFile).mockResolvedValue(INVALID_SCENARIO_JSON)

      await expect(checkFn(["--scenarios"])).rejects.toThrow("process.exit(1)")

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("bad-scenario.json"))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it("succeeds when there are no scenario files", async () => {
      const { readdir } = await import("node:fs/promises")
      vi.mocked(readdir).mockResolvedValue([] as never)

      await checkFn(["--scenarios"])

      expect(processExitSpy).not.toHaveBeenCalled()
    })
  })

  describe("--all flag", () => {
    it("validates both config and scenarios", async () => {
      const { readFile, readdir } = await import("node:fs/promises")
      vi.mocked(readdir).mockResolvedValue(["pr-fix-001.json"] as never)
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (String(path).endsWith(".yaml") || String(path).endsWith(".yml")) {
          return VALID_CONFIG_YAML
        }
        return VALID_SCENARIO_JSON
      })

      await checkFn(["--all"])

      expect(processExitSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it("exits 1 when any check fails under --all", async () => {
      const { readFile, readdir } = await import("node:fs/promises")
      vi.mocked(readdir).mockResolvedValue(["bad.json"] as never)
      vi.mocked(readFile).mockImplementation(async (path) => {
        if (String(path).endsWith(".yaml") || String(path).endsWith(".yml")) {
          return VALID_CONFIG_YAML
        }
        return INVALID_SCENARIO_JSON
      })

      await expect(checkFn(["--all"])).rejects.toThrow("process.exit(1)")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
