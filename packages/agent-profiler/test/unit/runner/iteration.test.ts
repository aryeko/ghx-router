import { describe, expect, it, vi } from "vitest"
import type { Collector } from "../../../src/contracts/collector.js"
import type { RunHooks } from "../../../src/contracts/hooks.js"
import type { IterationParams } from "../../../src/runner/iteration.js"
import { runIteration } from "../../../src/runner/iteration.js"
import { makeScenario } from "../../helpers/factories.js"
import { createMockProvider } from "../../helpers/mock-provider.js"
import { createMockScorer } from "../../helpers/mock-scorer.js"

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function makeParams(overrides?: Partial<IterationParams>): IterationParams {
  return {
    provider: createMockProvider(),
    scorer: createMockScorer(),
    collectors: [],
    hooks: {},
    scenario: makeScenario(),
    mode: "agent_direct",
    model: "test-model",
    iteration: 0,
    runId: "run_test",
    systemInstructions: "You are a test agent",
    sessionExport: true,
    logger: makeLogger(),
    ...overrides,
  }
}

describe("runIteration", () => {
  it("produces valid ProfileRow with correct fields", async () => {
    const provider = createMockProvider()
    const params = makeParams({ provider })

    const { row, trace } = await runIteration(params)

    expect(row.runId).toBe("run_test")
    expect(row.scenarioId).toBe("test-scenario-001")
    expect(row.mode).toBe("agent_direct")
    expect(row.model).toBe("test-model")
    expect(row.iteration).toBe(0)
    expect(row.success).toBe(true)
    expect(row.checkpointsPassed).toBe(3)
    expect(row.checkpointsTotal).toBe(3)
    expect(row.tokens.total).toBe(150)
    expect(row.toolCalls.total).toBe(3)
    expect(row.toolCalls.failed).toBe(1)
    expect(row.toolCalls.byCategory).toEqual({ shell: 2, file: 1 })
    expect(row.toolCalls.errorRate).toBeCloseTo(1 / 3)
    expect(row.completionReason).toBe("stop")
    expect(row.provider).toBe("mock-provider")
    expect(row.sessionId).toBe("ses_test_001")
    expect(row.agentTurns).toBe(3) // from trace summary
    expect(trace).not.toBeNull()
  })

  it("calls beforeScenario and afterScenario hooks", async () => {
    const beforeScenario = vi.fn()
    const afterScenario = vi.fn()
    const hooks: RunHooks = { beforeScenario, afterScenario }
    const params = makeParams({ hooks })

    await runIteration(params)

    expect(beforeScenario).toHaveBeenCalledTimes(1)
    expect(beforeScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: params.scenario,
        mode: "agent_direct",
        model: "test-model",
        iteration: 0,
      }),
    )
    expect(afterScenario).toHaveBeenCalledTimes(1)
    expect(afterScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: params.scenario,
        mode: "agent_direct",
        model: "test-model",
        iteration: 0,
        result: expect.objectContaining({ success: true }),
        trace: expect.anything(),
      }),
    )
  })

  it("calls destroySession in finally (even on error)", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("prompt failure")
    }
    const params = makeParams({ provider })

    const { row } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toBe("prompt failure")
    expect(provider.calls.destroySession?.length ?? 0).toBe(1)
  })

  it("returns failed row with success=false on prompt error", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("timeout exceeded")
    }
    const params = makeParams({ provider })

    const { row, trace } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toBe("timeout exceeded")
    expect(row.completionReason).toBe("error")
    expect(row.tokens.total).toBe(0)
    expect(row.toolCalls.total).toBe(0)
    expect(trace).toBeNull()
  })

  it("collects metrics from all collectors into extensions", async () => {
    const collector1: Collector = {
      id: "c1",
      async collect() {
        return [{ name: "lines_changed", value: 42, unit: "lines" }]
      },
    }
    const collector2: Collector = {
      id: "c2",
      async collect() {
        return [
          { name: "files_read", value: 5, unit: "count" },
          { name: "complexity", value: "medium", unit: "" },
        ]
      },
    }
    const params = makeParams({ collectors: [collector1, collector2] })

    const { row } = await runIteration(params)

    expect(row.extensions).toEqual({
      lines_changed: 42,
      files_read: 5,
      complexity: "medium",
    })
  })

  it("sets agentTurns to 1 when sessionExport is disabled", async () => {
    const params = makeParams({ sessionExport: false })

    const { row, trace } = await runIteration(params)

    expect(row.agentTurns).toBe(1)
    expect(trace).toBeNull()
  })
})
