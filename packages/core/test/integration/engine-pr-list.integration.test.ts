import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.list", () => {
  it("returns graphql envelope for pr.list", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query PrList")) {
          return {
            repository: {
              pullRequests: {
                nodes: [
                  {
                    id: "pr-1",
                    number: 201,
                    title: "First PR",
                    state: "OPEN",
                    url: "https://github.com/go-modkit/modkit/pull/201",
                  },
                ],
                pageInfo: {
                  endCursor: "cursor-pr-1",
                  hasNextPage: true,
                },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "pr.list",
      input: { owner: "go-modkit", name: "modkit", first: 1 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ number: 201 })],
        pageInfo: {
          endCursor: "cursor-pr-1",
          hasNextPage: true,
        },
      }),
    )
  })
})
