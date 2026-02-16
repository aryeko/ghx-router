import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask issue.view", () => {
  it("returns graphql envelope for issue.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueView")) {
          return {
            repository: {
              issue: {
                id: "issue-id",
                number: 210,
                title: "Fix parser edge case",
                state: "OPEN",
                url: "https://github.com/go-modkit/modkit/issues/210",
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.view",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 210 },
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
        number: 210,
        title: "Fix parser edge case",
      }),
    )
  })

  it("returns unknown error envelope for not-found issue", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueView")) {
          return {
            repository: {
              issue: null,
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.view",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 99999 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(result.error?.message).toContain("not found")
  })
})
