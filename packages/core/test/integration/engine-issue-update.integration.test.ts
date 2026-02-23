import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.update", () => {
  it("returns graphql envelope for issue.update", async () => {
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
        // Second call: IssueUpdate mutation
        return {
          updateIssue: {
            issue: {
              id: "issue-id-123",
              number: 210,
              title: "Updated title",
              body: "Updated body",
              state: "OPEN",
            },
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.update",
      input: {
        owner: "acme",
        name: "modkit",
        issueNumber: 210,
        title: "Updated title",
        body: "Updated body",
      },
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
        title: "Updated title",
        state: "OPEN",
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
      task: "issue.update",
      input: { title: "New title" },
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
