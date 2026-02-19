import { normalizeError, normalizeResult } from "@core/core/execution/normalizer.js"
import { describe, expect, it } from "vitest"

describe("normalizer", () => {
  it("normalizes success payloads", () => {
    const result = normalizeResult({ id: 1 }, "graphql", {
      capabilityId: "issue.view",
      reason: "CARD_PREFERRED",
    })

    expect(result).toEqual({
      ok: true,
      data: { id: 1 },
      meta: {
        capability_id: "issue.view",
        route_used: "graphql",
        reason: "CARD_PREFERRED",
      },
    })
  })

  it("normalizes error payloads", () => {
    const result = normalizeError(
      {
        code: "UNKNOWN",
        message: "boom",
        retryable: false,
      },
      "cli",
      {
        capabilityId: "issue.view",
        reason: "CARD_FALLBACK",
      },
    )

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "boom",
        retryable: false,
      },
      meta: {
        capability_id: "issue.view",
        route_used: "cli",
        reason: "CARD_FALLBACK",
      },
    })
  })
})
