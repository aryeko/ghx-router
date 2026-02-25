import { runScenarioIteration } from "@bench/runner/scenario-runner.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSessionProvider } from "../../helpers/mock-session-provider.js"
import { makeWorkflowScenario } from "../../helpers/scenario-factory.js"

vi.mock("@bench/runner/checkpoint.js", () => ({
  evaluateCheckpoints: vi.fn(),
}))

vi.mock("@bench/runner/mode-instructions.js", () => ({
  modeInstructions: vi.fn(),
}))

vi.mock("@bench/fixture/manifest.js", () => ({
  resolveWorkflowFixtureBindings: vi.fn((scenario) => scenario),
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, mkdir: vi.fn().mockResolvedValue(undefined) }
})

vi.mock("@bench/runner/session-export.js", () => ({
  exportSession: vi.fn().mockResolvedValue({ ok: true }),
}))

describe("runScenarioIteration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a row with success=true when checkpoints pass and expected_outcome=success", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario({
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "cp1",
            verification_task: "test",
            verification_input: {},
            condition: "non_empty",
          },
        ],
      },
    })

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(result.success).toBe(true)
    expect(result.error).toBe(null)
    expect(result.mode).toBe("ghx")
    expect(result.scenario_id).toBe(scenario.id)
    expect(result.iteration).toBe(1)
    expect(result.tokens).toEqual({
      input: 100,
      output: 50,
      reasoning: 10,
      cache_read: 0,
      cache_write: 0,
      total: 160,
    })
  })

  it("returns error with type=checkpoint_failed when checkpoints fail and expected_outcome=success", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: false,
      results: [{ name: "cp1", passed: false, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario({
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "cp1",
            verification_task: "test",
            verification_input: {},
            condition: "non_empty",
          },
        ],
      },
    })

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(result.success).toBe(false)
    expect(result.error).not.toBeNull()
    expect(result.error?.type).toBe("checkpoint_failed")
  })

  it("returns success=true when checkpoints fail but expected_outcome=expected_error", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: false,
      results: [{ name: "cp1", passed: false, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario({
      assertions: {
        expected_outcome: "expected_error",
        checkpoints: [
          {
            name: "cp1",
            verification_task: "test",
            verification_input: {},
            condition: "non_empty",
          },
        ],
      },
    })

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(result.success).toBe(true)
    expect(result.error).toBe(null)
  })

  it("returns error with type=runner_error when provider.createSession throws", async () => {
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")

    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const thrownError = new Error("Session creation failed")
    vi.spyOn(provider, "createSession").mockRejectedValueOnce(thrownError)

    const scenario = makeWorkflowScenario()

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(result.success).toBe(false)
    expect(result.error).not.toBeNull()
    expect(result.error?.type).toBe("runner_error")
    expect(result.error?.message).toBe("Session creation failed")
  })

  it("calls resolveWorkflowFixtureBindings when manifest is non-null", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { resolveWorkflowFixtureBindings } = await import("@bench/fixture/manifest.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
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

    await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(resolveWorkflowFixtureBindings).toHaveBeenCalledWith(scenario, manifest)
  })

  it("does not call resolveWorkflowFixtureBindings when manifest is null", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { resolveWorkflowFixtureBindings } = await import("@bench/fixture/manifest.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()

    await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
    })

    expect(resolveWorkflowFixtureBindings).not.toHaveBeenCalled()
  })

  it("creates iterDir when iterLogContext is provided", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { mkdir } = await import("node:fs/promises")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()
    const iterLogContext = { iterDir: "/logs/2026-02-23/ts/ghx/scenario/iter-1" }

    await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
      iterLogContext,
    })

    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(iterLogContext.iterDir, { recursive: true })
  })

  it("calls exportSession with sessionId and iterDir in finally block", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { exportSession } = await import("@bench/runner/session-export.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()
    const iterLogContext = { iterDir: "/logs/2026-02-23/ts/ghx/scenario/iter-2" }

    await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 2,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
      iterLogContext,
    })

    expect(vi.mocked(exportSession)).toHaveBeenCalledWith(
      expect.objectContaining({ destDir: iterLogContext.iterDir }),
    )
  })

  it("warns but does not throw when exportSession returns ok=false", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { exportSession } = await import("@bench/runner/session-export.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])
    vi.mocked(exportSession).mockResolvedValue({ ok: false, reason: "session not found" })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
      iterLogContext: { iterDir: "/logs/iter-1" },
    })

    expect(result.success).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("session export failed"))
    warnSpy.mockRestore()
  })

  it("warns but does not throw when exportSession itself throws", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { exportSession } = await import("@bench/runner/session-export.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])
    vi.mocked(exportSession).mockRejectedValueOnce(new Error("export crashed"))

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
      iterLogContext: { iterDir: "/logs/iter-1" },
    })

    expect(result.success).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("export crashed"))
    warnSpy.mockRestore()
  })

  it("skips mkdir and exportSession when iterLogContext is null", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")
    const { mkdir } = await import("node:fs/promises")
    const { exportSession } = await import("@bench/runner/session-export.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario()

    await runScenarioIteration({
      provider,
      scenario,
      mode: "ghx",
      iteration: 1,
      scenarioSet: null,
      manifest: null,
      runId: "run-123",
      githubToken: "token-abc",
      // iterLogContext omitted (defaults to null)
    })

    expect(vi.mocked(mkdir)).not.toHaveBeenCalled()
    expect(vi.mocked(exportSession)).not.toHaveBeenCalled()
  })

  it("sets mode, scenario_id, iteration, tokens fields correctly in happy path", async () => {
    const { evaluateCheckpoints } = await import("@bench/runner/checkpoint.js")
    const { modeInstructions } = await import("@bench/runner/mode-instructions.js")

    vi.mocked(evaluateCheckpoints).mockResolvedValue({
      allPassed: true,
      results: [{ name: "cp1", passed: true, data: null }],
    })
    vi.mocked(modeInstructions).mockResolvedValue(["mock instruction"])

    const provider = createMockSessionProvider()
    const scenario = makeWorkflowScenario({ id: "scenario-abc" })

    const result = await runScenarioIteration({
      provider,
      scenario,
      mode: "agent_direct",
      iteration: 5,
      scenarioSet: "test-set",
      manifest: null,
      runId: "run-456",
      githubToken: "token-abc",
    })

    expect(result.mode).toBe("agent_direct")
    expect(result.scenario_id).toBe("scenario-abc")
    expect(result.iteration).toBe(5)
    expect(result.scenario_set).toBe("test-set")
    expect(result.tokens).toBeDefined()
    expect(result.tokens.input).toBe(100)
    expect(result.tokens.output).toBe(50)
  })
})
