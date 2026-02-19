import type { TaskRequest } from "@core/core/contracts/task.js"
import { capabilityRegistry } from "@core/core/routing/capability-registry.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it } from "vitest"

describe("executeTask repo.view", () => {
  it("returns cli envelope when cli preflight passes", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      ghCliAvailable: true,
      ghAuthenticated: true,
      cliRunner: {
        run: async () => ({
          stdout: JSON.stringify({
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" },
          }),
          stderr: "",
          exitCode: 0,
        }),
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

  it("auto-detects cli availability and uses cli route", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      cliRunner: {
        run: async (_command, args) => {
          if (args[0] === "--version") {
            return { stdout: "gh version 2.x", stderr: "", exitCode: 0 }
          }

          if (args[0] === "auth" && args[1] === "status") {
            return { stdout: "authenticated", stderr: "", exitCode: 0 }
          }

          return {
            stdout: JSON.stringify({
              id: "repo-id",
              name: "modkit",
              nameWithOwner: "go-modkit/modkit",
              isPrivate: false,
              stargazerCount: 10,
              forkCount: 2,
              url: "https://github.com/go-modkit/modkit",
              defaultBranchRef: { name: "main" },
            }),
            stderr: "",
            exitCode: 0,
          }
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

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
              defaultBranchRef: { name: "main" },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.meta.reason).toBe("CARD_PREFERRED")
    expect(result.data).toEqual(
      expect.objectContaining({
        nameWithOwner: "go-modkit/modkit",
        defaultBranch: "main",
      }),
    )
  })

  it("returns validation error envelope for invalid repo input", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("returns validation error envelope for unsupported task", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "repo.delete",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("Unsupported task")
  })

  it("returns auth error when graphql token is missing and no cli fallback", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
  })

  it("falls back from cli to graphql when cli execution fails", async () => {
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
                defaultBranchRef: { name: "main" },
              },
            } as TData
          }

          throw new Error("Unexpected query")
        },
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: true,
        ghAuthenticated: true,
        cliRunner: {
          run: async () => ({ stdout: "", stderr: "network error", exitCode: 1 }),
        },
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
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
                defaultBranchRef: { name: "main" },
              },
            } as TData
          }

          throw new Error("Unexpected query")
        },
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: false,
        ghAuthenticated: false,
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
    } finally {
      capability.defaultRoute = originalDefaultRoute
      capability.fallbackRoutes = originalFallbackRoutes
    }
  })

  it("falls back to graphql when cli environment detection throws", async () => {
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
              defaultBranchRef: { name: "main" },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      cliRunner: {
        run: async (_command, args) => {
          if (args[0] === "--version") {
            throw new Error("gh unavailable")
          }

          return { stdout: "", stderr: "", exitCode: 0 }
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("falls back to graphql when gh --version exits non-zero", async () => {
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
              defaultBranchRef: { name: "main" },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      cliRunner: {
        run: async (_command, args) => {
          if (args[0] === "--version") {
            return { stdout: "", stderr: "missing gh", exitCode: 1 }
          }

          return { stdout: "", stderr: "", exitCode: 0 }
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("reuses cached cli environment checks across requests for same runner", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const calls: string[] = []
    const cliRunner = {
      run: async (_command: string, args: string[]) => {
        calls.push(args.join(" "))

        if (args[0] === "--version") {
          return { stdout: "gh version", stderr: "", exitCode: 0 }
        }

        if (args[0] === "auth" && args[1] === "status") {
          return { stdout: "ok", stderr: "", exitCode: 0 }
        }

        return {
          stdout: JSON.stringify({
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" },
          }),
          stderr: "",
          exitCode: 0,
        }
      },
    }

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const first = await executeTask(request, { githubClient, cliRunner })
    const second = await executeTask(request, { githubClient, cliRunner })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(calls.filter((call) => call === "--version")).toHaveLength(1)
    expect(calls.filter((call) => call === "auth status")).toHaveLength(1)
  })

  it("skips cli preflight probes when skipGhPreflight is enabled", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const calls: string[] = []
    const cliRunner = {
      run: async (_command: string, args: string[]) => {
        calls.push(args.join(" "))

        return {
          stdout: JSON.stringify({
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" },
          }),
          stderr: "",
          exitCode: 0,
        }
      },
    }

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const result = await executeTask(request, { githubClient, cliRunner, skipGhPreflight: true })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(calls.some((call) => call === "--version")).toBe(false)
    expect(calls.some((call) => call === "auth status")).toBe(false)
    expect(calls.some((call) => call.includes("repo view"))).toBe(true)
  })

  it("reuses in-flight cli environment detection for concurrent requests", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    let releaseVersionProbe: (() => void) | undefined
    const versionProbeSettled = new Promise<void>((resolve) => {
      releaseVersionProbe = resolve
    })

    const calls: string[] = []
    const cliRunner = {
      run: async (_command: string, args: string[]) => {
        calls.push(args.join(" "))

        if (args[0] === "--version") {
          await versionProbeSettled
          return { stdout: "gh version", stderr: "", exitCode: 0 }
        }

        if (args[0] === "auth" && args[1] === "status") {
          return { stdout: "ok", stderr: "", exitCode: 0 }
        }

        return {
          stdout: JSON.stringify({
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" },
          }),
          stderr: "",
          exitCode: 0,
        }
      },
    }

    const request: TaskRequest = {
      task: "repo.view",
      input: { owner: "go-modkit", name: "modkit" },
    }

    const first = executeTask(request, { githubClient, cliRunner })
    const second = executeTask(request, { githubClient, cliRunner })
    releaseVersionProbe?.()

    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult.ok).toBe(true)
    expect(secondResult.ok).toBe(true)
    expect(calls.filter((call) => call === "--version")).toHaveLength(1)
    expect(calls.filter((call) => call === "auth status")).toHaveLength(1)
  })

  it("returns REST unsupported when card fallback explicitly uses rest", async () => {
    const card = (await import("../../src/core/registry/index.js")).getOperationCard("repo.view")
    if (!card) {
      throw new Error("repo.view card missing")
    }

    const originalPreferred = card.routing.preferred
    const originalFallbacks = [...card.routing.fallbacks]

    card.routing.preferred = "rest"
    card.routing.fallbacks = []

    try {
      const githubClient = createGithubClient({
        async execute<TData>(): Promise<TData> {
          return {} as TData
        },
      })

      const request: TaskRequest = {
        task: "repo.view",
        input: { owner: "go-modkit", name: "modkit" },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
        ghCliAvailable: true,
        ghAuthenticated: true,
      })

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
      expect(result.meta.route_used).toBe("rest")
    } finally {
      card.routing.preferred = originalPreferred
      card.routing.fallbacks = originalFallbacks
    }
  })
})
