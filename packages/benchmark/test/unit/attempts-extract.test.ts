import { describe, expect, it } from "vitest"

import { extractAttemptMetrics } from "../../src/extract/attempts.js"

describe("extractAttemptMetrics", () => {
  it("extracts attempt totals and route used", () => {
    const metrics = extractAttemptMetrics({
      ok: true,
      meta: {
        route_used: "graphql",
        attempts: [
          { route: "graphql", status: "error", error_code: "NETWORK" },
          { route: "graphql", status: "success" },
        ],
      },
    })

    expect(metrics).toEqual({
      totalAttempts: 2,
      routeUsed: "graphql",
      retryCount: 1,
    })
  })

  it("returns zeroed metrics when payload has no meta", () => {
    expect(extractAttemptMetrics({})).toEqual({ totalAttempts: 0, routeUsed: null, retryCount: 0 })
  })

  it("ignores non-object attempts and non-string route_used", () => {
    const metrics = extractAttemptMetrics({
      meta: {
        route_used: 42,
        attempts: [null, "bad", { status: "success" }, { status: "error" }],
      },
    })

    expect(metrics).toEqual({
      totalAttempts: 2,
      routeUsed: null,
      retryCount: 1,
    })
  })
})
