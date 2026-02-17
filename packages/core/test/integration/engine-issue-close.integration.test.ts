import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask issue.close", () => {
  it("returns graphql envelope for issue.close", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation IssueClose")) {
          return {
            closeIssue: {
              issue: {
                id: "issue-id-123",
                number: 210,
                state: "CLOSED",
                closed: true,
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.close",
      input: { issueId: "issue-id-123" },
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
        state: "CLOSED",
        closed: true,
      }),
    )
  })

  it("returns validation error envelope for missing issueId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.close",
      input: {},
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })
})
