import { describe, expect, it } from "vitest"

import { isRetryableErrorCode } from "../../src/core/errors/retryability.js"

describe("isRetryableErrorCode", () => {
  it("returns true for timeout and infra errors", () => {
    expect(isRetryableErrorCode("timeout")).toBe(true)
    expect(isRetryableErrorCode("infra_error")).toBe(true)
  })

  it("returns false for non-retryable error codes", () => {
    expect(isRetryableErrorCode("validation_failed")).toBe(false)
    expect(isRetryableErrorCode("auth_failed")).toBe(false)
  })
})
