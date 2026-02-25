import { runSuite } from "@bench/runner/suite.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeWorkflowScenario } from "../../helpers/scenario-factory.js"

vi.mock("@bench/runner/scenario-runner.js", () => ({
  runScenarioIteration: vi.fn(),
}))

vi.mock("@bench/provider/factory.js", () => ({
  createSessionProvider: vi.fn(),
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    rename: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock("@bench/fixture/manifest.js", () => ({
  resolveWorkflowFixtureBindings: vi.fn((s) => s),
}))

vi.mock("@bench/fixture/reset.js", () => ({
  resetScenarioFixtures: vi.fn((_scenario, manifest) => Promise.resolve(manifest)),
}))

let runScenarioIterationMock: ReturnType<typeof vi.fn>
let createSessionProviderMock: ReturnType<typeof vi.fn>

const mockBenchmarkRow = {
  timestamp: "2026-01-01T00:00:00.000Z",
  run_id: "r1",
  mode: "ghx" as const,
  scenario_id: "s1",
  scenario_set: null,
  iteration: 1,
  session_id: "sess1",
  success: true,
  output_valid: true,
  latency_ms_wall: 100,
  latency_ms_agent: 70,
  sdk_latency_ms: 90,
  tokens: {
    input: 10,
    output: 10,
    reasoning: 0,
    cache_read: 0,
    cache_write: 0,
    total: 20,
  },
  cost: 0.01,
  tool_calls: 2,
  api_calls: 0,
  internal_retry_count: 0,
  external_retry_count: 0,
  model: { provider_id: "openai", model_id: "gpt-4", mode: null },
  git: { repo: null, commit: null },
  error: null,
}

describe("runSuite", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")
    runScenarioIterationMock = vi.mocked(runScenarioIteration)
    createSessionProviderMock = vi.mocked(createSessionProvider)
    runScenarioIterationMock.mockResolvedValue(mockBenchmarkRow)
    createSessionProviderMock.mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)
  })

  it("emits events in correct order: suite_started, scenario_started, scenario_finished, suite_finished", async () => {
    const events: Array<{ type: string }> = []
    const onProgress = (event: unknown) => events.push(event as { type: string })

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress,
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    const eventTypes = events.map((e) => e.type)
    expect(eventTypes).toContain("suite_started")
    expect(eventTypes).toContain("scenario_started")
    expect(eventTypes).toContain("scenario_finished")
    expect(eventTypes).toContain("suite_finished")

    const suiteStartedIdx = eventTypes.indexOf("suite_started")
    const scenarioStartedIdx = eventTypes.indexOf("scenario_started")
    const scenarioFinishedIdx = eventTypes.indexOf("scenario_finished")
    const suiteFinishedIdx = eventTypes.indexOf("suite_finished")

    expect(suiteStartedIdx < scenarioStartedIdx).toBe(true)
    expect(scenarioStartedIdx < scenarioFinishedIdx).toBe(true)
    expect(scenarioFinishedIdx < suiteFinishedIdx).toBe(true)
  })

  it("skips warmup run when skipWarmup=true", async () => {
    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 1 scenario * 2 repetitions = 2 iterations (no warmup)
    expect(runScenarioIterationMock).toHaveBeenCalledTimes(2)
  })

  it("runs warmup when skipWarmup=false", async () => {
    const mockCleanup = vi.fn().mockResolvedValue(undefined)
    createSessionProviderMock.mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: mockCleanup,
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: false,
    })

    // 1 warmup + 1 scenario * 1 repetition = 2 iterations
    expect(runScenarioIterationMock).toHaveBeenCalledTimes(2)
    // One cleanup for warmup provider, one for main provider
    expect(mockCleanup).toHaveBeenCalledTimes(2)
  })

  it("appends JSONL to file for each scenario run", async () => {
    const { appendFile } = await import("node:fs/promises")

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 2 scenarios * 2 repetitions = 4 appends (no warmup)
    expect(vi.mocked(appendFile)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(appendFile)).toHaveBeenCalledWith(
      "/tmp/test.jsonl",
      expect.stringContaining(JSON.stringify(mockBenchmarkRow)),
      "utf8",
    )
  })

  it("returns rowCount and durationMs", async () => {
    const scenario = makeWorkflowScenario()

    const result = await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 3,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    expect(result.rowCount).toBe(3)
    expect(typeof result.durationMs).toBe("number")
    expect(result.durationMs >= 0).toBe(true)
  })

  it("emits suite_error event and rethrows when runScenarioIteration throws", async () => {
    const thrownError = new Error("Scenario failed")
    runScenarioIterationMock.mockRejectedValueOnce(thrownError)

    const events: Array<{ type: string; message?: string }> = []
    const onProgress = (event: unknown) => events.push(event as { type: string })

    const scenario = makeWorkflowScenario()

    await expect(
      runSuite({
        modes: ["ghx"],
        scenarios: [scenario],
        repetitions: 1,
        manifest: null,
        outputJsonlPath: "/tmp/test.jsonl",
        onProgress,
        providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
        skipWarmup: true,
      }),
    ).rejects.toThrow("Scenario failed")

    const errorEvent = events.find((e) => e.type === "suite_error")
    expect(errorEvent).toBeDefined()
    expect(errorEvent?.message).toBe("Scenario failed")
  })

  it("rowCount equals scenarios * repetitions * modes", async () => {
    const scenario1 = makeWorkflowScenario({ id: "s1" })
    const scenario2 = makeWorkflowScenario({ id: "s2" })

    const result = await runSuite({
      modes: ["ghx", "agent_direct"],
      scenarios: [scenario1, scenario2],
      repetitions: 3,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 2 scenarios * 3 repetitions * 2 modes = 12
    expect(result.rowCount).toBe(12)
  })

  it("passes manifest to runScenarioIteration when manifest is non-null", async () => {
    const scenario = makeWorkflowScenario()
    const manifest = {
      version: 1 as const,
      repo: {
        owner: "test",
        name: "repo",
        full_name: "test/repo",
        default_branch: "main",
      },
      resources: {},
    }

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    expect(runScenarioIterationMock).toHaveBeenCalledWith(expect.objectContaining({ manifest }))
  })

  it("warmup logs 'failed' when warmup result has success=false", async () => {
    runScenarioIterationMock.mockResolvedValue({ ...mockBenchmarkRow, success: false })

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: false,
    })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("failed"))
    consoleSpy.mockRestore()
  })

  it("warmup logs error when runScenarioIteration throws during warmup", async () => {
    runScenarioIterationMock
      .mockRejectedValueOnce(new Error("warmup boom"))
      .mockResolvedValue(mockBenchmarkRow)

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: false,
    })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("warmup boom"))
    consoleSpy.mockRestore()
  })

  it("warmup uses 'ghx' fallback mode when modes array is empty", async () => {
    const scenario = makeWorkflowScenario()

    const result = await runSuite({
      modes: [] as import("@bench/domain/types.js").BenchmarkMode[],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: false,
    })

    // Warmup runs once (mode falls back to "ghx"), no main iterations
    expect(runScenarioIterationMock).toHaveBeenCalledTimes(1)
    expect(result.rowCount).toBe(0)
  })

  it("emits suite_error with string message when non-Error is thrown", async () => {
    const { mkdir } = await import("node:fs/promises")

    vi.mocked(mkdir).mockRejectedValueOnce("mkdir-string-error")

    const events: Array<{ type: string; message?: string }> = []
    const onProgress = (event: unknown) => events.push(event as { type: string; message?: string })
    const scenario = makeWorkflowScenario()

    await expect(
      runSuite({
        modes: [] as import("@bench/domain/types.js").BenchmarkMode[],
        scenarios: [scenario],
        repetitions: 1,
        manifest: null,
        outputJsonlPath: "/tmp/test.jsonl",
        onProgress,
        providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
        skipWarmup: true,
      }),
    ).rejects.toBe("mkdir-string-error")

    const errorEvent = events.find((e) => e.type === "suite_error")
    expect(errorEvent).toBeDefined()
    expect(errorEvent?.message).toBe("mkdir-string-error")
  })

  it("calls resetScenarioFixtures before every iteration when manifest is non-null", async () => {
    const { resetScenarioFixtures } = await import("@bench/fixture/reset.js")

    const callOrder: string[] = []
    runScenarioIterationMock.mockImplementation(async () => {
      callOrder.push("runScenarioIteration")
      return mockBenchmarkRow
    })
    vi.mocked(resetScenarioFixtures).mockImplementation(async (_scenario, manifest) => {
      callOrder.push("resetScenarioFixtures")
      return manifest
    })

    const scenario = makeWorkflowScenario({ fixture: { reseed_per_iteration: true } })
    const manifest = {
      version: 1 as const,
      repo: { owner: "o", name: "r", full_name: "o/r", default_branch: "main" },
      resources: {},
    }

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 3,
      manifest,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      reviewerToken: "tok-abc",
    })

    expect(vi.mocked(resetScenarioFixtures)).toHaveBeenCalledTimes(3)
    expect(vi.mocked(resetScenarioFixtures)).toHaveBeenCalledWith(scenario, manifest, "tok-abc")

    // Verify reset is called before run in each iteration
    expect(callOrder).toEqual([
      "resetScenarioFixtures",
      "runScenarioIteration",
      "resetScenarioFixtures",
      "runScenarioIteration",
      "resetScenarioFixtures",
      "runScenarioIteration",
    ])
  })

  it("does not call resetScenarioFixtures when manifest is null", async () => {
    const { resetScenarioFixtures } = await import("@bench/fixture/reset.js")

    const scenario = makeWorkflowScenario({ fixture: { reseed_per_iteration: true } })

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      reviewerToken: "tok-abc",
    })

    expect(vi.mocked(resetScenarioFixtures)).not.toHaveBeenCalled()
  })

  it("passes reviewerToken from config to resetScenarioFixtures", async () => {
    const { resetScenarioFixtures } = await import("@bench/fixture/reset.js")

    const scenario = makeWorkflowScenario()
    const manifest = {
      version: 1 as const,
      repo: { owner: "o", name: "r", full_name: "o/r", default_branch: "main" },
      resources: {},
    }

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      reviewerToken: "my-special-token",
    })

    expect(vi.mocked(resetScenarioFixtures)).toHaveBeenCalledWith(
      scenario,
      manifest,
      "my-special-token",
    )
  })

  it("passes iterLogContext with correct iterDir when benchLogsDir and benchRunTs are provided", async () => {
    const scenario = makeWorkflowScenario({ id: "my-scenario" })

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      benchLogsDir: "/bench/logs",
      benchRunTs: "2026-02-23T14-30-00-000Z",
    })

    expect(runScenarioIterationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        iterLogContext: expect.objectContaining({
          iterDir: expect.stringContaining("my-scenario"),
        }),
      }),
    )
  })

  it("passes iterLogContext=null when benchLogsDir is not provided", async () => {
    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      // benchLogsDir omitted
    })

    expect(runScenarioIterationMock).toHaveBeenCalledWith(
      expect.objectContaining({ iterLogContext: null }),
    )
  })

  it("passes null reviewerToken when reviewerToken not provided in config", async () => {
    const { resetScenarioFixtures } = await import("@bench/fixture/reset.js")

    const scenario = makeWorkflowScenario()
    const manifest = {
      version: 1 as const,
      repo: { owner: "o", name: "r", full_name: "o/r", default_branch: "main" },
      resources: {},
    }

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
      // reviewerToken not provided
    })

    expect(vi.mocked(resetScenarioFixtures)).toHaveBeenCalledWith(scenario, manifest, null)
  })

  it("creates ghx staging dir and sets GHX_LOG_DIR env var when benchLogsDir and benchRunTs are provided", async () => {
    const { mkdir, readdir } = await import("node:fs/promises")
    const scenario = makeWorkflowScenario({ id: "sc1" })
    const originalGhxLogDir = process.env.GHX_LOG_DIR
    const originalGhxLogLevel = process.env.GHX_LOG_LEVEL

    try {
      await runSuite({
        modes: ["ghx"],
        scenarios: [scenario],
        repetitions: 1,
        manifest: null,
        outputJsonlPath: "/tmp/test.jsonl",
        onProgress: () => {},
        providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
        skipWarmup: true,
        benchLogsDir: "/bench-logs",
        benchRunTs: "2026-01-01T00-00-00-000Z",
      })
    } finally {
      process.env.GHX_LOG_DIR = originalGhxLogDir
      process.env.GHX_LOG_LEVEL = originalGhxLogLevel
    }

    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(expect.stringContaining("_ghx"), {
      recursive: true,
    })
    expect(vi.mocked(readdir)).toHaveBeenCalled()
  })

  it("moves new ghx log files from staging dir to iter dir after each iteration", async () => {
    const { readdir, rename } = await import("node:fs/promises")
    const scenario = makeWorkflowScenario({ id: "sc1" })
    const originalGhxLogDir = process.env.GHX_LOG_DIR
    const originalGhxLogLevel = process.env.GHX_LOG_LEVEL

    // First readdir (before iteration): no files yet
    vi.mocked(readdir).mockResolvedValueOnce([])
    // Second readdir (after iteration): one new file appeared
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(readdir).mockResolvedValueOnce(["ghx-2026-01-01.jsonl"] as any)

    try {
      await runSuite({
        modes: ["ghx"],
        scenarios: [scenario],
        repetitions: 1,
        manifest: null,
        outputJsonlPath: "/tmp/test.jsonl",
        onProgress: () => {},
        providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
        skipWarmup: true,
        benchLogsDir: "/bench-logs",
        benchRunTs: "2026-01-01T00-00-00-000Z",
      })
    } finally {
      process.env.GHX_LOG_DIR = originalGhxLogDir
      process.env.GHX_LOG_LEVEL = originalGhxLogLevel
    }

    expect(vi.mocked(rename)).toHaveBeenCalledWith(
      expect.stringContaining("ghx-2026-01-01.jsonl"),
      expect.stringContaining("ghx-2026-01-01.jsonl"),
    )
  })
})
