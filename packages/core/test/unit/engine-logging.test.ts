import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

const infoSpy = vi.fn()
const debugSpy = vi.fn()
const warnSpy = vi.fn()
const errorSpy = vi.fn()

vi.mock("@core/core/telemetry/log.js", () => ({
  logger: {
    debug: (...args: unknown[]) => debugSpy(...args),
    info: (...args: unknown[]) => infoSpy(...args),
    warn: (...args: unknown[]) => warnSpy(...args),
    error: (...args: unknown[]) => errorSpy(...args),
  },
}))

const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

vi.mock("@core/core/execute/execute.js", () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

vi.mock("@core/core/registry/index.js", () => ({
  getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
}))

function makeOkEnvelope(data: unknown = {}): ResultEnvelope {
  return {
    ok: true,
    data,
    meta: { capability_id: "repo.view", route_used: "graphql", reason: "CARD_PREFERRED" },
  }
}

function makeErrorEnvelope(): ResultEnvelope {
  return {
    ok: false,
    data: undefined,
    error: { code: "SERVER", message: "fail", retryable: false },
    meta: { capability_id: "repo.view", route_used: "graphql", reason: "CARD_PREFERRED" },
  }
}

describe("executeTask logging", () => {
  beforeEach(() => {
    infoSpy.mockReset()
    debugSpy.mockReset()
    warnSpy.mockReset()
    errorSpy.mockReset()
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("logs execute.start (debug) and execute.complete (info) on success", async () => {
    executeMock.mockResolvedValue(makeOkEnvelope({ id: 1 }))

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      { githubClient: createGithubClient() },
    )

    expect(debugSpy).toHaveBeenCalledWith(
      "execute.start",
      expect.objectContaining({ capability_id: "repo.view" }),
    )

    expect(infoSpy).toHaveBeenCalledWith(
      "execute.complete",
      expect.objectContaining({
        capability_id: "repo.view",
        ok: true,
        duration_ms: expect.any(Number),
      }),
    )
  })

  it("logs execute.complete with ok: false on failure", async () => {
    executeMock.mockResolvedValue(makeErrorEnvelope())

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      { githubClient: createGithubClient() },
    )

    expect(infoSpy).toHaveBeenCalledWith(
      "execute.complete",
      expect.objectContaining({ capability_id: "repo.view", ok: false }),
    )
  })

  it("logs execute.unsupported_task (error) when card not found", async () => {
    getOperationCardMock.mockReturnValue(null)

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask({ task: "unknown.task", input: {} }, { githubClient: createGithubClient() })

    expect(errorSpy).toHaveBeenCalledWith(
      "execute.unsupported_task",
      expect.objectContaining({ task: "unknown.task" }),
    )
  })
})

describe("executeTasks logging", () => {
  beforeEach(() => {
    infoSpy.mockReset()
    debugSpy.mockReset()
    warnSpy.mockReset()
    errorSpy.mockReset()
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("logs execute_batch.start (debug) and execute_batch.complete (info)", async () => {
    executeMock.mockResolvedValue(makeOkEnvelope({ id: 1 }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(debugSpy).toHaveBeenCalledWith(
      "execute_batch.start",
      expect.objectContaining({ count: 1 }),
    )

    expect(infoSpy).toHaveBeenCalledWith(
      "execute_batch.complete",
      expect.objectContaining({
        total: 1,
        succeeded: 1,
        duration_ms: expect.any(Number),
      }),
    )

    expect(result.status).toBe("success")
  })
})
