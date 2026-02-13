import { describe, expect, it } from "vitest"

import { preflightCheck } from "../../src/core/execution/preflight.js"

describe("preflightCheck", () => {
  it("passes graphql route when token exists", () => {
    const result = preflightCheck({ route: "graphql", githubToken: "token" })
    expect(result).toEqual({ ok: true })
  })

  it("fails graphql route when token missing", () => {
    const result = preflightCheck({ route: "graphql", githubToken: "" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("auth_failed")
      expect(result.details).toEqual({ route: "graphql" })
    }
  })

  it("passes cli route without token", () => {
    const result = preflightCheck({ route: "cli", githubToken: "" })
    expect(result).toEqual({ ok: true })
  })
})
