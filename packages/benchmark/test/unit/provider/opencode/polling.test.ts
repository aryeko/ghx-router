import type { SessionMessageEntry, SessionMessagePart } from "@bench/domain/types.js"
import {
  asNumber,
  fetchSessionMessages,
  getSessionApi,
  hasAssistantMetadata,
  hasAssistantSignal,
  hasAssistantSignalParts,
  hasStructuredOutput,
  hasTextPart,
  messageProgressSignature,
  shouldRequestContinuation,
  withTimeout,
} from "@bench/provider/opencode/polling.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("polling guards and utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("hasAssistantMetadata", () => {
    it("returns false for non-objects", () => {
      expect(hasAssistantMetadata(null)).toBe(false)
      expect(hasAssistantMetadata(undefined)).toBe(false)
      expect(hasAssistantMetadata("string")).toBe(false)
      expect(hasAssistantMetadata(123)).toBe(false)
      expect(hasAssistantMetadata([])).toBe(false)
    })

    it("returns false when time.completed is not a number", () => {
      expect(
        hasAssistantMetadata({
          time: { completed: "not-a-number" },
          tokens: { input: 100 },
        }),
      ).toBe(false)
    })

    it("returns false when tokens.input is not a number", () => {
      expect(
        hasAssistantMetadata({
          time: { completed: 1500 },
          tokens: { input: "not-a-number" },
        }),
      ).toBe(false)
    })

    it("returns true when both time.completed and tokens.input are numbers", () => {
      expect(
        hasAssistantMetadata({
          time: { completed: 1500 },
          tokens: { input: 100 },
        }),
      ).toBe(true)
    })

    it("returns false when only time.completed is present", () => {
      expect(
        hasAssistantMetadata({
          time: { completed: 1500 },
        }),
      ).toBe(false)
    })

    it("returns false when only tokens.input is present", () => {
      expect(
        hasAssistantMetadata({
          tokens: { input: 100 },
        }),
      ).toBe(false)
    })
  })

  describe("hasStructuredOutput", () => {
    it("returns false for non-objects", () => {
      expect(hasStructuredOutput(null)).toBe(false)
      expect(hasStructuredOutput(undefined)).toBe(false)
      expect(hasStructuredOutput("string")).toBe(false)
    })

    it("returns true when structured_output property exists and is not undefined", () => {
      expect(hasStructuredOutput({ structured_output: {} })).toBe(true)
      expect(hasStructuredOutput({ structured_output: null })).toBe(true)
    })

    it("returns false when structured_output is undefined", () => {
      expect(hasStructuredOutput({ structured_output: undefined })).toBe(false)
    })

    it("returns true when structured property exists and is not undefined", () => {
      expect(hasStructuredOutput({ structured: {} })).toBe(true)
      expect(hasStructuredOutput({ structured: null })).toBe(true)
    })

    it("returns false when structured is undefined", () => {
      expect(hasStructuredOutput({ structured: undefined })).toBe(false)
    })

    it("returns false for objects without either property", () => {
      expect(hasStructuredOutput({ foo: "bar" })).toBe(false)
      expect(hasStructuredOutput({})).toBe(false)
    })

    it("returns true if either property is defined and not undefined", () => {
      expect(hasStructuredOutput({ structured_output: {}, other: "data" })).toBe(true)
      expect(hasStructuredOutput({ structured: [], other: "data" })).toBe(true)
    })
  })

  describe("hasAssistantSignalParts", () => {
    it("returns true when parts has a step-finish type", () => {
      const parts: SessionMessagePart[] = [{ type: "step-finish", reason: "end-turn" }]
      expect(hasAssistantSignalParts(parts)).toBe(true)
    })

    it("returns true when parts has a tool type", () => {
      const parts: SessionMessagePart[] = [{ type: "tool", tool: "bash" }]
      expect(hasAssistantSignalParts(parts)).toBe(true)
    })

    it("returns false when parts is empty", () => {
      expect(hasAssistantSignalParts([])).toBe(false)
    })

    it("returns false when parts has only text type", () => {
      const parts: SessionMessagePart[] = [{ type: "text", text: "hello" }]
      expect(hasAssistantSignalParts(parts)).toBe(false)
    })

    it("returns false when parts has other types", () => {
      const parts: SessionMessagePart[] = [{ type: "unknown" }]
      expect(hasAssistantSignalParts(parts)).toBe(false)
    })
  })

  describe("hasTextPart", () => {
    it("returns true when parts has a text part with text property", () => {
      const parts: SessionMessagePart[] = [{ type: "text", text: "hello" }]
      expect(hasTextPart(parts)).toBe(true)
    })

    it("returns false when parts is empty", () => {
      expect(hasTextPart([])).toBe(false)
    })

    it("returns false when parts has no text part", () => {
      const parts: SessionMessagePart[] = [{ type: "tool", tool: "bash" }, { type: "step-finish" }]
      expect(hasTextPart(parts)).toBe(false)
    })

    it("returns false when text part has no text property", () => {
      const parts: SessionMessagePart[] = [{ type: "text" }]
      expect(hasTextPart(parts)).toBe(false)
    })

    it("returns false when text property is not a string", () => {
      const parts = [{ type: "text", text: 123 }] as unknown as SessionMessagePart[]
      expect(hasTextPart(parts)).toBe(false)
    })
  })

  describe("hasAssistantSignal", () => {
    it("returns false when entry.info is null", () => {
      const entry = { info: null } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(false)
    })

    it("returns false when entry.info is undefined", () => {
      const entry = { info: undefined } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(false)
    })

    it("returns true when info has assistant metadata", () => {
      const entry = {
        info: {
          time: { completed: 1500 },
          tokens: { input: 100 },
        },
      } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(true)
    })

    it("returns true when info has role === 'assistant'", () => {
      const entry = {
        info: { role: "assistant" },
      } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(true)
    })

    it("returns true when info has structured_output property", () => {
      const entry = {
        info: { structured_output: {} },
      } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(true)
    })

    it("returns false when info has none of the signals", () => {
      const entry = {
        info: { foo: "bar" },
      } as unknown as SessionMessageEntry
      expect(hasAssistantSignal(entry)).toBe(false)
    })
  })

  describe("messageProgressSignature", () => {
    it("returns empty string for empty array", () => {
      expect(messageProgressSignature([])).toBe("")
    })

    it("creates signature for single message with id and role", () => {
      const messages = [
        {
          info: { id: "msg-1", role: "user" },
          parts: [],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe("msg-1:user:0:<none>")
    })

    it("includes part count in signature", () => {
      const messages = [
        {
          info: { id: "msg-1", role: "assistant" },
          parts: [
            { type: "text", text: "hello" },
            { type: "text", text: "world" },
          ],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe("msg-1:assistant:2:<none>")
    })

    it("includes step-finish reason in signature", () => {
      const messages = [
        {
          info: { id: "msg-1", role: "assistant" },
          parts: [
            { type: "text", text: "hello" },
            { type: "step-finish", reason: "end-turn" },
          ],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe("msg-1:assistant:2:end-turn")
    })

    it("uses most recent step-finish reason", () => {
      const messages = [
        {
          info: { id: "msg-1", role: "assistant" },
          parts: [
            { type: "step-finish", reason: "tool-calls" },
            { type: "step-finish", reason: "end-turn" },
          ],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe("msg-1:assistant:2:end-turn")
    })

    it("separates multiple messages with pipe", () => {
      const messages = [
        {
          info: { id: "msg-1", role: "user" },
          parts: [{ type: "text", text: "hello" }],
        },
        {
          info: { id: "msg-2", role: "assistant" },
          parts: [{ type: "text", text: "world" }],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe(
        "msg-1:user:1:<none>|msg-2:assistant:1:<none>",
      )
    })

    it("handles missing id or role", () => {
      const messages = [
        {
          info: {},
          parts: [],
        },
      ] as unknown as SessionMessageEntry[]
      expect(messageProgressSignature(messages)).toBe("<no-id>:<no-role>:0:<none>")
    })
  })

  describe("shouldRequestContinuation", () => {
    it("returns true when no parts", () => {
      expect(shouldRequestContinuation([])).toBe(true)
    })

    it("returns false when parts has text and no step-finish", () => {
      const parts: SessionMessagePart[] = [{ type: "text", text: "hello" }]
      expect(shouldRequestContinuation(parts)).toBe(false)
    })

    it("returns true when step-finish reason is 'tool-calls'", () => {
      const parts: SessionMessagePart[] = [{ type: "step-finish", reason: "tool-calls" }]
      expect(shouldRequestContinuation(parts)).toBe(true)
    })

    it("returns false when step-finish reason is 'end-turn' and has text", () => {
      const parts: SessionMessagePart[] = [
        { type: "text", text: "hello" },
        { type: "step-finish", reason: "end-turn" },
      ]
      expect(shouldRequestContinuation(parts)).toBe(false)
    })

    it("returns true when step-finish reason is 'end-turn' but no text", () => {
      const parts: SessionMessagePart[] = [{ type: "step-finish", reason: "end-turn" }]
      expect(shouldRequestContinuation(parts)).toBe(true)
    })

    it("returns false when has text and other parts but no step-finish", () => {
      const parts: SessionMessagePart[] = [
        { type: "text", text: "hello" },
        { type: "tool", tool: "bash" },
      ]
      expect(shouldRequestContinuation(parts)).toBe(false)
    })
  })

  describe("withTimeout", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("resolves normally when promise resolves before timeout", async () => {
      const promise = Promise.resolve("success")
      const result = await withTimeout(promise, 5000, "test-label")
      expect(result).toBe("success")
    })

    it("rejects with timeout error when promise takes too long", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve("delayed"), 10000)
      })

      const timeoutPromise = withTimeout(promise, 5000, "test-label")
      vi.advanceTimersByTimeAsync(6000)

      await expect(timeoutPromise).rejects.toThrow(
        "Timeout while waiting for test-label after 5000ms",
      )
    })

    it("includes label in timeout error message", async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve("delayed"), 10000)
      })

      const timeoutPromise = withTimeout(promise, 3000, "my-operation")
      vi.advanceTimersByTimeAsync(4000)

      await expect(timeoutPromise).rejects.toThrow("my-operation")
    })

    it("clears timeout after resolution", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
      const promise = Promise.resolve("success")
      await withTimeout(promise, 5000, "test-label")

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it("clears timeout even after rejection", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
      const promise = Promise.reject(new Error("failed"))

      await expect(withTimeout(promise, 5000, "test-label")).rejects.toThrow("failed")

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe("getSessionApi", () => {
    it("throws 'SDK client has no session API' when client.session is missing", () => {
      expect(() => getSessionApi({})).toThrow("SDK client has no session API")
      expect(() => getSessionApi({ session: null })).toThrow("SDK client has no session API")
    })

    it("throws 'SDK session API missing required methods' when any method is not a function", () => {
      const client = {
        session: {
          create: vi.fn(),
          promptAsync: vi.fn(),
          messages: vi.fn(),
          // abort is missing
        },
      }
      expect(() => getSessionApi(client)).toThrow("SDK session API missing required methods")
    })

    it("returns session API when all methods are present", () => {
      const client = {
        session: {
          create: vi.fn(),
          promptAsync: vi.fn(),
          messages: vi.fn(),
          abort: vi.fn(),
        },
      }
      const api = getSessionApi(client)
      expect(typeof api.create).toBe("function")
      expect(typeof api.messages).toBe("function")
    })
  })

  describe("fetchSessionMessages", () => {
    it("calls sessionApi.messages with correct url/path/query", async () => {
      const messagesMock = vi.fn().mockResolvedValue([{ id: "msg-1" }])
      const sessionApi = {
        create: vi.fn(),
        promptAsync: vi.fn(),
        messages: messagesMock,
        abort: vi.fn(),
      }

      await fetchSessionMessages(sessionApi, "sess-123", 50)

      expect(messagesMock).toHaveBeenCalledWith({
        url: "/session/{id}/message",
        path: { id: "sess-123" },
        query: { limit: 50 },
      })
    })

    it("unwraps {data:[...]} response", async () => {
      const entries = [{ info: { id: "msg-1" }, parts: [] }]
      const messagesMock = vi.fn().mockResolvedValue({ data: entries })
      const sessionApi = {
        create: vi.fn(),
        promptAsync: vi.fn(),
        messages: messagesMock,
        abort: vi.fn(),
      }

      const result = await fetchSessionMessages(sessionApi, "sess-123")
      expect(result).toEqual(entries)
    })
  })

  describe("asNumber", () => {
    it("returns the number for numeric input", () => {
      expect(asNumber(42)).toBe(42)
      expect(asNumber(0)).toBe(0)
      expect(asNumber(-10)).toBe(-10)
      expect(asNumber(3.14)).toBe(3.14)
    })

    it("returns null for non-numeric input", () => {
      expect(asNumber("123")).toBeNull()
      expect(asNumber(null)).toBeNull()
      expect(asNumber(undefined)).toBeNull()
      expect(asNumber(true)).toBeNull()
      expect(asNumber({})).toBeNull()
      expect(asNumber([])).toBeNull()
    })
  })
})
