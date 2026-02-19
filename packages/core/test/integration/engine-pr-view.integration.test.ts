import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.view", () => {
  it("returns graphql envelope for pr.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query PrView")) {
          return {
            repository: {
              pullRequest: {
                id: "pr-id",
                number: 232,
                title: "Add benchmark improvements",
                state: "OPEN",
                url: "https://github.com/go-modkit/modkit/pull/232",
                body: "Improves benchmark throughput and reporting.",
                labels: { nodes: [{ name: "enhancement" }, { name: "benchmark" }] },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "pr.view",
      input: { owner: "go-modkit", name: "modkit", prNumber: 232 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        number: 232,
        title: "Add benchmark improvements",
        body: "Improves benchmark throughput and reporting.",
        labels: ["enhancement", "benchmark"],
      }),
    )
  })

  it("returns validation error envelope for invalid pr input", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.view",
      input: { owner: "go-modkit", name: "modkit", prNumber: 0 },
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
    expect(result.meta.route_used).toBe("graphql")
  })
})
