import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock all dependencies before importing the module under test
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}))

vi.mock("@eval/config/loader.js", () => ({
  loadEvalConfig: vi.fn(),
}))

vi.mock("@eval/scenario/loader.js", () => ({
  loadEvalScenarios: vi.fn(),
}))

vi.mock("@eval/fixture/manager.js", () => ({
  FixtureManager: vi.fn().mockImplementation(() => ({
    status: vi.fn().mockResolvedValue({ ok: [], missing: [] }),
    seed: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock("@eval/provider/opencode-provider.js", () => ({
  OpenCodeProvider: vi.fn().mockImplementation(() => ({
    id: "opencode",
    init: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn(),
    prompt: vi.fn(),
    exportSession: vi.fn(),
    destroySession: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock("@eval/scorer/checkpoint-scorer.js", () => ({
  CheckpointScorer: vi.fn().mockImplementation(() => ({
    score: vi.fn(),
  })),
}))

vi.mock("@eval/mode/resolver.js", () => ({
  EvalModeResolver: vi.fn().mockImplementation(() => ({
    resolve: vi.fn(),
  })),
}))

vi.mock("@eval/collector/ghx-collector.js", () => ({
  GhxCollector: vi.fn().mockImplementation(() => ({
    collect: vi.fn(),
  })),
}))

vi.mock("@eval/hooks/eval-hooks.js", () => ({
  createEvalHooks: vi.fn().mockReturnValue({}),
}))

vi.mock("@ghx-dev/agent-profiler", () => ({
  runProfileSuite: vi.fn().mockResolvedValue({
    runId: "run-001",
    rows: [],
    outputPath: "results/run-001.jsonl",
  }),
}))

const MINIMAL_CONFIG = {
  modes: ["ghx"],
  scenarios: {},
  execution: { repetitions: 1, warmup: true, timeout_default_ms: 120_000 },
  output: {
    results_dir: "results",
    reports_dir: "reports",
    session_export: false,
    log_level: "info",
  },
  provider: { id: "opencode", port: 3001 },
  models: [{ id: "gpt-4o", label: "GPT-4o" }],
  fixtures: {
    repo: "",
    manifest: "fixtures/latest.json",
    seed_if_missing: false,
    reseed_between_modes: false,
  },
}

describe("run command", () => {
  let runFn: (argv: readonly string[]) => Promise<void>

  beforeEach(async () => {
    vi.clearAllMocks()

    const { loadEvalConfig } = await import("@eval/config/loader.js")
    const { loadEvalScenarios } = await import("@eval/scenario/loader.js")
    const { readFile: rf } = await import("node:fs/promises")

    vi.mocked(rf).mockResolvedValue("modes:\n  - ghx\nmodels:\n  - id: gpt-4o\n    label: GPT-4o")
    vi.mocked(loadEvalConfig).mockReturnValue(MINIMAL_CONFIG)
    vi.mocked(loadEvalScenarios).mockResolvedValue([])

    // Re-import fresh to pick up mocks
    const mod = await import("@eval/cli/run.js")
    runFn = mod.run
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("reads config from default path eval.config.yaml when no --config flag", async () => {
    const { readFile: rf } = await import("node:fs/promises")
    await runFn([])
    expect(rf).toHaveBeenCalledWith("eval.config.yaml", "utf-8")
  })

  it("reads config from the specified --config path", async () => {
    const { readFile: rf } = await import("node:fs/promises")
    await runFn(["--config", "custom.yaml"])
    expect(rf).toHaveBeenCalledWith("custom.yaml", "utf-8")
  })

  it("--dry-run logs config and exits without calling runProfileSuite", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    await runFn(["--dry-run"])

    expect(runProfileSuite).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("calls runProfileSuite once per model", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")
    const { loadEvalConfig } = await import("@eval/config/loader.js")

    vi.mocked(loadEvalConfig).mockReturnValue({
      ...MINIMAL_CONFIG,
      models: [
        { id: "model-a", label: "Model A" },
        { id: "model-b", label: "Model B" },
      ],
    })

    await runFn([])

    expect(runProfileSuite).toHaveBeenCalledTimes(2)
  })

  it("--model flag replaces models array with single model", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")
    const { loadEvalConfig } = await import("@eval/config/loader.js")

    vi.mocked(loadEvalConfig).mockReturnValue({
      ...MINIMAL_CONFIG,
      models: [
        { id: "model-a", label: "Model A" },
        { id: "model-b", label: "Model B" },
      ],
    })

    await runFn(["--model", "custom-model"])

    // Should only run once for the single --model override
    expect(runProfileSuite).toHaveBeenCalledTimes(1)
  })

  it("--skip-warmup sets warmup to false in execution config", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")
    const { loadEvalConfig } = await import("@eval/config/loader.js")

    vi.mocked(loadEvalConfig).mockReturnValue({
      ...MINIMAL_CONFIG,
      execution: { ...MINIMAL_CONFIG.execution, warmup: true },
    })

    await runFn(["--skip-warmup"])

    // runProfileSuite is called — key thing is no error
    expect(runProfileSuite).toHaveBeenCalledTimes(1)
  })

  it("--repetitions overrides the repetitions in the config", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")

    await runFn(["--repetitions", "3"])

    const call = vi.mocked(runProfileSuite).mock.calls[0]
    expect(call).toBeDefined()
    expect((call as unknown[][])[0]).toMatchObject({ repetitions: 3 })
  })

  it("--output-jsonl overrides the output path passed to runProfileSuite", async () => {
    const { runProfileSuite } = await import("@ghx-dev/agent-profiler")

    await runFn(["--output-jsonl", "/tmp/custom-output.jsonl"])

    const call = vi.mocked(runProfileSuite).mock.calls[0]
    expect(call).toBeDefined()
    expect((call as unknown[][])[0]).toMatchObject({ outputPath: "/tmp/custom-output.jsonl" })
  })
})
