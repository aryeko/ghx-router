import type { RunnerConfig } from "@bench/runner/config.js"
import {
  hasAssistantMetadata,
  hasAssistantSignalParts,
  hasTextPart,
} from "@bench/runner/session-polling.js"
import {
  asNumber,
  coercePromptResponse,
  evaluateCheckpoint,
  extractPromptResponseFromPromptResult,
  extractSnapshotFromParts,
  extractTimingBreakdown,
  fetchSessionMessages,
  getSessionApi,
  resolveCheckpointData,
  shouldRequestContinuation,
  unwrapData,
  waitForAssistantFromMessages,
  withTimeout,
} from "@bench/runner/suite-runner.js"
import { isObject } from "@bench/utils/guards.js"
import { describe, expect, it, vi } from "vitest"

describe("suite-runner helpers", () => {
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
              { type: "step-finish", reason: "done" },
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

  it("respects config timeouts when calculating budgets", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-config",
              role: "assistant",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [{ type: "text", text: "ok" }],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(
      sessionApi,
      "s1",
      5000,
      "sc-config",
      undefined,
      {
        openCodeMode: null,
        gitRepo: null,
        gitCommit: null,
        firstAssistantTimeoutMs: 1000,
        sessionStallTimeoutMs: 2000,
        maxRunnerRetries: 1,
        runnerRetryBackoffMs: 750,
      } satisfies RunnerConfig,
    )
    expect(response.info?.id).toBe("m-config")
  })

  it("handles timing breakdown with incomplete metadata gracefully", () => {
    const breakdown = extractTimingBreakdown([
      {
        info: {
          role: "assistant",
          time: { created: 100 },
        },
        parts: [
          { type: "reasoning", time: {} },
          {
            type: "tool",
            tool: "bash",
            state: { time: {} },
          },
        ],
      },
    ] as unknown as Parameters<typeof extractTimingBreakdown>[0])

    expect(breakdown.assistant_total_ms).toBe(0)
    expect(breakdown.assistant_reasoning_ms).toBe(0)
    expect(breakdown.tool_total_ms).toBe(0)
  })

  it("extracts timing breakdown with negative durations clamped to zero", () => {
    const breakdown = extractTimingBreakdown([
      {
        info: {
          role: "assistant",
          time: { created: 1000, completed: 500 },
        },
        parts: [
          { type: "reasoning", time: { start: 400, end: 200 } },
          {
            type: "tool",
            tool: "bash",
            state: { time: { start: 600, end: 100 } },
          },
        ],
      },
    ] as unknown as Parameters<typeof extractTimingBreakdown>[0])

    expect(breakdown.assistant_total_ms).toBe(0)
    expect(breakdown.assistant_reasoning_ms).toBe(0)
    expect(breakdown.tool_total_ms).toBe(0)
  })

  it("handles extractSnapshotFromParts with missing object structures", () => {
    const snapshot = extractSnapshotFromParts([
      {
        type: "step-finish",
        tokens: "not-object",
        cost: "not-number",
        time: null,
      },
    ] as unknown as Parameters<typeof extractSnapshotFromParts>[0])

    expect(snapshot.input).toBe(0)
    expect(snapshot.output).toBe(0)
    expect(snapshot.cost).toBe(0)
    expect(snapshot.completed).toBeNull()
  })

  it("handles coercePromptResponse with structured output from info.structured_output", () => {
    const coerced = coercePromptResponse({
      info: {
        id: "m-structured-output",
        sessionID: "s1",
        role: "assistant",
        time: { created: 1, completed: 2 },
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        cost: 0,
        structured_output: { value: "structured" },
      } as never,
      parts: [{ type: "step-finish", reason: "done" }],
    })

    expect(coerced.assistant.structured_output).toEqual({ value: "structured" })
  })

  it("correctly identifies assistant by metadata when role is missing", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-metadata-only",
              time: { created: 1, completed: 2 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: "result" },
              { type: "step-finish", reason: "done" },
            ],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-metadata-id")
    expect(response.info?.id).toBe("m-metadata-only")
  })

  it("detects step-finish with non-completion reason when deciding isCompletedAssistant", async () => {
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
              { type: "step-finish", reason: "error" },
              { type: "text", text: "error occurred" },
            ],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(sessionApi, "s1", 200, "sc-error-finish")
    expect(response.info?.id).toBe("m1")
  })

  it("accepts assistant response with step-finish as completion without completed time", async () => {
    const sessionApi = {
      create: vi.fn(),
      promptAsync: vi.fn(),
      messages: vi.fn(async () => ({
        data: [
          {
            info: {
              id: "m-step-finish-only",
              role: "assistant",
              time: { created: 1 },
              tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
            parts: [
              { type: "text", text: "response" },
              { type: "step-finish", reason: "stop" },
            ],
          },
        ],
      })),
      abort: vi.fn(),
    }

    const response = await waitForAssistantFromMessages(
      sessionApi,
      "s1",
      200,
      "sc-step-finish-only",
    )
    expect(response.info?.id).toBe("m-step-finish-only")
  })
})

describe("checkpoint evaluation", () => {
  describe("resolveCheckpointData", () => {
    it("extracts items array from object with items property", () => {
      const data = { items: [1, 2, 3], other: "field" }
      expect(resolveCheckpointData(data)).toEqual([1, 2, 3])
    })

    it("returns data as-is when items is not an array", () => {
      const data = { items: "not-an-array" }
      expect(resolveCheckpointData(data)).toBe(data)
    })

    it("returns data as-is when no items property", () => {
      const data = { key: "value" }
      expect(resolveCheckpointData(data)).toBe(data)
    })

    it("returns non-object data as-is", () => {
      expect(resolveCheckpointData([1, 2, 3])).toEqual([1, 2, 3])
      expect(resolveCheckpointData("string")).toBe("string")
      expect(resolveCheckpointData(null)).toBe(null)
      expect(resolveCheckpointData(42)).toBe(42)
    })

    it("returns empty items array when items is empty", () => {
      const data = { items: [] }
      expect(resolveCheckpointData(data)).toEqual([])
    })
  })

  describe("evaluateCheckpoint", () => {
    describe("empty condition", () => {
      it("passes when array is empty", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [] })).toBe(true)
      })

      it("passes when data is null", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: null })).toBe(true)
      })

      it("passes when data is undefined", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: undefined })).toBe(true)
      })

      it("fails when array is non-empty", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1] })).toBe(false)
      })

      it("fails when data is non-null object", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { key: "value" } })).toBe(false)
      })

      it("fails when result is not ok", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: false, data: [] })).toBe(false)
      })
    })

    describe("non_empty condition", () => {
      it("passes when array has elements", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2] })).toBe(true)
      })

      it("passes when data is non-null object", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { key: "value" } })).toBe(true)
      })

      it("fails when array is empty", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [] })).toBe(false)
      })

      it("fails when data is null", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: null })).toBe(false)
      })

      it("fails when data is undefined", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: undefined })).toBe(false)
      })

      it("fails when result is not ok", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: false, data: [1] })).toBe(false)
      })
    })

    describe("count_gte condition", () => {
      it("passes when array length is greater than expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: 2,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(true)
      })

      it("passes when array length equals expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: 3,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(true)
      })

      it("fails when array length is less than expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: 5,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(false)
      })

      it("fails when data is not an array", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: 1,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { key: "value" } })).toBe(false)
      })

      it("fails when result is not ok", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: 1,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: false, data: [1, 2] })).toBe(false)
      })

      it("handles string expected value by converting to number", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_gte" as const,
          expected_value: "2",
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(true)
      })
    })

    describe("count_eq condition", () => {
      it("passes when array length exactly matches expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 3,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(true)
      })

      it("fails when array length is greater than expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 2,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(false)
      })

      it("fails when array length is less than expected", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 5,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(false)
      })

      it("fails when data is not an array", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 1,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: "string" })).toBe(false)
      })

      it("fails when result is not ok", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 3,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: false, data: [1, 2, 3] })).toBe(false)
      })

      it("passes with zero count", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 0,
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [] })).toBe(true)
      })
    })

    describe("field_equals condition", () => {
      it("passes when single field matches exactly", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { status: "success" },
        }
        expect(
          evaluateCheckpoint(checkpoint, { ok: true, data: { status: "success", other: "field" } }),
        ).toBe(true)
      })

      it("passes when multiple fields all match", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { status: "success", count: 5 },
        }
        expect(
          evaluateCheckpoint(checkpoint, {
            ok: true,
            data: { status: "success", count: 5, other: "field" },
          }),
        ).toBe(true)
      })

      it("fails when field value does not match", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { status: "failed" },
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { status: "success" } })).toBe(
          false,
        )
      })

      it("fails when expected field is missing in data", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { missing: "field" },
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { status: "success" } })).toBe(
          false,
        )
      })

      it("fails when data is not an object", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { key: "value" },
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2, 3] })).toBe(false)
      })

      it("fails when expected_value is not an object", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: "string",
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { key: "value" } })).toBe(false)
      })

      it("compares nested objects using JSON stringification", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { nested: { key: "value" } },
        }
        expect(
          evaluateCheckpoint(checkpoint, { ok: true, data: { nested: { key: "value" } } }),
        ).toBe(true)
      })

      it("handles numeric field comparison", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { count: 42 },
        }
        expect(evaluateCheckpoint(checkpoint, { ok: true, data: { count: 42 } })).toBe(true)
      })

      it("fails when result is not ok", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "field_equals" as const,
          expected_value: { status: "success" },
        }
        expect(evaluateCheckpoint(checkpoint, { ok: false, data: { status: "success" } })).toBe(
          false,
        )
      })
    })

    it("returns false for unknown condition types", () => {
      const checkpoint = {
        name: "check",
        verification_task: "test",
        verification_input: {},
        condition: "unknown" as never,
      }
      expect(evaluateCheckpoint(checkpoint, { ok: true, data: [1, 2] })).toBe(false)
    })

    describe("integration with resolveCheckpointData", () => {
      it("evaluates checkpoint on resolved items array", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "count_eq" as const,
          expected_value: 2,
        }
        const result = { ok: true, data: { items: [1, 2] } }
        expect(evaluateCheckpoint(checkpoint, result)).toBe(true)
      })

      it("evaluates non_empty checkpoint on items from wrapped response", () => {
        const checkpoint = {
          name: "check",
          verification_task: "test",
          verification_input: {},
          condition: "non_empty" as const,
        }
        const result = { ok: true, data: { items: [{ id: 1 }] } }
        expect(evaluateCheckpoint(checkpoint, result)).toBe(true)
      })
    })
  })
})
