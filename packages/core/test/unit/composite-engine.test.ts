import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("composite execution in engine", () => {
  let mockGithubClient: Partial<GithubClient>

  beforeEach(() => {
    mockGithubClient = {
      query: vi.fn(),
      fetchRepoView: vi.fn(async () => ({
        id: "repo-1",
        name: "test",
        nameWithOwner: "test/test",
        isPrivate: false,
        stargazerCount: 0,
        forkCount: 0,
        url: "https://example.com/test/test",
        defaultBranch: "main",
      })),
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

  it("returns validation error envelope for unknown action", async () => {
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

    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("Input schema validation failed")
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

    expect(result.ok).toBe(true)
    expect(result.meta.capability_id).toBe("repo.view")
  })
})
