import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.items.field.update", () => {
  it("attempts graphql route first and returns error when graphql transport fails and CLI unavailable", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        // Return empty response — GQL adapter will fail with "Failed to update project item field"
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.items.field.update",
      input: {
        projectId: "project-id-1",
        itemId: "item-id-1",
        fieldId: "field-id-1",
        valueText: "updated-value",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    // GQL route is preferred; mock returns empty so GQL fails with UNKNOWN
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("UNKNOWN")
  })
})
