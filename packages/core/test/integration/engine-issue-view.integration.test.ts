import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it } from "vitest"

describe("executeTask issue.view", () => {
  it("returns graphql envelope for issue.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueView")) {
          return {
            repository: {
              issue: {
                id: "issue-id",
                number: 210,
                title: "Fix parser edge case",
                state: "OPEN",
                url: "https://github.com/go-modkit/modkit/issues/210",
                body: "Fix the parser edge case for multiline strings",
                labels: { nodes: [{ name: "bug" }, { name: "parser" }] },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.view",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 210 },
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
        number: 210,
        title: "Fix parser edge case",
        body: "Fix the parser edge case for multiline strings",
        labels: ["bug", "parser"],
      }),
    )
  })

  it("returns validation error envelope for invalid issue input", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.view",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 0 },
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

  it("returns unknown error envelope for not-found issue", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueView")) {
          return {
            repository: {
              issue: null,
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.view",
      input: { owner: "go-modkit", name: "modkit", issueNumber: 99999 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(result.error?.message).toContain("not found")
  })
})
