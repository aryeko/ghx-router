import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.close", () => {
  it("returns graphql envelope for issue.close", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: IssueNodeIdLookup
          return {
            repository: {
              issue: { id: "issue-id-123" },
            },
          } as TData
        }
        // Second call: IssueClose mutation
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
      },
    })

    const request: TaskRequest = {
      task: "issue.close",
      input: { owner: "acme", name: "modkit", issueNumber: 210 },
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

  it("returns validation error envelope for missing owner", async () => {
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
