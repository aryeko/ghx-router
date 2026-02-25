import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask repo.labels.list", () => {
  it("returns graphql envelope for repo.labels.list", async () => {
    const githubClient = {
      fetchRepoLabelsList: async () => ({
        items: [
          {
            id: "label-1",
            name: "bug",
            description: "Bug report",
            color: "FF0000",
            isDefault: false,
          },
          {
            id: "label-2",
            name: "feature",
            description: "Feature request",
            color: "00FF00",
            isDefault: false,
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "repo.labels.list",
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
      fetchRepoLabelsList: async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "repo.labels.list",
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
