import { createGithubClientFromToken } from "@core/gql/github-client.js"
import { createGraphqlClient } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

describe("createGraphqlClient", () => {
  it("executes query via provided transport", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        return { ok: true } as TData
      },
    })

    const result = await client.query<{ ok: boolean }>("query { viewer { login } }")

    expect(result.ok).toBe(true)
  })

  it("rejects empty query text", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    await expect(client.query("   ")).rejects.toThrow("GraphQL query must be non-empty")
  })

  it("handles GraphQL errors from transport", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        throw new Error("GraphQL returned errors")
      },
    })

    await expect(client.query("query { viewer { login } }")).rejects.toThrow(
      "GraphQL returned errors",
    )
  })

  it("handles network errors from transport", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        throw new Error("fetch failed")
      },
    })

    await expect(client.query("query { viewer { login } }")).rejects.toThrow("fetch failed")
  })
})

describe("createGithubClientFromToken", () => {
  it("creates client from token string", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { repository: { id: "repo-1" } } }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    expect(client).toBeDefined()
    expect(client.query).toBeDefined()
  })

  it("creates client from options object", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { repository: { id: "repo-1" } } }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken({
      token: "test-token",
      graphqlUrl: "https://api.github.com/graphql",
    })
    expect(client).toBeDefined()
    expect(client.query).toBeDefined()
  })

  it("rejects empty token string", () => {
    expect(() => createGithubClientFromToken("")).toThrow("GitHub token is required")
  })

  it("rejects whitespace-only token", () => {
    expect(() => createGithubClientFromToken("   ")).toThrow("GitHub token is required")
  })

  it("rejects empty token in options object", () => {
    expect(() => createGithubClientFromToken({ token: "" })).toThrow("GitHub token is required")
  })

  it("handles HTTP error responses", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("invalid-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("Bad credentials")
  })

  it("handles missing data in GraphQL response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ errors: undefined }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("GraphQL response missing data")
  })

  it("handles GraphQL error array in response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        errors: [{ message: "Field 'viewer' is invalid" }],
      }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("Field 'viewer' is invalid")
  })

  it("handles GraphQL error without message", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        errors: [{}],
      }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("GraphQL returned errors")
  })

  it("handles HTTP 401 unauthorized response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("invalid-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("Bad credentials")
  })

  it("handles HTTP 403 forbidden response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "API rate limit exceeded" }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("API rate limit exceeded")
  })

  it("handles HTTP 500 server error response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal server error" }),
    }))
    global.fetch = mockFetch as unknown as typeof fetch

    const client = createGithubClientFromToken("test-token")
    const queryPromise = client.query("query { viewer { login } }")

    await expect(queryPromise).rejects.toThrow("Internal server error")
  })

  it("uses custom graphqlUrl when provided in options", () => {
    const client = createGithubClientFromToken({
      token: "test-token",
      graphqlUrl: "https://github.enterprise.com/api/graphql",
    })
    expect(client).toBeDefined()
  })
})
