import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.org.view", () => {
  it("returns graphql envelope for project_v2.org.view", async () => {
    const githubClient = {
      fetchProjectV2OrgView: async () => ({
        id: "PVT_1",
        title: "My Project",
        shortDescription: "desc",
        public: true,
        closed: false,
        url: "https://github.com/orgs/myorg/projects/1",
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "project_v2.org.view",
      input: {
        org: "myorg",
        projectNumber: 1,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("returns validation error envelope for missing number", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.org.view",
      input: { org: "my-org" },
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
