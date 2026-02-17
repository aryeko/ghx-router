import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask pr.review.submit_request_changes", () => {
  it("returns cli envelope for pr.review.submit_request_changes", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.review.submit_request_changes",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        body: "Needs changes",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      ghCliAvailable: true,
      ghAuthenticated: true,
      cliRunner: {
        run: async () => ({
          stdout: JSON.stringify({
            id: "review-id-123",
            state: "CHANGES_REQUESTED",
          }),
          stderr: "",
          exitCode: 0,
        }),
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

  it("returns validation error envelope for missing body", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.review.submit_request_changes",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
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
})
