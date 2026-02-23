import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.labels.add", () => {
  it("returns validation error envelope for missing issueNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.labels.add",
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
      task: "issue.labels.add",
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

  it("returns success envelope with labels", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: IssueLabelsLookupByNumber
          const response = {
            repository: {
              issue: {
                id: "MDU6SXNzdWUx",
              },
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
        // Second call: IssueLabelsAdd mutation
        const response = {
          addLabelsToLabelable: {
            labelable: {
              id: "MDU6SXNzdWUx",
              labels: {
                nodes: [{ name: "bug" }, { name: "enhancement" }],
              },
            },
          },
        }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.labels.add",
      input: {
        owner: "acme",
        name: "modkit",
        issueNumber: 42,
        labels: ["bug", "enhancement"],
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
      id: "MDU6SXNzdWUx",
      labels: ["bug", "enhancement"],
    })
  })
})
