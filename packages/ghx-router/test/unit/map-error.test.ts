import { describe, expect, it } from "vitest"

import { mapErrorToCode } from "../../src/core/errors/map-error.js"

describe("mapErrorToCode", () => {
  it("maps auth errors", () => {
    expect(mapErrorToCode(new Error("Unauthorized: token expired"))).toBe("auth_failed")
  })

  it("maps validation errors", () => {
    expect(mapErrorToCode(new Error("Invalid input payload"))).toBe("validation_failed")
  })

  it("maps unknown errors", () => {
    expect(mapErrorToCode(new Error("boom"))).toBe("unknown")
  })
})
