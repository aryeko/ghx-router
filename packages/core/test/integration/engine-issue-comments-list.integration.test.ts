import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.comments.list", () => {
  it("returns graphql envelope for issue.comments.list", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueCommentsList")) {
          return {
            repository: {
              issue: {
                comments: {
                  nodes: [
                    {
                      id: "comment-1",
                      body: "First comment",
                      createdAt: "2025-01-01T00:00:00Z",
                      url: "https://github.com/go-modkit/modkit/issues/101#issuecomment-1",
                      author: { login: "octocat" },
                    },
                  ],
                  pageInfo: {
                    endCursor: "cursor-1",
                    hasNextPage: false,
                  },
                },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.comments.list",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 101, first: 10 },
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
        items: [expect.objectContaining({ id: "comment-1", authorLogin: "octocat" })],
        pageInfo: {
          endCursor: "cursor-1",
          hasNextPage: false,
        },
      }),
    )
  })
})
