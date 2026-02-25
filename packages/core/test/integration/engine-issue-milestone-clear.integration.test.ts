import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.milestone.clear", () => {
  it("returns validation error envelope for missing issueNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.milestone.clear",
      input: { owner: "acme", name: "modkit" },
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

  it("routes via graphql and returns not-found when issue lookup returns empty data", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.milestone.clear",
      input: { owner: "acme", name: "modkit", issueNumber: 42 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
  })

  it("returns success envelope with cleared milestone", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: IssueNodeIdLookup
          const response = {
            repository: { issue: { id: "MDU6SXNzdWUx" } },
          }
          return response as TData
        }
        // Second call: IssueMilestoneSet with milestoneId: null
        const response = {
          updateIssue: { issue: { id: "MDU6SXNzdWUx", milestone: null } },
        }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.milestone.clear",
      input: { owner: "acme", name: "modkit", issueNumber: 42 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ issueNumber: 42, cleared: true })
  })
})
