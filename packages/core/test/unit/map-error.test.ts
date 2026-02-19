import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { describe, expect, it } from "vitest"

describe("mapErrorToCode", () => {
  it("maps auth errors", () => {
    expect(mapErrorToCode(new Error("Unauthorized: token expired"))).toBe("AUTH")
  })

  it("maps validation errors", () => {
    expect(mapErrorToCode(new Error("Invalid input payload"))).toBe("VALIDATION")
  })

  it("maps unknown errors", () => {
    expect(mapErrorToCode(new Error("boom"))).toBe("UNKNOWN")
  })

  it("maps network errors", () => {
    expect(mapErrorToCode(new Error("ECONNRESET while calling GitHub"))).toBe("NETWORK")
  })

  it("maps rate limit errors", () => {
    expect(mapErrorToCode(new Error("GitHub API returned 429"))).toBe("RATE_LIMIT")
  })

  it("maps server errors", () => {
    expect(mapErrorToCode(new Error("upstream returned 503"))).toBe("SERVER")
  })

  it("maps server error at start of message", () => {
    expect(mapErrorToCode(new Error("500 Internal Server Error"))).toBe("SERVER")
  })

  it("maps server error with no leading space", () => {
    expect(mapErrorToCode(new Error("HTTP/1.1 502"))).toBe("SERVER")
  })

  it("maps 504 gateway timeout", () => {
    expect(mapErrorToCode(new Error("504 Gateway Timeout"))).toBe("SERVER")
  })

  it("maps not-found even when message contains 'auth'", () => {
    expect(mapErrorToCode(new Error("auth endpoint: not found"))).toBe("NOT_FOUND")
  })

  it("maps not-found for 404 even with 'auth' in message", () => {
    expect(mapErrorToCode(new Error("auth route returned 404"))).toBe("NOT_FOUND")
  })

  it("maps auth even when message contains 'invalid'", () => {
    expect(mapErrorToCode(new Error("invalid authorization header"))).toBe("AUTH")
  })

  it("maps unauthorized to auth over validation", () => {
    expect(mapErrorToCode(new Error("Unauthorized: invalid token"))).toBe("AUTH")
  })
})
