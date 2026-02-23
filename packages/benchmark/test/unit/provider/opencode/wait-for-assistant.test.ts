import type { SessionMessageEntry } from "@bench/domain/types.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchSessionMessagesMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/provider/opencode/polling.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bench/provider/opencode/polling.js")>()
  return { ...actual, fetchSessionMessages: fetchSessionMessagesMock }
})

import { waitForAssistantFromMessages } from "@bench/provider/opencode/wait-for-assistant.js"

function makeSessionApi() {
  return {
    create: vi.fn(),
    promptAsync: vi.fn(),
    messages: vi.fn(),
    abort: vi.fn(),
  }
}

function makeCompletedAssistantEntry(id = "msg-1"): SessionMessageEntry {
  return {
    info: {
      id,
      role: "assistant",
      time: { created: 1000, completed: 2000 },
      tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
      cost: 0.01,
    },
    parts: [{ type: "step-finish", reason: "end_turn" }],
  } as unknown as SessionMessageEntry
}

describe("waitForAssistantFromMessages", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns response immediately when complete assistant found", async () => {
    const sessionApi = makeSessionApi()
    const entry = makeCompletedAssistantEntry()
    fetchSessionMessagesMock.mockResolvedValue([entry])

    const promise = waitForAssistantFromMessages(sessionApi, "sess-1", 30000, "scenario-1")
    // No timer advancement needed - finds the assistant immediately on first poll
    await vi.advanceTimersByTimeAsync(0)
    const result = await promise

    expect(result.info).toBeDefined()
    expect(result.parts).toBeDefined()
  })

  it("throws 'Timed out waiting for assistant message' when outer timeout exceeded", async () => {
    const sessionApi = makeSessionApi()
    // Return empty messages — no assistant to find
    fetchSessionMessagesMock.mockResolvedValue([])

    const timeoutMs = 300
    const promise = waitForAssistantFromMessages(sessionApi, "sess-1", timeoutMs, "scenario-1")
    // Attach rejection handler before advancing timers to prevent unhandled rejection warning
    void promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(timeoutMs + 100)
    await expect(promise).rejects.toThrow("Timed out waiting for assistant message")
  })

  it("with previousAssistantId: filters old message and returns new assistant", async () => {
    const sessionApi = makeSessionApi()
    const oldEntry = makeCompletedAssistantEntry("old-id")
    const newEntry = makeCompletedAssistantEntry("new-id")
    fetchSessionMessagesMock.mockResolvedValue([oldEntry, newEntry])

    const promise = waitForAssistantFromMessages(
      sessionApi,
      "sess-1",
      30000,
      "scenario-1",
      "old-id",
    )
    await vi.advanceTimersByTimeAsync(0)
    const result = await promise

    expect((result.info as { id?: string })?.id).toBe("new-id")
  })

  it("with previousAssistantId: detects continuedSameMessage (same id, step-finish end_turn)", async () => {
    const sessionApi = makeSessionApi()
    const sameEntry: SessionMessageEntry = {
      info: {
        id: "same-id",
        role: "assistant",
        time: { created: 1000, completed: 2000 },
        tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
        cost: 0.01,
      },
      parts: [{ type: "step-finish", reason: "end_turn" }],
    } as unknown as SessionMessageEntry

    fetchSessionMessagesMock.mockResolvedValue([sameEntry])

    const promise = waitForAssistantFromMessages(
      sessionApi,
      "sess-1",
      30000,
      "scenario-1",
      "same-id",
    )
    await vi.advanceTimersByTimeAsync(0)
    const result = await promise

    expect((result.info as { id?: string })?.id).toBe("same-id")
  })

  it("skips entries without info and uses empty parts when parts field is missing", async () => {
    const sessionApi = makeSessionApi()

    let callCount = 0
    fetchSessionMessagesMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve([
          // Entry with no info field → line 118 !entry.info true → return false
          {
            parts: [{ type: "step-finish", reason: "end_turn" }],
          } as unknown as SessionMessageEntry,
          // Entry with info but no parts field → line 123 entry.parts ?? [] fallback
          {
            info: {
              id: "no-parts-id",
              role: "assistant",
              time: { created: 1000, completed: 2000 },
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              cost: 0,
            },
          } as unknown as SessionMessageEntry,
        ])
      }
      return Promise.resolve([makeCompletedAssistantEntry()])
    })

    const promise = waitForAssistantFromMessages(sessionApi, "sess-1", 30000, "scenario-1")
    await vi.advanceTimersByTimeAsync(600)
    const result = await promise

    expect(result.info).toBeDefined()
  })

  it("logs 'waiting' to console after 5000ms elapsed", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const sessionApi = makeSessionApi()

    // Iterations at 300ms steps:
    // Iteration 18 fires at t=5100ms → log fires (5100 >= 5000)
    // Iteration 19 fires at t=5400ms → return completed (callCount=19 > 18)
    let callCount = 0
    fetchSessionMessagesMock.mockImplementation(() => {
      callCount++
      if (callCount > 18) {
        return Promise.resolve([makeCompletedAssistantEntry()])
      }
      // Return different messages each time to avoid stall detection
      return Promise.resolve([
        {
          info: { id: `msg-${callCount}`, role: "assistant" },
          parts: [{ type: "step-finish", reason: "tool-calls" }],
        } as unknown as SessionMessageEntry,
      ])
    })

    const promise = waitForAssistantFromMessages(sessionApi, "sess-1", 30000, "scenario-1")
    // Advance 5700ms: enough for 19 iterations (19 * 300 = 5700ms) to let the log fire
    await vi.advanceTimersByTimeAsync(5700)
    await promise

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[benchmark] waiting: session=sess-1"),
    )

    consoleSpy.mockRestore()
  })
})
