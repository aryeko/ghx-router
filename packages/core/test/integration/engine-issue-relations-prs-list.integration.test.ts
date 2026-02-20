import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("executeTask issue.relations.prs.list", () => {
  it("returns graphql envelope for issue.relations.prs.list", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query IssueLinkedPrs")) {
          return {
            repository: {
              issue: {
                timelineItems: {
                  nodes: [
                    {
                      source: {
                        number: 232,
                        title: "Fix parser edge case",
                        state: "MERGED",
                        url: "https://github.com/go-modkit/modkit/pull/232",
                      },
                    },
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                },
              },
            },
          } as TData
        }

        throw new Error("Unexpected query")
      },
    })

    const request: TaskRequest = {
      task: "issue.relations.prs.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
        issueNumber: 210,
      },
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
        items: expect.any(Array),
      }),
    )
  })

  it("returns validation error envelope for missing issueNumber", async () => {
    const execute = vi.fn(async () => ({}))
    const githubClient = createGithubClient({
      execute: execute as <TData>() => Promise<TData>,
    })

    const request: TaskRequest = {
      task: "issue.relations.prs.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
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
    expect(execute).not.toHaveBeenCalled()
  })
})
