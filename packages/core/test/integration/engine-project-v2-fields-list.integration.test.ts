import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.fields.list", () => {
  it("returns graphql envelope for project_v2.fields.list", async () => {
    const githubClient = {
      fetchProjectV2FieldsList: async () => ({
        items: [{ id: "F_1", name: "Status", dataType: "SINGLE_SELECT" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "project_v2.fields.list",
      input: {
        owner: "myorg",
        projectNumber: 1,
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

  it("returns validation error envelope for missing projectId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.fields.list",
      input: {},
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
