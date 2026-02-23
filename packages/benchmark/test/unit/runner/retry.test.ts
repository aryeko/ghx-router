import { withRetry } from "@bench/runner/retry.js"
import { describe, expect, it, vi } from "vitest"

describe("withRetry", () => {
  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success")
    const result = await withRetry(fn, { maxAttempts: 3 })
    expect(result).toEqual({ result: "success", attempts: 1 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on failure and succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("success")
    const result = await withRetry(fn, { maxAttempts: 3 })
    expect(result).toEqual({ result: "success", attempts: 2 })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("exhausts retries and throws", async () => {
    const error = new Error("permanent failure")
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow("permanent failure")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("respects custom isRetryable predicate", async () => {
    const retryableError = new Error("retryable")
    const permanentError = new Error("permanent")
    const fn = vi.fn().mockRejectedValueOnce(retryableError).mockRejectedValueOnce(permanentError)

    const isRetryable = (err: unknown) => {
      return err instanceof Error && err.message === "retryable"
    }

    await expect(withRetry(fn, { maxAttempts: 3, isRetryable })).rejects.toThrow("permanent")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("applies exponential backoff", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("success")

    const start = Date.now()
    await withRetry(fn, { maxAttempts: 2, backoffMs: 10 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(10)
  })
})
