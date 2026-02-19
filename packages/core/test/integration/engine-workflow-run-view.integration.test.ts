import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/client.js"
import { describe, expect, it } from "vitest"

describe("executeTask workflow.run.view", () => {
  it("returns cli envelope for workflow.run.view", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "workflow.run.view",
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
          stdout: JSON.stringify({
            databaseId: 456,
            workflowName: "CI",
            status: "completed",
            conclusion: "success",
            headBranch: "main",
            headSha: "abc123",
            event: "push",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:05:00Z",
            startedAt: "2024-01-01T00:00:01Z",
            url: "https://github.com/go-modkit/modkit/actions/runs/456",
            jobs: [
              {
                databaseId: 789,
                name: "build",
                status: "completed",
                conclusion: "success",
                startedAt: "2024-01-01T00:00:02Z",
                completedAt: "2024-01-01T00:03:00Z",
                url: "https://github.com/go-modkit/modkit/actions/runs/456/jobs/789",
              },
            ],
          }),
          stderr: "",
          exitCode: 0,
        }),
      },
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: 456,
        workflowName: "CI",
        status: "completed",
        conclusion: "success",
        jobs: [
          expect.objectContaining({
            id: 789,
            name: "build",
            status: "completed",
            conclusion: "success",
          }),
        ],
      }),
    )
  })

  it("returns validation error envelope for missing runId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "workflow.run.view",
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
