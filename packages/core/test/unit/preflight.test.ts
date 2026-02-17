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
    expect(result).toHaveProperty("code", "AUTH")
    expect(result).toHaveProperty("details", { route: "graphql" })
  })

  it("passes cli route without token", () => {
    const result = preflightCheck({ route: "cli", githubToken: "" })
    expect(result).toEqual({ ok: true })
  })

  it("fails cli route when gh CLI is unavailable", () => {
    const result = preflightCheck({ route: "cli", ghCliAvailable: false })
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty("code", "ADAPTER_UNSUPPORTED")
    expect(result).toHaveProperty("message", expect.stringContaining("GitHub CLI"))
  })

  it("fails cli route when gh CLI is not authenticated", () => {
    const result = preflightCheck({ route: "cli", ghCliAvailable: true, ghAuthenticated: false })
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty("code", "AUTH")
    expect(result).toHaveProperty("message", expect.stringContaining("authentication"))
  })

  it("reports rest route as unimplemented", () => {
    const result = preflightCheck({ route: "rest" })
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty("code", "ADAPTER_UNSUPPORTED")
    expect(result).toHaveProperty("message", expect.stringContaining("not implemented"))
    expect(result).toHaveProperty("details", { route: "rest" })
  })
})
