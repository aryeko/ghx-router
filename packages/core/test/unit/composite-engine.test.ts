import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskRequest } from "../../src/core/contracts/task.js"
import { executeTask } from "../../src/core/routing/engine.js"
import type { GithubClient } from "../../src/gql/client.js"

describe("composite execution in engine", () => {
  let mockGithubClient: Partial<GithubClient>

  beforeEach(() => {
    mockGithubClient = {
      query: vi.fn(),
    }
  })

  it("routes composite cards to composite execution path", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      reply0: {
        addPullRequestReviewThreadReply: { comment: { id: "c1" } },
      },
      resolve1: {
        resolveReviewThread: { thread: { id: "t1", isResolved: true } },
      },
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

    // Composite execution should handle the request
    expect(result).toHaveProperty("ok")
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
