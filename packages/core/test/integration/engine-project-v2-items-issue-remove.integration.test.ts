import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.items.issue.remove", () => {
  it("returns validation error envelope for missing projectNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.items.issue.remove",
      input: { owner: "myorg", itemId: "PVTI_abc123" },
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

  it("returns validation error envelope for missing itemId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.items.issue.remove",
      input: { owner: "myorg", projectNumber: 1 },
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

  it("attempts graphql route first and returns not_found error when project lookup returns empty and CLI unavailable", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.items.issue.remove",
      input: { owner: "myorg", projectNumber: 1, itemId: "PVTI_abc123" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    // GQL route is preferred; handler accepts {owner, projectNumber, itemId} and
    // attempts to resolve the project. With empty mock responses, the project
    // lookup finds no matching project → NOT_FOUND error.
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
  })
})
