import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalFetch = globalThis.fetch

describe("createTokenTransport", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_GRAPHQL_URL", "https://test.example.com/graphql")
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  async function importTransport() {
    // Re-import to pick up env changes
    return import("@core/gql/transport.js")
  }

  function mockFetchResponse(body: unknown, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as typeof fetch
  }

  describe("execute", () => {
    it("returns data on clean response", async () => {
      mockFetchResponse({ data: { viewer: { login: "octocat" } } })
      const { createTokenTransport } = await importTransport()
      const transport = createTokenTransport("ghp_test")

      const result = await transport.execute("query { viewer { login } }")
      expect(result).toEqual({ viewer: { login: "octocat" } })
    })

    it("throws on GraphQL errors (backward compat)", async () => {
      mockFetchResponse({
        data: { viewer: null },
        errors: [{ message: "Field 'foo' doesn't exist" }],
      })
      const { createTokenTransport } = await importTransport()
      const transport = createTokenTransport("ghp_test")

      await expect(transport.execute("query { viewer { foo } }")).rejects.toThrow(
        "Field 'foo' doesn't exist",
      )
    })

    it("throws on HTTP error", async () => {
      mockFetchResponse({ message: "Bad credentials" }, 401)
      const { createTokenTransport } = await importTransport()
      const transport = createTokenTransport("ghp_test")

      await expect(transport.execute("query { viewer { login } }")).rejects.toThrow(
        "Bad credentials",
      )
    })
  })

  describe("executeRaw", () => {
    async function createTransportWithRaw(token: string) {
      const { createTokenTransport } = await importTransport()
      const transport = createTokenTransport(token)
      expect(transport.executeRaw).toBeDefined()
      // Safe to cast — createTokenTransport always provides executeRaw
      return transport as Required<typeof transport>
    }

    it("returns { data, errors: undefined } on clean response", async () => {
      mockFetchResponse({ data: { viewer: { login: "octocat" } } })
      const transport = await createTransportWithRaw("ghp_test")

      const result = await transport.executeRaw("query { viewer { login } }")
      expect(result).toEqual({
        data: { viewer: { login: "octocat" } },
        errors: undefined,
      })
    })

    it("returns { data, errors } on partial success without throwing", async () => {
      mockFetchResponse({
        data: { step0: { issue: { id: "I1" } }, step1: null },
        errors: [{ message: "Not found", path: ["step1", "createIssue"] }],
      })
      const transport = await createTransportWithRaw("ghp_test")

      const result = await transport.executeRaw("mutation { ... }")
      expect(result.data).toEqual({ step0: { issue: { id: "I1" } }, step1: null })
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.message).toBe("Not found")
      expect(result.errors?.[0]?.path).toEqual(["step1", "createIssue"])
    })

    it("throws on HTTP error (same as execute)", async () => {
      mockFetchResponse({ message: "Unauthorized" }, 401)
      const transport = await createTransportWithRaw("ghp_test")

      await expect(transport.executeRaw("query { viewer { login } }")).rejects.toThrow(
        "Unauthorized",
      )
    })
  })
})
