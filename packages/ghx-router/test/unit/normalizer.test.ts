import { describe, expect, it } from "vitest"

import { normalizeError, normalizeResult } from "../../src/core/execution/normalizer.js"

describe("normalizer", () => {
  it("normalizes success payloads", () => {
    const result = normalizeResult({ id: 1 }, "graphql", "efficiency_gain")

    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      meta: {
        source: "graphql",
        reason: "efficiency_gain"
      }
    })
  })

  it("normalizes error payloads", () => {
    const result = normalizeError(
      {
        code: "unknown",
        message: "boom",
        retryable: false
      },
      "cli",
      "coverage_gap"
    )

    expect(result).toEqual({
      success: false,
      error: {
        code: "unknown",
        message: "boom",
        retryable: false
      },
      meta: {
        source: "cli",
        reason: "coverage_gap"
      }
    })
  })
})
