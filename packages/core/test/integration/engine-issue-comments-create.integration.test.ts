import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.comments.create", () => {
  it("returns validation error envelope for missing body", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.comments.create",
      input: { owner: "acme", name: "modkit", issueNumber: 42 },
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

  it("returns validation error envelope for missing issueNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.comments.create",
      input: { owner: "acme", name: "modkit", body: "hello" },
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

  it("returns success envelope with created comment", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: IssueNodeIdLookup
          const response = {
            repository: {
              issue: {
                id: "MDU6SXNzdWUx",
              },
            },
          }
          return response as TData
        }
        // Second call: IssueCommentCreate mutation
        const response = {
          addComment: {
            commentEdge: {
              node: {
                id: "IC_comment123",
                body: "hello from test",
                url: "https://github.com/acme/modkit/issues/42#issuecomment-1",
              },
            },
          },
        }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.comments.create",
      input: {
        owner: "acme",
        name: "modkit",
        issueNumber: 42,
        body: "hello from test",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    if (!result.ok) {
      console.error("Error:", result.error)
    }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      id: "IC_comment123",
      body: "hello from test",
      url: "https://github.com/acme/modkit/issues/42#issuecomment-1",
    })
  })
})
