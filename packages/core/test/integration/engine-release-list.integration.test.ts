import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask release.list", () => {
  it("returns graphql envelope for release.list", async () => {
    const githubClient = {
      fetchReleaseList: async () => ({
        items: [
          {
            id: 1,
            tagName: "v1.0.0",
            name: "Version 1.0.0",
            isDraft: false,
            isPrerelease: false,
            url: "https://github.com/go-modkit/modkit/releases/tag/v1.0.0",
            targetCommitish: "abc123",
            createdAt: "2024-01-01T00:00:00Z",
            publishedAt: "2024-01-01T00:00:00Z",
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "release.list",
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
      fetchReleaseList: async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "release.list",
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
