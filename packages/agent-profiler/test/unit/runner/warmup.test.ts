import { describe, expect, it, vi } from "vitest"
import { runWarmup } from "../../../src/runner/warmup.js"
import { makeScenario } from "../../helpers/factories.js"
import { createMockProvider } from "../../helpers/mock-provider.js"

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

describe("runWarmup", () => {
  it("returns skipped=false with duration on success", async () => {
    const provider = createMockProvider()
    const scenario = makeScenario()
    const logger = makeLogger()

    const result = await runWarmup(provider, scenario, "system prompt", logger)

    expect(result.skipped).toBe(false)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
    expect(provider.calls.createSession?.length ?? 0).toBe(1)
    expect(provider.calls.prompt?.length ?? 0).toBe(1)
    expect(provider.calls.destroySession?.length ?? 0).toBe(1)
  })

  it("returns error message on failure (non-fatal)", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("Provider timeout")
    }
    const scenario = makeScenario()
    const logger = makeLogger()

    const result = await runWarmup(provider, scenario, "system prompt", logger)

    expect(result.skipped).toBe(false)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBe("Provider timeout")
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Provider timeout"))
  })

  it("calls destroySession even on prompt failure", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("boom")
    }
    const scenario = makeScenario()
    const logger = makeLogger()

    await runWarmup(provider, scenario, "system prompt", logger)

    expect(provider.calls.destroySession?.length ?? 0).toBe(1)
  })
})
