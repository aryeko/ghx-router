import { describe, expect, it } from "vitest"

import { mapErrorToCode } from "../../src/core/errors/map-error.js"

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
})
