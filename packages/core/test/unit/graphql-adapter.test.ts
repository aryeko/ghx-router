import { describe, expect, it } from "vitest"

import { runGraphqlAdapter } from "../../src/core/execution/adapters/graphql-adapter.js"
import { createGraphqlClient } from "../../src/gql/client.js"

describe("runGraphqlAdapter", () => {
  it("returns success envelope for successful query", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        return { repository: { name: "modkit" } } as TData
      },
    })

    const result = await runGraphqlAdapter<{ repository: { name: string } }>(client, {
      query: 'query { repository(owner: "go-modkit", name: "modkit") { name } }',
      reason: "CARD_PREFERRED",
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.meta.reason).toBe("CARD_PREFERRED")
    expect(result.data?.repository.name).toBe("modkit")
  })

  it("maps GraphQL failures into error envelope", async () => {
    const client = createGraphqlClient({
      async execute(): Promise<never> {
        throw new Error("GraphQL timeout while fetching repository")
      },
    })

    const result = await runGraphqlAdapter(client, {
      query: 'query { repository(owner: "go-modkit", name: "modkit") { name } }',
      capabilityId: "repo.view",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NETWORK")
    expect(result.error?.details).toEqual({ adapter: "graphql" })
  })

  it("maps non-Error failures and uses default capability id", async () => {
    const client = createGraphqlClient({
      async execute(): Promise<never> {
        throw "forbidden"
      },
    })

    const result = await runGraphqlAdapter(client, {
      query: "query { viewer { login } }",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.message).toBe("forbidden")
    expect(result.meta.capability_id).toBe("unknown")
  })
})
