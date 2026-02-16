import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask issue.list", () => {
  it("returns graphql envelope for issue.list", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueList")) {
          return {
            repository: {
              issues: {
                nodes: [
                  {
                    id: "issue-1",
                    number: 101,
                    title: "First issue",
                    state: "OPEN",
                    url: "https://github.com/go-modkit/modkit/issues/101",
                  },
                  {
                    id: "issue-2",
                    number: 102,
                    title: "Second issue",
                    state: "OPEN",
                    url: "https://github.com/go-modkit/modkit/issues/102",
                  },
                ],
                pageInfo: {
                  endCursor: "cursor-2",
                  hasNextPage: false,
                },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.list",
      input: { owner: "go-modkit", name: "modkit", first: 2 },
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
        items: expect.arrayContaining([
          expect.objectContaining({ number: 101 }),
          expect.objectContaining({ number: 102 }),
        ]),
        pageInfo: {
          endCursor: "cursor-2",
          hasNextPage: false,
        },
      }),
    )
  })
})
