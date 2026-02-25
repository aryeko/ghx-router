import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.labels.remove", () => {
  it("returns validation error envelope for missing issueNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.labels.remove",
      input: { owner: "acme", name: "modkit", labels: ["bug"] },
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

  it("returns validation error envelope for missing labels", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.labels.remove",
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

  it("returns success envelope with removed labels", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: IssueLabelsLookupByNumber
          const response = {
            repository: {
              issue: { id: "MDU6SXNzdWUx" },
              labels: {
                nodes: [
                  { id: "MDEyOkxhYmVsODk=", name: "bug" },
                  { id: "MDEyOkxhYmVsOTA=", name: "enhancement" },
                ],
              },
            },
          }
          return response as TData
        }
        // Second call: IssueLabelsRemove mutation
        const response = {
          removeLabelsFromLabelable: {
            labelable: { id: "MDU6SXNzdWUx" },
          },
        }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.labels.remove",
      input: { owner: "acme", name: "modkit", issueNumber: 42, labels: ["bug"] },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ issueNumber: 42, removed: ["bug"] })
  })
})
