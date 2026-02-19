import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("pr.review.submit executeTask contract", () => {
  it("returns GraphQL review payload shape from engine", async () => {
    const githubClient = {
      fetchRepoView: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
      submitPrReview: vi.fn().mockResolvedValue({
        id: "review-1",
        state: "COMMENTED",
        url: "https://github.com/owner/repo/pull/1#pullrequestreview-1",
        body: "LGTM",
      }),
      query: vi.fn(),
    } as unknown as GithubClient

    const result = await executeTask(
      {
        task: "pr.review.submit",
        input: {
          owner: "owner",
          name: "repo",
          prNumber: 1,
          event: "COMMENT",
          body: "LGTM",
        },
      },
      {
        githubClient,
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      id: "review-1",
      state: "COMMENTED",
      url: "https://github.com/owner/repo/pull/1#pullrequestreview-1",
      body: "LGTM",
    })
  })
})
