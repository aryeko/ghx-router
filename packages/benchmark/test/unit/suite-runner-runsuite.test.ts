import { beforeEach, describe, expect, it, vi } from "vitest"

const createOpencodeMock = vi.fn()
const loadScenariosMock = vi.fn()
const appendFileMock = vi.fn(async () => undefined)
const mkdirMock = vi.fn(async () => undefined)

vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: createOpencodeMock
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    appendFile: appendFileMock,
    mkdir: mkdirMock
  }
})

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(() => ({ status: 0 }))
}))

function createSessionMocks(options?: { firstPromptFails?: boolean }) {
  let promptCount = 0
  const session = {
    create: vi.fn(async () => ({ data: { id: "session-1" } })),
    promptAsync: vi.fn(async () => {
      promptCount += 1
      if (options?.firstPromptFails && promptCount === 1) {
        throw new Error("prompt failed")
      }
      return { data: {} }
    }),
    messages: vi.fn(async () => ({
      data: [
        {
          info: {
            id: "msg-1",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 1, completed: 10 },
            tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
            cost: 0
          },
          parts: [
            {
              type: "text",
              text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql","attempts":[{"route":"graphql","status":"success"}]}}'
            },
            { type: "tool", tool: "api-client" },
            {
              type: "step-finish",
              reason: "done",
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0,
              time: { end: 10 }
            }
          ]
        }
      ]
    })),
    abort: vi.fn(async () => ({ data: {} }))
  }

  return session
}

describe("runSuite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs suite and appends rows", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"]
        },
        tags: []
      }
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "ghx_router", repetitions: 1, scenarioFilter: null })

    expect(mkdirMock).toHaveBeenCalled()
    expect(appendFileMock).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it("throws when scenario filter matches nothing", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })
    loadScenariosMock.mockResolvedValue([])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(mod.runSuite({ mode: "ghx_router", repetitions: 1, scenarioFilter: "none" })).rejects.toThrow(
      "No scenarios matched filter"
    )
    expect(close).toHaveBeenCalled()
  })

  it("throws when no scenarios exist without a filter", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })
    loadScenariosMock.mockResolvedValue([])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(mod.runSuite({ mode: "ghx_router", repetitions: 1, scenarioFilter: null })).rejects.toThrow(
      "No benchmark scenarios found"
    )
    expect(close).toHaveBeenCalled()
  })

  it("retries failed scenario attempts up to allowed_retries", async () => {
    const session = createSessionMocks({ firstPromptFails: true })
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 1,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"]
        },
        tags: []
      }
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await mod.runSuite({ mode: "ghx_router", repetitions: 1, scenarioFilter: null })

    expect(session.promptAsync).toHaveBeenCalledTimes(2)
    expect(appendFileMock).toHaveBeenCalledTimes(1)
  })

  it("throws if no benchmark result is produced for a scenario", async () => {
    const session = createSessionMocks()
    const close = vi.fn()
    createOpencodeMock.mockResolvedValue({ client: { session }, server: { close } })

    loadScenariosMock.mockResolvedValue([
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "run {{task}} {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: -1,
        fixture: { repo: "a/b" },
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"]
        },
        tags: []
      }
    ])

    const mod = await import("../../src/runner/suite-runner.js")
    await expect(mod.runSuite({ mode: "ghx_router", repetitions: 1, scenarioFilter: null })).rejects.toThrow(
      "No benchmark result produced"
    )
    expect(close).toHaveBeenCalled()
  })
})
