import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn()
}))

import { spawnSync } from "node:child_process"

import {
  asNumber,
  coercePromptResponse,
  extractEnvelopeFromParts,
  extractSnapshotFromParts,
  fetchSessionMessages,
  getSessionApi,
  ghOk,
  hasAssistantMetadata,
  hasAssistantSignalParts,
  hasTextPart,
  isObject,
  renderPrompt,
  runScenario,
  shouldRequestContinuation,
  unwrapData,
  validateFixture,
  waitForAssistantFromMessages,
  withTimeout
} from "../../src/runner/suite-runner.js"

const spawnSyncMock = vi.mocked(spawnSync)

describe("suite-runner helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles object and wrapped data helpers", () => {
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject(null)).toBe(false)
    expect(unwrapData({ data: { ok: true } }, "x")).toEqual({ ok: true })
    expect(() => unwrapData({ data: null, error: { message: "nope" } }, "x")).toThrow(
      "x returned error payload"
    )
    expect(asNumber(12)).toBe(12)
    expect(asNumber("12")).toBeNull()
  })

  it("validates session API shape", () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn(async () => ({ data: {} }))
    }
    const api = getSessionApi({ session })
    expect(typeof api.create).toBe("function")
    expect(() => getSessionApi({})).toThrow("SDK client has no session API")
    expect(() => getSessionApi({ session: { create: 1 } })).toThrow("missing required methods")
  })

  it("extracts assistant metadata and snapshot tokens", () => {
    const parts = [
      {
        type: "step-finish",
        tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } },
        cost: 6,
        time: { end: 123 }
      }
    ]

    expect(hasAssistantMetadata({ time: { completed: 1 }, tokens: { input: 1 } })).toBe(true)
    expect(hasAssistantSignalParts([{ type: "tool" }])).toBe(true)
    expect(hasTextPart([{ type: "text", text: "x" }])).toBe(true)
    expect(extractSnapshotFromParts(parts)).toEqual({
      input: 1,
      output: 2,
      reasoning: 3,
      cacheRead: 4,
      cacheWrite: 5,
      cost: 6,
      completed: 123
    })

    expect(hasAssistantMetadata(undefined)).toBe(false)
    expect(extractSnapshotFromParts([{ type: "text", text: "no step" }])).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      completed: null
    })
  })

  it("coerces assistant response and continuation behavior", () => {
    const parts = [
      { type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' },
      { type: "step-finish", reason: "done", tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, time: { end: 2 }, cost: 0 }
    ]
    const coerced = coercePromptResponse({
      info: {
        id: "m1",
        sessionID: "s1",
        role: "assistant",
        time: { created: 1, completed: 2 },
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        cost: 0
      },
      parts
    })

    expect(coerced.assistant.id).toBe("m1")
    expect(shouldRequestContinuation(parts)).toBe(false)
    expect(shouldRequestContinuation([{ type: "step-finish", reason: "tool-calls" }])).toBe(true)
    expect(extractEnvelopeFromParts(parts).envelope).toBeTruthy()
    expect(() => coercePromptResponse({})).toThrow("Unsupported prompt response shape")
  })

  it("coerces response with missing metadata using step-finish snapshot", () => {
    const coerced = coercePromptResponse({
      info: {
        id: "m2",
        sessionID: "s2",
        role: "assistant"
      } as never,
      parts: [
        {
          type: "step-finish",
          reason: "done",
          tokens: { input: 5, output: 6, reasoning: 1, cache: { read: 2, write: 3 } },
          cost: 1,
          time: { end: 42 }
        }
      ]
    })

    expect(coerced.assistant.time.completed).toBe(42)
    expect(coerced.assistant.tokens).toEqual({
      input: 5,
      output: 6,
      reasoning: 1,
      cache: { read: 2, write: 3 }
    })
  })

  it("times out and resolves with helper", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "x")).resolves.toBe("ok")
    await expect(withTimeout(new Promise(() => {}), 10, "never")).rejects.toThrow(
      "Timeout while waiting for never"
    )
  })

  it("fetches and waits for assistant messages", async () => {
    const messages = vi.fn(async () => ({
      data: [
        {
          info: {
            id: "m1",
            role: "assistant",
            time: { created: 1, completed: 2 },
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0
          },
          parts: [{ type: "text", text: "ok" }]
        }
      ]
    }))
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages,
      abort: vi.fn()
    }

    const rows = await fetchSessionMessages(sessionApi, "s1")
    expect(rows).toHaveLength(1)

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc1")
    expect(response.info?.id).toBe("m1")
  })

  it("waits for assistant after previous id and ignores non-assistant entries", async () => {
    const messages = vi.fn(async () => ({
      data: [
        { parts: [{ type: "text", text: "no-info" }] },
        {
          info: { id: "old", role: "assistant", time: { created: 1, completed: 1 }, tokens: { input: 1 } },
          parts: [{ type: "text", text: "old" }]
        },
        {
          info: { id: "user-msg", role: "user" },
          parts: [{ type: "text", text: "user" }]
        },
        {
          info: {
            id: "new",
            role: "assistant",
            time: { created: 2, completed: 3 },
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0
          },
          parts: [{ type: "text", text: "new" }]
        }
      ]
    }))
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages,
      abort: vi.fn()
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-prev", "old")
    expect(response.info?.id).toBe("new")
  })

  it("times out waiting for assistant message", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn()
    }

    await expect(waitForAssistantFromMessages(sessionApi, "s1", 30, "sc-timeout")).rejects.toThrow(
      "Timed out waiting for assistant message"
    )
  })

  it("validates fixtures and renders prompts", () => {
    spawnSyncMock.mockReturnValue({ status: 0 } as never)
    expect(ghOk(["repo", "view"])).toBe(true)

    validateFixture({
      id: "s",
      name: "n",
      task: "issue.view",
      input: { issueNumber: 1 },
      prompt_template: "{{task}} {{scenario_id}} {{input_json}} {{fixture_repo}}",
      timeout_ms: 1000,
      allowed_retries: 0,
      fixture: { repo: "owner/repo" },
      assertions: { must_succeed: true },
      tags: []
    })

    const prompt = renderPrompt(
      {
        id: "s",
        name: "n",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "task={{task}} id={{scenario_id}} input={{input_json}} repo={{fixture_repo}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: { must_succeed: true, required_data_fields: ["id"] },
        tags: []
      },
      "ghx_router"
    )
    expect(prompt).toContain("ghx run")
    expect(prompt).toContain("id")
  })

  it("fails fixture validation when repo or identifiers are invalid", () => {
    spawnSyncMock.mockReturnValue({ status: 1 } as never)

    expect(() =>
      validateFixture({
        id: "s",
        name: "n",
        task: "repo.view",
        input: {},
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "owner/repo" },
        assertions: { must_succeed: true },
        tags: []
      })
    ).toThrow("repo not found or inaccessible")

    spawnSyncMock.mockReturnValue({ status: 0 } as never)
    expect(() =>
      validateFixture({
        id: "s",
        name: "n",
        task: "issue.view",
        input: {},
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "owner/repo" },
        assertions: { must_succeed: true },
        tags: []
      })
    ).toThrow("issue.view requires numeric")

    expect(() =>
      validateFixture({
        id: "s",
        name: "n",
        task: "pr.view",
        input: {},
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "owner/repo" },
        assertions: { must_succeed: true },
        tags: []
      })
    ).toThrow("pr.view requires numeric")
  })

  it("fails fixture validation when pr is missing", () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0 } as never)
      .mockReturnValueOnce({ status: 1 } as never)

    expect(() =>
      validateFixture({
        id: "s",
        name: "n",
        task: "pr.view",
        input: { prNumber: 9 },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "owner/repo" },
        assertions: { must_succeed: true },
        tags: []
      })
    ).toThrow("pr #9 not found")
  })

  it("runs a scenario and returns normalized row", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
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

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}} with {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          expect_valid_output: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: true,
          min_tool_calls: 1,
          require_attempt_trace: true
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
    expect(result.tool_calls).toBeGreaterThan(0)
  })

  it("marks scenario failed when tool-call requirements are not met", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
              role: "assistant",
              time: { created: 1, completed: 10 },
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}'
              }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}} with {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: true,
          min_tool_calls: 2
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Expected at least 2 tool call")
  })

  it("marks scenario failed when max_tool_calls is exceeded", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
              role: "assistant",
              time: { created: 1, completed: 10 },
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}'
              },
              { type: "tool", tool: "api-client" }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}} with {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          max_tool_calls: 0
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Expected at most 0 tool call")
  })

  it("marks scenario failed when attempt trace is required but missing", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
              role: "assistant",
              time: { created: 1, completed: 10 },
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}'
              }
            ]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}} with {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
          require_attempt_trace: true
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Expected attempt trace metadata")
  })

  it("supports inverted output expectation", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s1",
              role: "assistant",
              time: { created: 1, completed: 10 },
              tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
              cost: 0
            },
            parts: [{ type: "text", text: '{"ok":false,"data":[],"error":{"code":"X"},"meta":{}}' }]
          }
        ]
      })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}} with {{input_json}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: false,
          expect_valid_output: false,
          require_tool_calls: false,
          data_type: "object"
        },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(true)
  })

  it("returns runner_error row and aborts session on failures", async () => {
    const abort = vi.fn(async () => ({ data: {} }))
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => {
        throw new Error("prompt failed")
      }),
      messages: vi.fn(async () => ({ data: [] })),
      abort
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe("runner_error")
    expect(abort).toHaveBeenCalled()
  })

  it("returns runner_error for non-Error failures", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => {
        throw "boom"
      }),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn(async () => ({ data: {} }))
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-001",
        name: "Repo view",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      "ghx_router",
      1
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe("boom")
  })

})
