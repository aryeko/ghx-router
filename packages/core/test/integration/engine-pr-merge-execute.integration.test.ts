import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.merge", () => {
  it("returns graphql envelope for pr.merge", async () => {
    const githubClient = {
      mergePr: async () => ({
        prNumber: 232,
        method: "merge",
        isMethodAssumed: true,
        queued: false,
        deleteBranch: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toMatchObject({
      prNumber: 232,
      method: "merge",
      queued: false,
      deleteBranch: false,
    })
  })

  it("returns validation error envelope for invalid prNumber", async () => {
    const githubClient = {
      mergePr: async () => ({
        prNumber: 0,
        method: "merge",
        queued: false,
        deleteBranch: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
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

  it("falls back to CLI when deleteBranch is present", async () => {
    const githubClient = {
      mergePr: async (): Promise<never> => {
        throw new Error("mergePr should not be called when deleteBranch is in input")
      },
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        deleteBranch: true,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    // GQL route throws AdapterUnsupported for deleteBranch → CLI unavailable → final error
    expect(result.ok).toBe(false)
    expect(result.error?.code).not.toBe("VALIDATION")
  })
})
