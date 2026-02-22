import type { SessionMessageEntry, SessionMessagePart } from "@bench/domain/types.js"
import { describe, expect, it } from "vitest"
import {
  coercePromptResponse,
  extractPromptResponseFromPromptResult,
  extractSnapshotFromParts,
  extractTimingBreakdown,
} from "../../../../src/provider/opencode/extraction.js"

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
  })
})
