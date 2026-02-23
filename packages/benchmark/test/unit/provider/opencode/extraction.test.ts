import type { SessionMessageEntry, SessionMessagePart } from "@bench/domain/types.js"
import {
  aggregateToolCounts,
  coercePromptResponse,
  extractPromptResponseFromPromptResult,
  extractSnapshotFromParts,
  extractTimingBreakdown,
} from "@bench/provider/opencode/extraction.js"
import { describe, expect, it } from "vitest"

describe("extraction", () => {
  describe("extractTimingBreakdown", () => {
    it("handles empty messages array", () => {
      const result = extractTimingBreakdown([])
      expect(result.assistant_total_ms).toBe(0)
      expect(result.tool_total_ms).toBe(0)
    })

    it("handles messages with no info", () => {
      const messages: SessionMessageEntry[] = [
        {
          parts: [],
        },
      ]
      const result = extractTimingBreakdown(messages)
      expect(result.assistant_total_ms).toBe(0)
    })

    it("calculates timing from assistant messages", () => {
      const messages = [
        {
          info: {
            role: "assistant",
            time: { created: 1000, completed: 2000 },
          },
          parts: [],
        },
      ] as unknown as SessionMessageEntry[]
      const result = extractTimingBreakdown(messages)
      expect(result.assistant_total_ms).toBe(1000)
      expect(result.observed_assistant_turns).toBe(1)
    })
  })

  describe("extractSnapshotFromParts", () => {
    it("returns zeros when no step-finish part", () => {
      const parts: SessionMessagePart[] = []
      const result = extractSnapshotFromParts(parts)
      expect(result.input).toBe(0)
      expect(result.output).toBe(0)
      expect(result.completed).toBeNull()
    })

    it("extracts tokens from step-finish part", () => {
      const parts: SessionMessagePart[] = [
        {
          type: "step-finish",
          reason: "end_turn",
          tokens: { input: 100, output: 200, reasoning: 50, cache: { read: 10, write: 20 } },
          time: { start: 1000, end: 2000 },
        },
      ]
      const result = extractSnapshotFromParts(parts)
      expect(result.input).toBe(100)
      expect(result.output).toBe(200)
      expect(result.completed).toBe(2000)
    })
  })

  describe("coercePromptResponse", () => {
    it("throws when response has no usable metadata", () => {
      const response = {
        parts: [],
      }
      expect(() => coercePromptResponse(response as Record<string, unknown>)).toThrow()
    })

    it("coerces valid prompt response", () => {
      const response = {
        info: {
          id: "test",
          sessionID: "sess",
          role: "assistant",
          time: { created: 1000, completed: 2000 },
          tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 0, write: 0 } },
          cost: 0.1,
        },
        parts: [
          {
            type: "step-finish",
            reason: "end_turn",
            tokens: { input: 5, output: 10, reasoning: 2, cache: { read: 0, write: 0 } },
            time: { start: 1000, end: 2000 },
          },
        ],
      }
      const result = coercePromptResponse(response)
      expect(result.assistant.id).toBe("test")
      expect(result.assistant.tokens.input).toBe(10)
    })
  })

  describe("extractPromptResponseFromPromptResult", () => {
    it("returns null for non-object input", () => {
      const result = extractPromptResponseFromPromptResult("not an object")
      expect(result).toBeNull()
    })

    it("unwraps data wrapper", () => {
      const wrapped = {
        data: {
          info: {
            id: "test",
            sessionID: "sess",
            role: "assistant",
            time: { created: 1000, completed: 2000 },
            tokens: { input: 10, output: 20, reasoning: 5, cache: { read: 0, write: 0 } },
            cost: 0.1,
          },
          parts: [],
        },
      }
      const result = extractPromptResponseFromPromptResult(wrapped)
      expect(result).not.toBeNull()
      expect(result?.info?.id).toBe("test")
    })

    it("returns response when payload has {assistant, parts} shape", () => {
      const payload = {
        data: {
          assistant: {
            id: "asst-1",
            sessionID: "sess",
            time: { created: 1000, completed: 2000 },
            tokens: { input: 5, output: 10, reasoning: 0, cache: { read: 0, write: 0 } },
            cost: 0.05,
          },
          parts: [{ type: "text", text: "hello" }],
        },
      }
      const result = extractPromptResponseFromPromptResult(payload)
      expect(result).not.toBeNull()
      expect(result?.info).toBeDefined()
      expect(result?.parts).toHaveLength(1)
    })

    it("returns response when payload has message.info shape", () => {
      const payload = {
        data: {
          message: {
            info: {
              id: "msg-1",
              sessionID: "sess",
              time: { created: 1000, completed: 2000 },
              tokens: { input: 5, output: 10, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0.05,
            },
            parts: [],
          },
        },
      }
      const result = extractPromptResponseFromPromptResult(payload)
      expect(result).not.toBeNull()
    })
  })

  describe("aggregateToolCounts", () => {
    it("returns {toolCalls:0, apiCalls:0} for empty messages", () => {
      const result = aggregateToolCounts([])
      expect(result.toolCalls).toBe(0)
      expect(result.apiCalls).toBe(0)
    })

    it("counts tool parts across messages", () => {
      const messages = [
        {
          parts: [
            { type: "tool", tool: "bash" },
            { type: "text", text: "hello" },
          ],
        },
        {
          parts: [{ type: "tool", tool: "bash" }],
        },
      ] as unknown as SessionMessageEntry[]
      const result = aggregateToolCounts(messages)
      expect(result.toolCalls).toBe(2)
    })

    it("counts apiCalls for tools with 'api' in name", () => {
      const messages = [
        {
          parts: [
            { type: "tool", tool: "gh-api-call" },
            { type: "tool", tool: "bash" },
          ],
        },
      ] as unknown as SessionMessageEntry[]
      const result = aggregateToolCounts(messages)
      expect(result.apiCalls).toBe(1)
    })

    it("counts apiCalls for tools with 'http' in name", () => {
      const messages = [
        {
          parts: [{ type: "tool", tool: "http-request" }],
        },
      ] as unknown as SessionMessageEntry[]
      const result = aggregateToolCounts(messages)
      expect(result.apiCalls).toBe(1)
    })

    it("ignores non-tool parts", () => {
      const messages = [
        {
          parts: [
            { type: "text", text: "hello" },
            { type: "step-finish", reason: "end_turn" },
            { type: "reasoning" },
          ],
        },
      ] as unknown as SessionMessageEntry[]
      const result = aggregateToolCounts(messages)
      expect(result.toolCalls).toBe(0)
      expect(result.apiCalls).toBe(0)
    })
  })

  describe("coercePromptResponse - additional branches", () => {
    it("handles textOnlySignal path (text part + no step-finish reason=tool-calls)", () => {
      const response = {
        info: {
          id: "test-id",
          sessionID: "sess",
          time: { created: 1000 },
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0.01,
        },
        parts: [{ type: "text", text: "some response" }],
      }
      const result = coercePromptResponse(response)
      expect(result.assistant.id).toBe("test-id")
    })

    it("falls back to snapshot tokens when info.tokens are missing", () => {
      const response = {
        info: {
          id: "test-id",
          sessionID: "sess",
          time: { created: 1000 },
          tokens: {
            input: null,
            output: null,
            reasoning: null,
            cache: { read: null, write: null },
          },
          cost: 0.01,
        },
        parts: [
          {
            type: "step-finish",
            reason: "end_turn",
            tokens: { input: 5, output: 15, reasoning: 2, cache: { read: 1, write: 2 } },
            time: { start: 1000, end: 2000 },
          },
        ],
      }
      const result = coercePromptResponse(
        response as unknown as Parameters<typeof coercePromptResponse>[0],
      )
      expect(result.assistant.tokens.input).toBe(5)
    })

    it("uses fallback id/sessionID/cost when info fields are missing", () => {
      // info without id/sessionID/cost - should fall back to value.id, value.sessionID
      const response = {
        id: "fallback-id",
        sessionID: "fallback-sess",
        info: {
          // no id, no sessionID, no cost
          time: { created: 1000, completed: 2000 },
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: [{ type: "step-finish", reason: "end_turn" }],
      }
      const result = coercePromptResponse(
        response as unknown as Parameters<typeof coercePromptResponse>[0],
      )
      expect(result.assistant.id).toBe("fallback-id")
      expect(result.assistant.sessionID).toBe("fallback-sess")
    })

    it("uses 'assistant-unknown' when no id in info or value", () => {
      const response = {
        // no id at top level either
        info: {
          time: { created: 1000, completed: 2000 },
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
        },
        parts: [{ type: "step-finish", reason: "end_turn" }],
      }
      const result = coercePromptResponse(
        response as unknown as Parameters<typeof coercePromptResponse>[0],
      )
      expect(result.assistant.id).toBe("assistant-unknown")
      expect(result.assistant.sessionID).toBe("session-unknown")
    })

    it("uses Date.now() when info.time.created is null", () => {
      const before = Date.now()
      const response = {
        info: {
          id: "test",
          sessionID: "sess",
          time: { created: null, completed: 2000 },
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0.01,
        },
        parts: [{ type: "step-finish", reason: "end_turn" }],
      }
      const result = coercePromptResponse(
        response as unknown as Parameters<typeof coercePromptResponse>[0],
      )
      expect(result.assistant.time.created).toBeGreaterThanOrEqual(before)
    })

    it("uses structured fallback from info.structured property", () => {
      const response = {
        info: {
          id: "test",
          sessionID: "sess",
          time: { created: 1000, completed: 2000 },
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
          cost: 0.01,
          structured: { answer: 42 },
        },
        parts: [{ type: "step-finish", reason: "end_turn" }],
      }
      const result = coercePromptResponse(
        response as unknown as Parameters<typeof coercePromptResponse>[0],
      )
      expect(result.assistant.structured_output).toEqual({ answer: 42 })
    })

    it("throws with 'non-object' label when value is an array (not a plain object)", () => {
      // Arrays pass the `value.parts ?? []` check but fail isObject → triggers "non-object" label
      expect(() =>
        coercePromptResponse([] as unknown as Parameters<typeof coercePromptResponse>[0]),
      ).toThrow("non-object")
    })
  })

  describe("extractSnapshotFromParts - missing tokens/time branches", () => {
    it("returns zeros when step-finish has no tokens object", () => {
      const parts: SessionMessagePart[] = [
        {
          type: "step-finish",
          reason: "end_turn",
          // no tokens, no time
        },
      ]
      const result = extractSnapshotFromParts(parts)
      expect(result.input).toBe(0)
      expect(result.cacheRead).toBe(0)
      expect(result.completed).toBeNull()
    })

    it("returns zeros for cache when tokens has no cache object", () => {
      const parts: SessionMessagePart[] = [
        {
          type: "step-finish",
          reason: "end_turn",
          tokens: { input: 10, output: 20 }, // no cache
        },
      ]
      const result = extractSnapshotFromParts(parts)
      expect(result.cacheRead).toBe(0)
      expect(result.cacheWrite).toBe(0)
    })
  })

  describe("extractPromptResponseFromPromptResult - additional branches", () => {
    it("returns payload directly when it has only info property (no parts)", () => {
      const payload = {
        data: {
          info: {
            id: "msg-1",
            sessionID: "sess",
            time: { created: 1000 },
            tokens: { input: 5, output: 10, reasoning: 0, cache: { read: 0, write: 0 } },
          },
          // no 'parts' array
        },
      }
      const result = extractPromptResponseFromPromptResult(payload)
      expect(result).not.toBeNull()
    })

    it("returns payload directly when it has only parts array (no info)", () => {
      const payload = {
        data: {
          // no info
          parts: [{ type: "text", text: "hello" }],
        },
      }
      const result = extractPromptResponseFromPromptResult(payload)
      expect(result).not.toBeNull()
    })

    it("returns null when payload has no recognizable shape", () => {
      const payload = { data: { foo: "bar" } }
      const result = extractPromptResponseFromPromptResult(payload)
      expect(result).toBeNull()
    })
  })

  describe("aggregateToolCounts - tool without name", () => {
    it("handles tool parts with undefined tool name", () => {
      const messages = [
        {
          parts: [{ type: "tool" }], // no tool name
        },
      ] as unknown as SessionMessageEntry[]
      const result = aggregateToolCounts(messages)
      expect(result.toolCalls).toBe(1)
      expect(result.apiCalls).toBe(0)
    })
  })
})
