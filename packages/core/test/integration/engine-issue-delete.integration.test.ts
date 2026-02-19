import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it, vi } from "vitest"

describe("executeTask issue.delete", () => {
  it("returns graphql envelope for issue.delete", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation IssueDelete")) {
          return {
            deleteIssue: {
              clientMutationId: "mutation-id",
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.delete",
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
  })

  it("returns validation error envelope for missing issueId", async () => {
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
