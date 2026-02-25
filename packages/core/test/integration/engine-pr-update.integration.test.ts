import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.update", () => {
  it("returns graphql envelope for pr.update", async () => {
    const githubClient = {
      updatePr: async () => ({
        number: 1,
        url: "https://github.com/owner/repo/pull/1",
        title: "Updated title",
        state: "OPEN",
        draft: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.update",
      input: {
        owner: "owner",
        name: "repo",
        prNumber: 1,
        title: "Updated title",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
  })

  it("returns error envelope when no update fields are provided", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.update",
      input: {
        owner: "owner",
        name: "repo",
        prNumber: 1,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toMatch(/title|body|draft/)
  })

  it("returns validation error envelope for invalid prNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.update",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
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

  it("falls back to CLI when draft field is present", async () => {
    const githubClient = {
      updatePr: async (): Promise<never> => {
        throw new Error("updatePr should not be called when draft is in input")
      },
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.update",
      input: { owner: "owner", name: "repo", prNumber: 1, title: "New title", draft: true },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    // GQL route throws AdapterUnsupported for draft → CLI unavailable → final error
    expect(result.ok).toBe(false)
    expect(result.error?.code).not.toBe("VALIDATION")
  })
})
