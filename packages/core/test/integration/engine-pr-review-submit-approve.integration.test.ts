import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.reviews.submit", () => {
  it("returns graphql envelope for pr.reviews.submit", async () => {
    const githubClient = {
      submitPrReview: async () => ({
        id: "review-id-123",
        state: "APPROVED",
        url: "https://github.com/go-modkit/modkit/pull/232#pullrequestreview-123",
        body: "Looks good!",
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.reviews.submit",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        event: "APPROVE",
        body: "Looks good!",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("returns validation error envelope for invalid prNumber", async () => {
    const githubClient = {} as GithubClient

    const request: TaskRequest = {
      task: "pr.reviews.submit",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        event: "APPROVE",
        body: "Looks good!",
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
