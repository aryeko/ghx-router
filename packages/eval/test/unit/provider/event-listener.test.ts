import { TimeoutError } from "@eval/provider/event-listener.js"
import { describe, expect, it } from "vitest"

describe("TimeoutError", () => {
  it("creates error with correct message", () => {
    const err = new TimeoutError("ses_123", 5000)
    expect(err.message).toContain("ses_123")
    expect(err.message).toContain("5000")
    expect(err.name).toBe("TimeoutError")
    expect(err.sessionId).toBe("ses_123")
    expect(err.timeoutMs).toBe(5000)
  })

  it("is an instance of Error", () => {
    const err = new TimeoutError("ses_abc", 10000)
    expect(err).toBeInstanceOf(Error)
  })

  it("preserves sessionId and timeoutMs as properties", () => {
    const err = new TimeoutError("ses_xyz", 30000)
    expect(err.sessionId).toBe("ses_xyz")
    expect(err.timeoutMs).toBe(30000)
  })
})
