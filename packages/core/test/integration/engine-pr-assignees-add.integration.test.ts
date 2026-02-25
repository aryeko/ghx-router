import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.assignees.add", () => {
  it("routes to graphql and returns ok result", async () => {
    const githubClient = {
      addPrAssignees: async () => ({
        prNumber: 10,
        added: ["user1"],
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.assignees.add",
      input: {
        owner: "acme",
        name: "modkit",
        prNumber: 10,
        assignees: ["user1"],
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("returns validation error envelope for missing prNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.assignees.add",
      input: { owner: "acme", name: "modkit", assignees: ["user1"] },
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

  it("returns validation error envelope for missing assignees", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.assignees.add",
      input: { owner: "acme", name: "modkit", prNumber: 10 },
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
