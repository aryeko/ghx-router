import { describe, expect, it } from "vitest"

import { createGraphqlClient } from "../../src/gql/client.js"

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
})
