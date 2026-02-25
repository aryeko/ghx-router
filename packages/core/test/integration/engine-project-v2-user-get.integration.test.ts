import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.user.view", () => {
  it("returns graphql envelope for project_v2.user.view", async () => {
    const githubClient = {
      fetchProjectV2UserView: async () => ({
        id: "PVT_2",
        title: "User Project",
        shortDescription: null,
        public: false,
        closed: false,
        url: null,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "project_v2.user.view",
      input: {
        user: "myuser",
        projectNumber: 2,
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
      task: "project_v2.user.view",
      input: { user: "my-user" },
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
