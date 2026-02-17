import { describe, expect, it } from "vitest"

import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import { createGithubClient } from "../../src/gql/client.js"

describe("executeTask issue.blocked_by.add", () => {
  it("returns validation error envelope for missing blockedByIssueId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "issue.blocked_by.add",
      input: { issueId: "issue-id-123" },
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
