import { loadConfig, parseProfilerFlags } from "@profiler/config/loader.js"
import type { ProfilerConfig } from "@profiler/config/schema.js"
import { describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}))

vi.mock("js-yaml", () => ({
  default: { load: vi.fn() },
}))

const { readFile } = await import("node:fs/promises")
const yaml = (await import("js-yaml")).default

const baseConfig: ProfilerConfig = {
  modes: ["agent_direct"],
  scenarios: { set: "core" },
  execution: { repetitions: 5, warmup: true, timeoutDefaultMs: 120_000, allowedRetries: 0 },
  output: {
    resultsDir: "results",
    reportsDir: "reports",
    sessionExport: true,
    logLevel: "info",
  },
  extensions: {},
}

describe("loadConfig", () => {
  it("reads YAML, preprocesses snake_case keys, and parses with Zod", async () => {
    vi.mocked(readFile).mockResolvedValue("yaml-content")
    vi.mocked(yaml.load).mockReturnValue({
      modes: ["agent_direct"],
      scenarios: { set: "core" },
      execution: { timeout_default_ms: 60_000 },
    })

    const result = await loadConfig("/path/to/config.yaml")

    expect(readFile).toHaveBeenCalledWith("/path/to/config.yaml", "utf-8")
    expect(yaml.load).toHaveBeenCalledWith("yaml-content")
    expect(result.execution.timeoutDefaultMs).toBe(60_000)
    expect(result.execution.repetitions).toBe(5)
  })

  it("converts nested snake_case keys to camelCase", async () => {
    vi.mocked(readFile).mockResolvedValue("yaml-content")
    vi.mocked(yaml.load).mockReturnValue({
      modes: ["mcp"],
      scenarios: { set: "full" },
      output: {
        results_dir: "custom/results",
        reports_dir: "custom/reports",
        session_export: false,
        log_level: "debug",
      },
    })

    const result = await loadConfig("/path/to/config.yaml")

    expect(result.output.resultsDir).toBe("custom/results")
    expect(result.output.reportsDir).toBe("custom/reports")
    expect(result.output.sessionExport).toBe(false)
    expect(result.output.logLevel).toBe("debug")
  })
})

describe("parseProfilerFlags", () => {
  it("returns base config unchanged when no flags are provided", () => {
    const result = parseProfilerFlags([], baseConfig)

    expect(result).toEqual(baseConfig)
  })

  it("overrides modes with --mode flags", () => {
    const result = parseProfilerFlags(["--mode", "mcp", "--mode", "ghx"], baseConfig)

    expect(result.modes).toEqual(["mcp", "ghx"])
  })

  it("overrides repetitions with --repetitions flag", () => {
    const result = parseProfilerFlags(["--repetitions", "10"], baseConfig)

    expect(result.execution.repetitions).toBe(10)
    expect(result.execution.warmup).toBe(true)
  })

  it("sets warmup to false with --skip-warmup flag", () => {
    const result = parseProfilerFlags(["--skip-warmup"], baseConfig)

    expect(result.execution.warmup).toBe(false)
    expect(result.execution.repetitions).toBe(5)
  })

  it("overrides scenario set with --scenario-set flag", () => {
    const result = parseProfilerFlags(["--scenario-set", "extended"], baseConfig)

    expect(result.scenarios.set).toBe("extended")
  })

  it("overrides scenario ids with --scenario flags", () => {
    const result = parseProfilerFlags(["--scenario", "sc-001", "--scenario", "sc-002"], baseConfig)

    expect(result.scenarios.ids).toEqual(["sc-001", "sc-002"])
    expect(result.scenarios.set).toBe("core")
  })

  it("combines multiple flag overrides", () => {
    const result = parseProfilerFlags(
      ["--mode", "ghx", "--repetitions", "3", "--skip-warmup", "--scenario-set", "minimal"],
      baseConfig,
    )

    expect(result.modes).toEqual(["ghx"])
    expect(result.execution.repetitions).toBe(3)
    expect(result.execution.warmup).toBe(false)
    expect(result.scenarios.set).toBe("minimal")
  })
})
