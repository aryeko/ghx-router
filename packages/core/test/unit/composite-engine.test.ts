import type { GithubClient } from "@core/gql/github-client.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"

describe("composite execution in engine", () => {
  let mockGithubClient: Partial<GithubClient>

  beforeEach(() => {
    mockGithubClient = {
      query: vi.fn(),
    }
  })

  it("routes composite cards to composite execution path", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      pr_thread_reply_0: { comment: { id: "c1" } },
      pr_thread_resolve_1: { thread: { id: "t1", isResolved: true } },
    })
    mockGithubClient.query = queryMock

    const request: TaskRequest = {
      task: "pr.threads.composite",
      input: {
        threads: [
          { threadId: "t1", action: "reply", body: "Fixed" },
          { threadId: "t1", action: "resolve" },
        ],
      },
    }

    const result = await executeTask(request, {
      githubClient: mockGithubClient as GithubClient,
      githubToken: "token",
      skipGhPreflight: true,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      results: [{ id: "c1" }, { id: "t1", isResolved: true }],
    })
    expect(result).toHaveProperty("meta")
    expect(result.meta.capability_id).toBe("pr.threads.composite")
  })

  it("returns error envelope when builder lookup fails", async () => {
    const request: TaskRequest = {
      task: "pr.threads.composite",
      input: {
        threads: [{ threadId: "t1", action: "invalid_action", body: "Test" }],
      },
    }

    const result = await executeTask(request, {
      githubClient: mockGithubClient as GithubClient,
      githubToken: "token",
      skipGhPreflight: true,
    })

    // Assert: result.ok === false (no builders for invalid action)
    expect(result.ok).toBe(false)
    // Assert: result.error exists
    expect(result.error).toBeDefined()
  })

  it("falls through to normal execute for non-composite cards", async () => {
    const request: TaskRequest = {
      task: "repo.view",
      input: {
        owner: "test",
        name: "test",
      },
    }

    const result = await executeTask(request, {
      githubClient: mockGithubClient as GithubClient,
      githubToken: "token",
      skipGhPreflight: true,
    })

    // Non-composite card should execute without composite errors
    expect(result).toHaveProperty("meta")
    expect(result.meta.capability_id).toBe("repo.view")
  })
})
