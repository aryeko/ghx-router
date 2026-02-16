import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from "node:child_process"

import {
  asNumber,
  assertGhxRouterPreflight,
  coercePromptResponse,
  extractEnvelopeFromParts,
  extractPromptResponseFromPromptResult,
  extractSnapshotFromParts,
  extractTimingBreakdown,
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
  withTimeout,
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
      "x returned error payload",
    )
    expect(asNumber(12)).toBe(12)
    expect(asNumber("12")).toBeNull()
    expect(unwrapData({ ok: true }, "plain")).toEqual({ ok: true })
  })

  it("validates session API shape", () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn(async () => ({ data: {} })),
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
        time: { end: 123 },
      },
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
      completed: 123,
    })

    expect(hasAssistantMetadata(undefined)).toBe(false)
    expect(extractSnapshotFromParts([{ type: "text", text: "no step" }])).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      completed: null,
    })
  })

  it("extracts timing breakdown from assistant messages", () => {
    const breakdown = extractTimingBreakdown([
      {
        info: {
          role: "assistant",
          time: { created: 100, completed: 1000 },
        },
        parts: [
          { type: "reasoning", time: { start: 250, end: 500 } },
          {
            type: "tool",
            tool: "bash",
            state: { time: { start: 550, end: 800 } },
          },
        ],
      },
    ] as unknown as Parameters<typeof extractTimingBreakdown>[0])

    expect(breakdown).toEqual({
      assistant_total_ms: 900,
      assistant_pre_reasoning_ms: 150,
      assistant_reasoning_ms: 250,
      assistant_between_reasoning_and_tool_ms: 50,
      assistant_post_tool_ms: 200,
      tool_total_ms: 250,
      tool_bash_ms: 250,
      tool_structured_output_ms: 0,
      observed_assistant_turns: 1,
    })
  })

  it("uses the earliest reasoning segment boundary for timing gaps", () => {
    const breakdown = extractTimingBreakdown([
      {
        info: {
          role: "assistant",
          time: { created: 100, completed: 1200 },
        },
        parts: [
          { type: "reasoning", time: { start: 200, end: 300 } },
          { type: "reasoning", time: { start: 420, end: 700 } },
          {
            type: "tool",
            tool: "bash",
            state: { time: { start: 800, end: 950 } },
          },
        ],
      },
    ] as unknown as Parameters<typeof extractTimingBreakdown>[0])

    expect(breakdown.assistant_pre_reasoning_ms).toBe(100)
    expect(breakdown.assistant_reasoning_ms).toBe(380)
    expect(breakdown.assistant_between_reasoning_and_tool_ms).toBe(100)
    expect(breakdown.assistant_post_tool_ms).toBe(250)
  })

  it("uses the latest tool completion for post-tool timing", () => {
    const breakdown = extractTimingBreakdown([
      {
        info: {
          role: "assistant",
          time: { created: 100, completed: 1300 },
        },
        parts: [
          { type: "reasoning", time: { start: 200, end: 300 } },
          {
            type: "tool",
            tool: "bash",
            state: { time: { start: 400, end: 600 } },
          },
          {
            type: "tool",
            tool: "StructuredOutput",
            state: { time: { start: 700, end: 1000 } },
          },
        ],
      },
    ] as unknown as Parameters<typeof extractTimingBreakdown>[0])

    expect(breakdown.tool_total_ms).toBe(500)
    expect(breakdown.tool_structured_output_ms).toBe(300)
    expect(breakdown.assistant_post_tool_ms).toBe(300)
  })

  it("coerces assistant response and continuation behavior", () => {
    const parts = [
      { type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' },
      {
        type: "step-finish",
        reason: "done",
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { end: 2 },
        cost: 0,
      },
    ]
    const coerced = coercePromptResponse({
      info: {
        id: "m1",
        sessionID: "s1",
        role: "assistant",
        time: { created: 1, completed: 2 },
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        cost: 0,
      },
      parts,
    })

    expect(coerced.assistant.id).toBe("m1")
    expect(shouldRequestContinuation(parts)).toBe(false)
    expect(shouldRequestContinuation([{ type: "step-finish", reason: "tool-calls" }])).toBe(true)
    expect(shouldRequestContinuation([{ type: "text", text: "partial" }])).toBe(false)
    expect(extractEnvelopeFromParts(parts).envelope).toBeTruthy()
    expect(() => coercePromptResponse({})).toThrow("Unsupported prompt response shape")
  })

  it("extracts immediate prompt response from wrapped promptAsync payload", () => {
    const extracted = extractPromptResponseFromPromptResult({
      data: {
        info: {
          id: "m-immediate",
          sessionID: "s1",
          role: "assistant",
          time: { created: 1, completed: 2 },
          tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0,
        },
        parts: [{ type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' }],
      },
    })

    expect(extracted?.info?.id).toBe("m-immediate")
    expect(extracted?.parts).toHaveLength(1)
  })

  it("extracts prompt response from payload.message wrapper", () => {
    const extracted = extractPromptResponseFromPromptResult({
      data: {
        message: {
          info: {
            id: "m-wrapped",
            sessionID: "s1",
            role: "assistant",
            time: { created: 1, completed: 2 },
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0,
          },
          parts: [{ type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' }],
        },
      },
    })

    expect(extracted?.info?.id).toBe("m-wrapped")
  })

  it("extracts prompt response from assistant+parts payload shape", () => {
    const extracted = extractPromptResponseFromPromptResult({
      data: {
        assistant: {
          id: "m-assistant",
          sessionID: "s1",
          role: "assistant",
          time: { created: 1, completed: 2 },
          tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0,
        },
        parts: [{ type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' }],
      },
    })

    expect(extracted?.info?.id).toBe("m-assistant")
    expect(extracted?.parts).toHaveLength(1)
  })

  it("returns null when promptAsync payload data is not an object", () => {
    const extracted = extractPromptResponseFromPromptResult({ data: "not-an-object" })

    expect(extracted).toBeNull()
  })

  it("extracts envelope from tool output when text parts do not contain JSON", () => {
    const extracted = extractEnvelopeFromParts([
      { type: "text", text: "not json" },
      {
        type: "tool",
        state: {
          output: 'prefix {"ok":true,"data":{"id":"repo"},"error":null,"meta":{}} suffix',
        },
      },
    ])

    expect(extracted.envelope).toEqual({
      ok: true,
      data: { id: "repo" },
      error: null,
      meta: {},
    })
  })

  it("extracts top-level JSON arrays from assistant text", () => {
    const extracted = extractEnvelopeFromParts([
      { type: "text", text: 'noise [{"id":"n1"},{"id":"n2"}] trailing' },
    ])

    expect(extracted.envelope).toEqual([{ id: "n1" }, { id: "n2" }])
  })

  it("extracts primitive arrays when no object appears before first bracket", () => {
    const extracted = extractEnvelopeFromParts([{ type: "text", text: "prefix [1,2,3] suffix" }])

    expect(extracted.envelope).toEqual([1, 2, 3])
  })

  it("falls back from malformed array to object extraction", () => {
    const extracted = extractEnvelopeFromParts([
      { type: "text", text: 'prefix [not-json] then {"ok":true,"data":{},"error":null,"meta":{}}' },
    ])

    expect(extracted.envelope).toEqual({ ok: true, data: {}, error: null, meta: {} })
  })

  it("falls back to object extraction when array payload is never closed", () => {
    const extracted = extractEnvelopeFromParts([{ type: "text", text: 'prefix [{"id":1}' }])

    expect(extracted.envelope).toEqual({ id: 1 })
  })

  it("ignores tool outputs that do not contain parseable JSON", () => {
    const extracted = extractEnvelopeFromParts([
      {
        type: "tool",
        state: {
          output: "plain text only",
        },
      },
    ])

    expect(extracted.envelope).toBeNull()
  })

  it("coerces response with missing metadata using step-finish snapshot", () => {
    const coerced = coercePromptResponse({
      info: {
        id: "m2",
        sessionID: "s2",
        role: "assistant",
      } as never,
      parts: [
        {
          type: "step-finish",
          reason: "done",
          tokens: { input: 5, output: 6, reasoning: 1, cache: { read: 2, write: 3 } },
          cost: 1,
          time: { end: 42 },
        },
      ],
    })

    expect(coerced.assistant.time.completed).toBe(42)
    expect(coerced.assistant.tokens).toEqual({
      input: 5,
      output: 6,
      reasoning: 1,
      cache: { read: 2, write: 3 },
    })
  })

  it("rejects assistant response without completion signals", () => {
    expect(() =>
      coercePromptResponse({
        info: {
          id: "m-empty",
          sessionID: "s-empty",
          role: "assistant",
        } as never,
        parts: [],
      }),
    ).toThrow("Unsupported prompt response shape")
  })

  it("rejects metadata-only assistant response without parts or structured output", () => {
    expect(() =>
      coercePromptResponse({
        info: {
          id: "m-meta-only",
          sessionID: "s-meta-only",
          role: "assistant",
          time: { created: 1, completed: 2 },
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0,
        },
        parts: [],
      }),
    ).toThrow("Unsupported prompt response shape")
  })

  it("times out and resolves with helper", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "x")).resolves.toBe("ok")
    await expect(withTimeout(new Promise(() => {}), 10, "never")).rejects.toThrow(
      "Timeout while waiting for never",
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
            cost: 0,
          },
          parts: [{ type: "text", text: "ok" }],
        },
      ],
    }))
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages,
      abort: vi.fn(),
    }

    const rows = await fetchSessionMessages(sessionApi, "s1")
    expect(rows).toHaveLength(1)

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc1")
    expect(response.info?.id).toBe("m1")
  })

  it("accepts assistant role with text when completion metadata is missing", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-text-only",
              role: "assistant",
            },
            parts: [
              { type: "text", text: '{"ok":true,"data":{"items":[]},"error":null,"meta":{}}' },
            ],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-text-only")
    expect(response.info?.id).toBe("m-text-only")
    expect(response.parts?.[0]).toEqual(expect.objectContaining({ type: "text" }))
  })

  it("accepts assistant structured output from info.structured", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-structured",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
              structured: { ok: true, data: { items: [] }, error: null, meta: {} },
            },
            parts: [{ type: "step-finish", reason: "tool-calls" }],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-structured")
    const coerced = coercePromptResponse(response)

    expect(response.info?.id).toBe("m-structured")
    expect(coerced.assistant.structured_output).toEqual({
      ok: true,
      data: { items: [] },
      error: null,
      meta: {},
    })
  })

  it("waits for assistant after previous id and ignores non-assistant entries", async () => {
    const messages = vi.fn(async () => ({
      data: [
        { parts: [{ type: "text", text: "no-info" }] },
        {
          info: {
            id: "old",
            role: "assistant",
            time: { created: 1, completed: 1 },
            tokens: { input: 1 },
          },
          parts: [{ type: "text", text: "old" }],
        },
        {
          info: { id: "user-msg", role: "user" },
          parts: [{ type: "text", text: "user" }],
        },
        {
          info: {
            id: "new",
            role: "assistant",
            time: { created: 2, completed: 3 },
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0,
          },
          parts: [{ type: "text", text: "new" }],
        },
      ],
    }))
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages,
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-prev", "old")
    expect(response.info?.id).toBe("new")
  })

  it("waits for completed assistant message before returning", async () => {
    let callCount = 0
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => {
        callCount += 1
        if (callCount === 1) {
          return {
            data: [
              {
                info: {
                  id: "m1",
                  role: "assistant",
                },
                parts: [{ type: "text", text: "partial" }],
              },
            ],
          }
        }

        return {
          data: [
            {
              info: {
                id: "m1",
                role: "assistant",
                time: { created: 1, completed: 2 },
                tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0,
              },
              parts: [
                { type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' },
                { type: "step-finish", reason: "stop" },
              ],
            },
          ],
        }
      }),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 1000, "sc-complete")
    expect(response.parts?.[0]).toEqual(
      expect.objectContaining({ text: '{"ok":true,"data":{},"error":null,"meta":{}}' }),
    )
  })

  it("ignores metadata-only assistant entries until content is present", async () => {
    let callCount = 0
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => {
        callCount += 1
        if (callCount === 1) {
          return {
            data: [
              {
                info: {
                  id: "m-meta",
                  role: "assistant",
                  time: { created: 1, completed: 2 },
                  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                  cost: 0,
                },
                parts: [],
              },
            ],
          }
        }

        return {
          data: [
            {
              info: {
                id: "m-meta",
                role: "assistant",
                time: { created: 1, completed: 3 },
                tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0,
              },
              parts: [
                { type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' },
                { type: "step-finish", reason: "stop" },
              ],
            },
          ],
        }
      }),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 1000, "sc-metadata")
    expect(response.parts?.length).toBeGreaterThan(0)
  })

  it("returns continuation on same assistant id when no new assistant id is present", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: "continued response" },
              { type: "step-finish", reason: "done" },
            ],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-cont", "m1")
    expect(response.info?.id).toBe("m1")
    expect(response.parts?.[0]).toEqual(expect.objectContaining({ type: "text" }))
  })

  it("times out waiting for assistant message", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn(),
    }

    await expect(waitForAssistantFromMessages(sessionApi, "s1", 30, "sc-timeout")).rejects.toThrow(
      "Timed out waiting for assistant message",
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
      tags: [],
    })

    const prompt = renderPrompt(
      {
        id: "s",
        name: "n",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template:
          "task={{task}} id={{scenario_id}} input={{input_json}} repo={{fixture_repo}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "a/b" },
        assertions: { must_succeed: true, required_data_fields: ["id"] },
        tags: [],
      },
      "ghx",
    )
    expect(prompt).toContain("GHX_SKIP_GH_PREFLIGHT=1 node ../core/dist/cli/index.js run")
    expect(prompt).toContain("id")
    expect(prompt).toContain("If the ghx command fails")
  })

  it("validates ghx preflight capabilities for selected scenarios", () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      } as never)
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          { capability_id: "repo.view", description: "Repo view" },
          { capability_id: "pr.view", description: "PR view" },
        ]),
        stderr: "",
      } as never)

    expect(() =>
      assertGhxRouterPreflight([
        {
          id: "repo-view-001",
          name: "Repo view",
          task: "repo.view",
          input: {},
          prompt_template: "x",
          timeout_ms: 1000,
          allowed_retries: 0,
          assertions: { must_succeed: true },
          tags: [],
        },
      ]),
    ).not.toThrow()

    expect(spawnSyncMock).toHaveBeenNthCalledWith(1, "gh", ["auth", "status"], { encoding: "utf8" })
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "node",
      [expect.stringContaining("/core/dist/cli/index.js"), "capabilities", "list", "--json"],
      { encoding: "utf8" },
    )
  })

  it("fails ghx preflight when gh auth status fails", () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "not logged in",
    } as never)

    expect(() =>
      assertGhxRouterPreflight([
        {
          id: "repo-view-001",
          name: "Repo view",
          task: "repo.view",
          input: {},
          prompt_template: "x",
          timeout_ms: 1000,
          allowed_retries: 0,
          assertions: { must_succeed: true },
          tags: [],
        },
      ]),
    ).toThrow("ghx_preflight_failed: not logged in")
  })

  it("fails ghx preflight when required capability is unavailable", () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      } as never)
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ capability_id: "repo.view", description: "Repo view" }]),
        stderr: "",
      } as never)

    expect(() =>
      assertGhxRouterPreflight([
        {
          id: "pr-view-001",
          name: "PR view",
          task: "pr.view",
          input: {},
          prompt_template: "x",
          timeout_ms: 1000,
          allowed_retries: 0,
          assertions: { must_succeed: true },
          tags: [],
        },
      ]),
    ).toThrow("ghx_preflight_failed")
  })

  it("returns false when gh command invocation fails", () => {
    spawnSyncMock.mockReturnValue({ status: 1 } as never)

    expect(ghOk(["auth", "status"])).toBe(false)
  })

  it("omits route_used assertions outside ghx mode", () => {
    const prompt = renderPrompt(
      {
        id: "s",
        name: "n",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "task={{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          expected_route_used: "graphql",
          required_meta_fields: ["route_used"],
        },
        tags: [],
      },
      "mcp",
    )

    expect(prompt).not.toContain("meta.route_used MUST be exactly")
    expect(prompt).toContain("The JSON meta object can include optional diagnostic fields.")
  })

  it("drops graphql route expectation in ghx mode when GitHub tokens are missing", () => {
    const previousGithubToken = process.env.GITHUB_TOKEN
    const previousGhToken = process.env.GH_TOKEN
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    try {
      const prompt = renderPrompt(
        {
          id: "s",
          name: "n",
          task: "repo.view",
          input: { owner: "a", name: "b" },
          prompt_template: "task={{task}}",
          timeout_ms: 1000,
          allowed_retries: 0,
          assertions: {
            must_succeed: true,
            expected_route_used: "graphql",
            required_meta_fields: ["route_used"],
          },
          tags: [],
        },
        "ghx",
      )

      expect(prompt).not.toContain("meta.route_used MUST be exactly")
      expect(prompt).toContain("The JSON meta object MUST include: route_used.")
    } finally {
      if (previousGithubToken === undefined) {
        delete process.env.GITHUB_TOKEN
      } else {
        process.env.GITHUB_TOKEN = previousGithubToken
      }

      if (previousGhToken === undefined) {
        delete process.env.GH_TOKEN
      } else {
        process.env.GH_TOKEN = previousGhToken
      }
    }
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
        tags: [],
      }),
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
        tags: [],
      }),
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
        tags: [],
      }),
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
        tags: [],
      }),
    ).toThrow("pr #9 not found")
  })

  it("fails fixture validation when issue is missing", () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0 } as never)
      .mockReturnValueOnce({ status: 1 } as never)

    expect(() =>
      validateFixture({
        id: "s",
        name: "n",
        task: "issue.view",
        input: { issueNumber: 7 },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        fixture: { repo: "owner/repo" },
        assertions: { must_succeed: true },
        tags: [],
      }),
    ).toThrow("issue #7 not found")
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
              cost: 0,
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql","attempts":[{"route":"graphql","status":"success"}]}}',
              },
              { type: "tool", tool: "api-client" },
              {
                type: "step-finish",
                reason: "done",
                tokens: { input: 1, output: 2, reasoning: 3, cache: { read: 0, write: 0 } },
                cost: 0,
                time: { end: 10 },
              },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          require_attempt_trace: true,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
    expect(result.tool_calls).toBeGreaterThan(0)
  })

  it("uses assistant structured_output when no JSON envelope parts are present", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s-structured" } })),
      promptAsync: vi.fn(async () => ({
        data: {
          assistant: {
            id: "m-structured",
            sessionID: "s-structured",
            role: "assistant",
            time: { created: 1, completed: 2 },
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0,
            structured_output: { ok: true, data: { id: "repo" }, error: null, meta: {} },
          },
          parts: [{ type: "step-finish", reason: "done" }],
        },
      })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-structured",
              sessionID: "s-structured",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "step-finish", reason: "done" }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-structured",
        name: "Repo view structured",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("requests continuation until a JSON envelope is returned", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s-cont" } })),
      promptAsync: vi
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: {
            assistant: {
              id: "m2",
              sessionID: "s-cont",
              role: "assistant",
              time: { created: 3, completed: 4 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
            ],
          },
        }),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m1",
              sessionID: "s-cont",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: "partial response without json" },
              { type: "step-finish", reason: "done" },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-continuation",
        name: "Repo view continuation",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(session.promptAsync).toHaveBeenCalledTimes(2)
  })

  it("recovers best valid envelope from session messages when latest envelope is invalid", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s-recover" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-valid",
              sessionID: "s-recover",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
            ],
          },
          {
            info: {
              id: "m-invalid",
              sessionID: "s-recover",
              role: "assistant",
              time: { created: 3, completed: 4 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "text", text: '{"ok":true,"data":{},"error":null,"meta":{}}' }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-recover",
        name: "Repo view recover",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
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
              cost: 0,
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}',
              },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          min_tool_calls: 2,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain("Expected at least 2 tool call")
  })

  it("continues incomplete assistant response and forces one tool call when required", async () => {
    let messageCall = 0
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn(async () => {
        messageCall += 1

        if (messageCall === 1) {
          return {
            data: [
              {
                info: {
                  id: "m1",
                  sessionID: "s1",
                  role: "assistant",
                },
                parts: [{ type: "step-finish", reason: "tool-calls" }],
              },
            ],
          }
        }

        if (messageCall <= 3) {
          return {
            data: [
              {
                info: {
                  id: "m1",
                  sessionID: "s1",
                  role: "assistant",
                  time: { created: 1, completed: 2 },
                  tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                  cost: 0,
                },
                parts: [
                  { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
                  { type: "step-finish", reason: "done" },
                ],
              },
            ],
          }
        }

        return {
          data: [
            {
              info: {
                id: "m2",
                sessionID: "s1",
                role: "assistant",
                time: { created: 3, completed: 4 },
                tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0,
              },
              parts: [
                { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
                { type: "tool", tool: "api-client" },
                { type: "step-finish", reason: "done" },
              ],
            },
          ],
        }
      }),
      abort: vi.fn(async () => ({ data: {} })),
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
          min_tool_calls: 1,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(session.promptAsync.mock.calls.length).toBeGreaterThanOrEqual(2)
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
              cost: 0,
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}',
              },
              { type: "tool", tool: "api-client" },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          max_tool_calls: 0,
        },
        tags: [],
      },
      "ghx",
      1,
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
              cost: 0,
            },
            parts: [
              {
                type: "text",
                text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{"route_used":"graphql"}}',
              },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          require_attempt_trace: true,
        },
        tags: [],
      },
      "ghx",
      1,
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
              cost: 0,
            },
            parts: [
              { type: "text", text: '{"ok":false,"data":[],"error":{"code":"X"},"meta":{}}' },
            ],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          data_type: "object",
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
  })

  it("handles non-object envelopes without throwing", async () => {
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
              cost: 0,
            },
            parts: [{ type: "text", text: "null" }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
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
          require_tool_calls: false,
          data_type: "object",
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(false)
    expect(result.output_valid).toBe(false)
  })

  it("wraps raw data object into a valid envelope for ghx mode", async () => {
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
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "text", text: '{"id":"repo"}' }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-raw",
        name: "Repo view raw",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it.each([
    {
      id: "issues",
      payload:
        '{"data":{"repository":{"issues":{"nodes":[],"pageInfo":{"hasNextPage":true,"endCursor":"c1"}}}}}',
    },
    {
      id: "pull-requests",
      payload:
        '{"data":{"repository":{"pullRequests":{"nodes":[],"pageInfo":{"hasNextPage":false,"endCursor":null}}}}}',
    },
    {
      id: "issue-comments",
      payload:
        '{"data":{"repository":{"issue":{"comments":{"nodes":[],"pageInfo":{"hasNextPage":true,"endCursor":"c2"}}}}}}',
    },
  ])("normalizes %s graphql-style payloads into list envelope", async ({ id, payload }) => {
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
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "text", text: payload }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: `repo-${id}`,
        name: `Repo ${id}`,
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["items", "pageInfo"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("fills missing error field when envelope already has ok/data/meta", async () => {
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
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "text", text: '{"ok":true,"data":{"id":"repo"},"meta":{}}' }],
          },
        ],
      })),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-ok-meta",
        name: "Repo view ok meta",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.output_valid).toBe(true)
  })

  it("returns runner_error row and aborts session on failures", async () => {
    const abort = vi.fn(async () => ({ data: {} }))
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => {
        throw new Error("prompt failed")
      }),
      messages: vi.fn(async () => ({ data: [] })),
      abort,
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
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(false)
    expect(result.error?.type).toBe("runner_error")
    expect(result.external_retry_count).toBe(0)
    expect(abort).toHaveBeenCalled()
  })

  it("retries once for retryable session-message timeouts", async () => {
    const session = {
      create: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "s1" } })
        .mockResolvedValueOnce({ data: { id: "s2" } }),
      promptAsync: vi.fn(async () => ({ data: {} })),
      messages: vi.fn().mockImplementation(async (options: { path?: { id?: string } }) => {
        if (options.path?.id === "s1") {
          return { data: [] }
        }

        return {
          data: [
            {
              info: {
                id: "assistant-1",
                role: "assistant",
                time: { created: 1, completed: 2 },
                tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
                cost: 0,
              },
              parts: [
                { type: "text", text: '{"ok":true,"data":{"id":"repo"},"error":null,"meta":{}}' },
              ],
            },
          ],
        }
      }),
      abort: vi.fn(async () => ({ data: {} })),
    }

    const result = await runScenario(
      { session },
      {
        id: "repo-view-timeout-retry",
        name: "Repo view timeout retry",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "do {{task}}",
        timeout_ms: 10,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          required_fields: ["ok", "data", "error", "meta"],
          required_data_fields: ["id"],
          require_tool_calls: false,
        },
        tags: [],
      },
      "agent_direct",
      1,
    )

    expect(result.success).toBe(true)
    expect(result.external_retry_count).toBe(1)
    expect(session.abort).toHaveBeenCalledTimes(1)
  })

  it("returns runner_error for non-Error failures", async () => {
    const session = {
      create: vi.fn(async () => ({ data: { id: "s1" } })),
      promptAsync: vi.fn(async () => {
        throw "boom"
      }),
      messages: vi.fn(async () => ({ data: [] })),
      abort: vi.fn(async () => ({ data: {} })),
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
        tags: [],
      },
      "ghx",
      1,
    )

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe("boom")
    expect(result.external_retry_count).toBe(0)
  })
})
