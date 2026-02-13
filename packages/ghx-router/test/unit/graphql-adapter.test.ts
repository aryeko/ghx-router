import { describe, expect, it } from "vitest"

import { runGraphqlAdapter } from "../../src/core/execution/adapters/graphql-adapter.js"
import { createGraphqlClient } from "../../src/gql/client.js"

describe("runGraphqlAdapter", () => {
  it("returns success envelope for successful query", async () => {
    const client = createGraphqlClient({
      async execute<TData>(): Promise<TData> {
        return { repository: { name: "modkit" } } as TData
      }
    })

    const result = await runGraphqlAdapter<{ repository: { name: string } }>(client, {
      query: "query { repository(owner: \"go-modkit\", name: \"modkit\") { name } }",
      reason: "output_shape_requirement"
    })

    expect(result.success).toBe(true)
    expect(result.meta.source).toBe("graphql")
    expect(result.meta.reason).toBe("output_shape_requirement")
    expect(result.data?.repository.name).toBe("modkit")
  })

  it("maps GraphQL failures into error envelope", async () => {
    const client = createGraphqlClient({
      async execute(): Promise<never> {
        throw new Error("GraphQL timeout while fetching repository")
      }
    })

    const result = await runGraphqlAdapter(client, {
      query: "query { repository(owner: \"go-modkit\", name: \"modkit\") { name } }"
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("timeout")
    expect(result.error?.details).toEqual({ adapter: "graphql" })
  })
})
