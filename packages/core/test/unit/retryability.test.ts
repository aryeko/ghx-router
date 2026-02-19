import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { describe, expect, it } from "vitest"

describe("isRetryableErrorCode", () => {
  it("returns true for network, rate-limit and server errors", () => {
    expect(isRetryableErrorCode("NETWORK")).toBe(true)
    expect(isRetryableErrorCode("RATE_LIMIT")).toBe(true)
    expect(isRetryableErrorCode("SERVER")).toBe(true)
  })

  it("returns false for non-retryable error codes", () => {
    expect(isRetryableErrorCode("VALIDATION")).toBe(false)
    expect(isRetryableErrorCode("AUTH")).toBe(false)
  })
})
