import { describe, expect, it, vi } from "vitest"

import { execute } from "../../src/core/execute/execute.js"
import type { OperationCard } from "../../src/core/registry/types.js"
import type { RouteSource } from "../../src/core/contracts/envelope.js"

const baseCard: OperationCard = {
  capability_id: "repo.view",
  version: "1.0.0",
  description: "Fetch repository",
  input_schema: {
    type: "object",
    required: ["owner", "name"]
  },
  output_schema: {
    type: "object"
  },
  routing: {
    preferred: "graphql",
    fallbacks: ["cli"]
  }
}

const alwaysPassPreflight = vi.fn(async (_route: RouteSource) => ({ ok: true as const }))

describe("execute", () => {
  it("validates required params from input schema", async () => {
    const result = await execute({
      card: baseCard,
      params: { owner: "acme" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(),
        cli: vi.fn(),
        rest: vi.fn()
      }
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
  })

  it("retries retryable route errors before fallback", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "NETWORK", message: "offline", retryable: true },
        meta: { capability_id: "repo.view", route_used: "graphql" }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "repo-id" },
        meta: { capability_id: "repo.view", route_used: "graphql" }
      })

    const result = await execute({
      card: baseCard,
      params: { owner: "acme", name: "modkit" },
      retry: { maxAttemptsPerRoute: 2 },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli: vi.fn(),
        rest: vi.fn()
      },
      trace: true
    })

    expect(result.ok).toBe(true)
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(result.meta.attempts).toHaveLength(2)
  })

  it("falls back when preferred route preflight fails", async () => {
    const result = await execute({
      card: baseCard,
      params: { owner: "acme", name: "modkit" },
      preflight: vi
        .fn()
        .mockResolvedValueOnce({ ok: false as const, code: "AUTH", message: "missing token", retryable: false })
        .mockResolvedValueOnce({ ok: true as const }),
      routes: {
        graphql: vi.fn(),
        cli: vi.fn(async () => ({
          ok: true,
          data: { id: "repo-id" },
          meta: { capability_id: "repo.view", route_used: "cli" as const }
        })),
        rest: vi.fn()
      },
      trace: true
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.meta.attempts?.[0]).toEqual(
      expect.objectContaining({ route: "graphql", status: "skipped", error_code: "AUTH" })
    )
  })

  it("returns adapter unsupported when route handler missing", async () => {
    const result = await execute({
      card: baseCard,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: undefined as unknown as never,
        cli: undefined as unknown as never,
        rest: vi.fn()
      },
      trace: true
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(result.meta.attempts?.length).toBeGreaterThan(0)
  })

  it("returns schema mismatch when output misses required fields", async () => {
    const card: OperationCard = {
      ...baseCard,
      output_schema: {
        type: "object",
        required: ["id"]
      }
    }

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(async () => ({
          ok: true,
          data: {},
          meta: { capability_id: "repo.view", route_used: "graphql" as const }
        })),
        cli: vi.fn(),
        rest: vi.fn()
      }
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("Output schema mismatch")
  })

  it("returns non-retryable route errors with trace attempts", async () => {
    const result = await execute({
      card: baseCard,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(async () => ({
          ok: false,
          error: { code: "VALIDATION" as const, message: "bad input", retryable: false },
          meta: { capability_id: "repo.view", route_used: "graphql" as const }
        })),
        cli: vi.fn(),
        rest: vi.fn()
      },
      trace: true
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.attempts).toEqual([
      expect.objectContaining({ route: "graphql", status: "error", error_code: "VALIDATION" })
    ])
  })
})
