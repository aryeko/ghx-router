import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { capabilityRegistry } from "../../src/core/routing/capability-registry.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask repo.view", () => {
  it("returns graphql envelope for repo.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query RepoView")) {
          return {
            repository: {
              id: "repo-id",
              name: "modkit",
              nameWithOwner: "go-modkit/modkit",
              isPrivate: false,
              stargazerCount: 10,
              forkCount: 2,
              url: "https://github.com/go-modkit/modkit",
              defaultBranchRef: { name: "main" }
            }
          } as TData
        }

        throw new Error("Unexpected query")
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, { githubClient, githubToken: "test-token" })

    expect(result.success).toBe(true)
    expect(result.meta.source).toBe("graphql")
    expect(result.meta.reason).toBe("output_shape_requirement")
    expect(result.data).toEqual(
      expect.objectContaining({
        nameWithOwner: "go-modkit/modkit",
        defaultBranch: "main"
      })
    )
  })

  it("returns validation error envelope for invalid repo input", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "", name: "modkit" }
    }

    const result = await executeTask(request, { githubClient, githubToken: "test-token" })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("validation_failed")
    expect(result.meta.source).toBe("graphql")
  })

  it("returns validation error envelope for unsupported task", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.delete",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, { githubClient, githubToken: "test-token" })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("validation_failed")
    expect(result.error?.message).toContain("Unsupported task")
  })

  it("returns auth error when graphql token is missing", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      }
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" }
    }

    const result = await executeTask(request, { githubClient, githubToken: "" })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("auth_failed")
    expect(result.error?.message).toContain("token")
  })

  it("falls back from non-graphql route to graphql when configured", async () => {
    const capability = capabilityRegistry.find((entry) => entry.task === "repo.view")
    if (!capability) {
      throw new Error("repo.view capability missing")
    }

    const originalDefaultRoute = capability.defaultRoute
    const originalFallbackRoutes = [...capability.fallbackRoutes]

    capability.defaultRoute = "cli"
    capability.fallbackRoutes = ["graphql", "rest"]

    try {
      const githubClient = createGithubClient({
        async execute<TData>(query: string): Promise<TData> {
          if (query.includes("query RepoView")) {
            return {
              repository: {
                id: "repo-id",
                name: "modkit",
                nameWithOwner: "go-modkit/modkit",
                isPrivate: false,
                stargazerCount: 10,
                forkCount: 2,
                url: "https://github.com/go-modkit/modkit",
                defaultBranchRef: { name: "main" }
              }
            } as TData
          }

          throw new Error("Unexpected query")
        }
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" }
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: true,
        ghAuthenticated: true
      })

      expect(result.success).toBe(true)
      expect(result.meta.source).toBe("graphql")
    } finally {
      capability.defaultRoute = originalDefaultRoute
      capability.fallbackRoutes = originalFallbackRoutes
    }
  })

  it("continues to graphql when cli preflight fails and fallback exists", async () => {
    const capability = capabilityRegistry.find((entry) => entry.task === "repo.view")
    if (!capability) {
      throw new Error("repo.view capability missing")
    }

    const originalDefaultRoute = capability.defaultRoute
    const originalFallbackRoutes = [...capability.fallbackRoutes]

    capability.defaultRoute = "cli"
    capability.fallbackRoutes = ["graphql"]

    try {
      const githubClient = createGithubClient({
        async execute<TData>(query: string): Promise<TData> {
          if (query.includes("query RepoView")) {
            return {
              repository: {
                id: "repo-id",
                name: "modkit",
                nameWithOwner: "go-modkit/modkit",
                isPrivate: false,
                stargazerCount: 10,
                forkCount: 2,
                url: "https://github.com/go-modkit/modkit",
                defaultBranchRef: { name: "main" }
              }
            } as TData
          }

          throw new Error("Unexpected query")
        }
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" }
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: false,
        ghAuthenticated: false
      })

      expect(result.success).toBe(true)
      expect(result.meta.source).toBe("graphql")
    } finally {
      capability.defaultRoute = originalDefaultRoute
      capability.fallbackRoutes = originalFallbackRoutes
    }
  })
})
