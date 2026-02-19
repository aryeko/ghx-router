import type { ResultEnvelope, RouteSource } from "@core/core/contracts/envelope.js"
import { execute } from "@core/core/execute/execute.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { describe, expect, it, vi } from "vitest"

const baseCard: OperationCard = {
  capability_id: "repo.view",
  version: "1.0.0",
  description: "Fetch repository",
  input_schema: {
    type: "object",
    required: ["owner", "name"],
    properties: {
      owner: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
  output_schema: {
    type: "object",
  },
  routing: {
    preferred: "graphql",
    fallbacks: ["cli"],
  },
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
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        ajvErrors: expect.any(Array),
      }),
    )
  })

  it("validates full input schema, not only required keys", async () => {
    const result = await execute({
      card: baseCard,
      params: { owner: 123, name: "modkit" } as unknown as Record<string, unknown>,
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(),
        cli: vi.fn(),
        rest: vi.fn(),
      },
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
        meta: { capability_id: "repo.view", route_used: "graphql" },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "repo-id" },
        meta: { capability_id: "repo.view", route_used: "graphql" },
      })

    const result = await execute({
      card: baseCard,
      params: { owner: "acme", name: "modkit" },
      retry: { maxAttemptsPerRoute: 2 },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli: vi.fn(),
        rest: vi.fn(),
      },
      trace: true,
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
        .mockResolvedValueOnce({
          ok: false as const,
          code: "AUTH",
          message: "missing token",
          retryable: false,
        })
        .mockResolvedValueOnce({ ok: true as const }),
      routes: {
        graphql: vi.fn(),
        cli: vi.fn(async () => ({
          ok: true,
          data: { id: "repo-id" },
          meta: { capability_id: "repo.view", route_used: "cli" as const },
        })),
        rest: vi.fn(),
      },
      trace: true,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.meta.attempts?.[0]).toEqual(
      expect.objectContaining({ route: "graphql", status: "skipped", error_code: "AUTH" }),
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
        rest: vi.fn(),
      },
      trace: true,
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
        required: ["id"],
      },
    }

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(async () => ({
          ok: true,
          data: {},
          meta: { capability_id: "repo.view", route_used: "graphql" as const },
        })),
        cli: vi.fn(),
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
    expect(result.error?.message).toContain("Output schema validation failed")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        ajvErrors: expect.any(Array),
      }),
    )
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
          meta: { capability_id: "repo.view", route_used: "graphql" as const },
        })),
        cli: vi.fn(),
        rest: vi.fn(),
      },
      trace: true,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.attempts).toEqual([
      expect.objectContaining({ route: "graphql", status: "error", error_code: "VALIDATION" }),
    ])
  })

  it("supports suitability rules that override preferred route", async () => {
    const cardWithSuitability: OperationCard = {
      ...baseCard,
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
        suitability: [
          {
            when: "params",
            predicate: "cli if owner == acme",
            reason: "Prefer CLI for acme repos",
          },
        ],
      },
    }

    const cli = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const result = await execute({
      card: cardWithSuitability,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli,
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(true)
    expect(cli).toHaveBeenCalledTimes(1)
    expect(graphql).not.toHaveBeenCalled()
  })

  it("supports suitability rules with env predicates and inequality", async () => {
    const cardWithSuitability: OperationCard = {
      ...baseCard,
      routing: {
        preferred: "cli",
        fallbacks: ["graphql"],
        suitability: [
          {
            when: "env",
            predicate: "graphql if env.githubTokenPresent == true",
            reason: "Prefer GraphQL when token exists",
          },
          {
            when: "params",
            predicate: "cli if params.owner != octocat",
            reason: "Use CLI for non-octocat repos",
          },
        ],
      },
    }

    const cli = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const result = await execute({
      card: cardWithSuitability,
      params: { owner: "acme", name: "modkit" },
      routingContext: { githubTokenPresent: true },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli,
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(true)
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(cli).not.toHaveBeenCalled()
  })

  it("supports always suitability route and false/null/number predicate values", async () => {
    const cli = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "cli" as const },
    }))
    const graphql = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const alwaysCard: OperationCard = {
      ...baseCard,
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
        suitability: [{ when: "always", predicate: "CLI", reason: "Always prefer cli" }],
      },
    }

    const alwaysResult = await execute({
      card: alwaysCard,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: { graphql, cli, rest: vi.fn() },
    })

    expect(alwaysResult.ok).toBe(true)
    expect(cli).toHaveBeenCalledTimes(1)

    const conditionalCard: OperationCard = {
      ...baseCard,
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
        suitability: [
          {
            when: "env",
            predicate: "cli if env.featureFlag == false",
            reason: "False boolean parse",
          },
          { when: "env", predicate: "cli if env.selected == null", reason: "Null parse" },
          { when: "env", predicate: "cli if env.batchSize == 2", reason: "Number parse" },
        ],
      },
    }

    const conditionalResult = await execute({
      card: conditionalCard,
      params: { owner: "acme", name: "modkit" },
      routingContext: { featureFlag: false, selected: null, batchSize: 2 },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(),
        cli: vi.fn(async () => ({
          ok: true,
          data: { id: "repo-id" },
          meta: { capability_id: "repo.view", route_used: "cli" as const },
        })),
        rest: vi.fn(),
      },
    })

    expect(conditionalResult.ok).toBe(true)
    expect(conditionalResult.meta.route_used).toBe("cli")
  })

  it("falls back to preferred route when suitability path cannot be resolved", async () => {
    const graphql = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const result = await execute({
      card: {
        ...baseCard,
        routing: {
          preferred: "graphql",
          fallbacks: ["cli"],
          suitability: [
            {
              when: "params",
              predicate: "cli if params.owner.name == octocat",
              reason: "owner is a string, nested path is unresolved",
            },
          ],
        },
      },
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli: vi.fn(),
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(true)
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it("falls back to card preferred route when suitability predicate is malformed", async () => {
    const cardWithMalformedRule: OperationCard = {
      ...baseCard,
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
        suitability: [
          {
            when: "params",
            predicate: "this is not parseable",
            reason: "Ignore invalid rule",
          },
        ],
      },
    }

    const graphql = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const result = await execute({
      card: cardWithMalformedRule,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql,
        cli: vi.fn(),
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(true)
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it("skips routes with missing handlers and keeps attempts trace", async () => {
    const result = await execute({
      card: {
        ...baseCard,
        routing: {
          preferred: "cli",
          fallbacks: ["graphql"],
        },
      },
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(async () => ({
          ok: true,
          data: { id: "repo-id" },
          meta: { capability_id: "repo.view", route_used: "graphql" as const },
        })),
        cli: undefined as unknown as (params: Record<string, unknown>) => Promise<ResultEnvelope>,
        rest: vi.fn(),
      },
      trace: true,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "cli",
          status: "skipped",
          error_code: "ADAPTER_UNSUPPORTED",
        }),
      ]),
    )
  })

  it("handles adapter-unsupported route errors by falling back", async () => {
    const result = await execute({
      card: {
        ...baseCard,
        routing: {
          preferred: "cli",
          fallbacks: ["graphql"],
        },
      },
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      routes: {
        graphql: vi.fn(async () => ({
          ok: true,
          data: { id: "repo-id" },
          meta: { capability_id: "repo.view", route_used: "graphql" as const },
        })),
        cli: vi.fn(async () => ({
          ok: false,
          error: { code: "ADAPTER_UNSUPPORTED" as const, message: "unsupported", retryable: false },
          meta: { capability_id: "repo.view", route_used: "cli" as const },
        })),
        rest: vi.fn(),
      },
      trace: true,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "cli",
          status: "error",
          error_code: "ADAPTER_UNSUPPORTED",
        }),
        expect.objectContaining({ route: "graphql", status: "success" }),
      ]),
    )
  })

  it("attaches attempts to traced output-validation errors", async () => {
    const card: OperationCard = {
      ...baseCard,
      output_schema: {
        type: "object",
        required: ["id"],
      },
    }

    const result = await execute({
      card,
      params: { owner: "acme", name: "modkit" },
      preflight: alwaysPassPreflight,
      trace: true,
      routes: {
        graphql: vi.fn(async () => ({
          ok: true,
          data: {},
          meta: { capability_id: "repo.view", route_used: "graphql" as const },
        })),
        cli: vi.fn(),
        rest: vi.fn(),
      },
    })

    expect(result.ok).toBe(false)
    expect(result.meta.attempts).toEqual([
      expect.objectContaining({ route: "graphql", status: "success" }),
    ])
  })
})
