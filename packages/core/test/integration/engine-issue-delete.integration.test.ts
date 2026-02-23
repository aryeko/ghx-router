import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("executeTask issue.delete", () => {
  it("returns graphql envelope for issue.delete", async () => {
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
        // Second call: IssueDelete mutation
        return {
          deleteIssue: {
            clientMutationId: "mutation-id",
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.delete",
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
  })

  it("returns validation error envelope for missing owner", async () => {
    const execute = vi.fn(async () => ({}))
    const githubClient = createGithubClient({
      execute: execute as <TData>() => Promise<TData>,
    })

    const request: TaskRequest = {
      task: "issue.delete",
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
    expect(execute).not.toHaveBeenCalled()
  })
})
