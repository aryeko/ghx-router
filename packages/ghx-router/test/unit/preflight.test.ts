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
      expect(result.code).toBe("AUTH")
      expect(result.details).toEqual({ route: "graphql" })
    }
  })

  it("passes cli route without token", () => {
    const result = preflightCheck({ route: "cli", githubToken: "" })
    expect(result).toEqual({ ok: true })
  })

  it("fails cli route when gh CLI is unavailable", () => {
    const result = preflightCheck({ route: "cli", ghCliAvailable: false })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION")
      expect(result.message).toContain("GitHub CLI")
    }
  })

  it("fails cli route when gh CLI is not authenticated", () => {
    const result = preflightCheck({ route: "cli", ghCliAvailable: true, ghAuthenticated: false })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("AUTH")
      expect(result.message).toContain("authentication")
    }
  })

  it("reports rest route as unimplemented", () => {
    const result = preflightCheck({ route: "rest" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("ADAPTER_UNSUPPORTED")
      expect(result.message).toContain("not implemented")
      expect(result.details).toEqual({ route: "rest" })
    }
  })
})
