import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask repo.issue_types.list", () => {
  it("returns graphql envelope for repo.issue_types.list", async () => {
    const githubClient = {
      fetchRepoIssueTypesList: async () => ({
        items: [
          {
            id: "ISSUE",
            name: "Bug Report",
            color: null,
            isEnabled: true,
          },
          {
            id: "DISCUSSION",
            name: "Discussion",
            color: null,
            isEnabled: true,
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "repo.issue_types.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toMatchObject({
      items: expect.any(Array),
      pageInfo: { hasNextPage: expect.any(Boolean) },
    })
  })

  it("returns validation error envelope for missing name", async () => {
    const githubClient = {
      fetchRepoIssueTypesList: async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "repo.issue_types.list",
      input: {
        owner: "go-modkit",
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
