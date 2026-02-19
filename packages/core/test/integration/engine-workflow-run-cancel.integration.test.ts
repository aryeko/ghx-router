import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it } from "vitest"

describe("executeTask workflow.run.cancel", () => {
  it("returns cli envelope for workflow.run.cancel", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "workflow.run.cancel",
      input: {
        owner: "go-modkit",
        name: "modkit",
        runId: 456,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      ghCliAvailable: true,
      ghAuthenticated: true,
      cliRunner: {
        run: async () => ({
          stdout: "Run cancelled",
          stderr: "",
          exitCode: 0,
        }),
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
  })

  it("returns validation error envelope for missing runId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "workflow.run.cancel",
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
  })
})
