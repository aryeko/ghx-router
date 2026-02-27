import type { FixtureManager } from "@eval/fixture/manager.js"
import { createEvalHooks } from "@eval/hooks/eval-hooks.js"
import type { AfterScenarioContext, RunContext } from "@ghx-dev/agent-profiler"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock file system
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

function makeFixtureManager(
  overrides?: Partial<{
    status: () => Promise<{ ok: readonly string[]; missing: readonly string[] }>
    reset: (requires: readonly string[]) => Promise<void>
  }>,
): FixtureManager {
  return {
    status: vi.fn().mockResolvedValue({ ok: ["pr_with_mixed_threads"], missing: [] }),
    reset: vi.fn().mockResolvedValue(undefined),
    seed: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FixtureManager
}

const dummyRunContext: RunContext = {
  runId: "run-123",
  modes: ["ghx"],
  scenarios: [],
  repetitions: 1,
}

describe("createEvalHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("beforeRun", () => {
    it("does not throw when all fixtures are present", async () => {
      const manager = makeFixtureManager()
      const { beforeRun } = createEvalHooks({ fixtureManager: manager, sessionExport: false })
      await expect(beforeRun?.(dummyRunContext)).resolves.toBeUndefined()
    })

    it("throws when fixtures are missing", async () => {
      const manager = makeFixtureManager({
        status: vi.fn().mockResolvedValue({ ok: [], missing: ["pr_with_mixed_threads"] }),
      })
      const { beforeRun } = createEvalHooks({ fixtureManager: manager, sessionExport: false })
      await expect(beforeRun?.(dummyRunContext)).rejects.toThrow(
        "Missing fixtures before run: pr_with_mixed_threads",
      )
    })
  })

  describe("beforeScenario", () => {
    it("calls reset when reseedPerIteration is true", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_mixed_threads"],
            bindings: {},
            reseedPerIteration: true,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).toHaveBeenCalledWith(["pr_with_mixed_threads"])
    })

    it("does not call reset when reseedPerIteration is false", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_mixed_threads"],
            bindings: {},
            reseedPerIteration: false,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).not.toHaveBeenCalled()
    })

    it("does not call reset when scenario has no fixture", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).not.toHaveBeenCalled()
    })
  })

  describe("afterScenario", () => {
    it("exports session trace when sessionExport is true and trace is available", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: true })

      const dummyTrace = {
        sessionId: "ses-123",
        events: [],
        turns: [],
        summary: {
          totalTurns: 1,
          totalToolCalls: 0,
          totalTokens: {} as never,
          totalDuration: 0,
        },
      }

      await afterScenario?.({
        scenario: { id: "pr-fix-mixed-threads-001" } as never,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
        result: {} as never,
        trace: dummyTrace,
      } as AfterScenarioContext)

      expect(mkdir).toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalled()
    })

    it("does not export when sessionExport is false", async () => {
      const { writeFile } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: false })

      await afterScenario?.({
        scenario: { id: "pr-fix-001" } as never,
        mode: "ghx",
        model: "test",
        iteration: 1,
        result: {} as never,
        trace: { sessionId: "s", events: [], turns: [], summary: {} as never },
      } as AfterScenarioContext)

      expect(writeFile).not.toHaveBeenCalled()
    })

    it("does not export when trace is null", async () => {
      const { writeFile } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: true })

      await afterScenario?.({
        scenario: { id: "pr-fix-001" } as never,
        mode: "ghx",
        model: "test",
        iteration: 1,
        result: {} as never,
        trace: null,
      } as AfterScenarioContext)

      expect(writeFile).not.toHaveBeenCalled()
    })
  })
})
