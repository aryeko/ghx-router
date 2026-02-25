import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.branch.update", () => {
  it("returns graphql envelope for pr.branch.update", async () => {
    const githubClient = {
      updatePrBranch: async () => ({
        prNumber: 232,
        updated: true,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.branch.update",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toMatchObject({
      prNumber: 232,
      updated: true,
    })
  })

  it("returns validation error envelope for invalid prNumber", async () => {
    const githubClient = {
      updatePrBranch: async () => ({
        prNumber: 0,
        updated: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.branch.update",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
      },
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
