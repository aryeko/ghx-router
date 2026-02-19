import { runGraphqlCapability } from "@core/core/execution/adapters/graphql-capability-adapter.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("pr.review.submit via GraphQL", () => {
  let client: Pick<
    GithubClient,
    | "fetchRepoView"
    | "fetchIssueView"
    | "fetchIssueList"
    | "fetchIssueCommentsList"
    | "fetchPrView"
    | "fetchPrList"
    | "fetchPrCommentsList"
    | "fetchPrReviewsList"
    | "fetchPrDiffListFiles"
    | "fetchPrMergeStatus"
    | "replyToReviewThread"
    | "resolveReviewThread"
    | "unresolveReviewThread"
    | "submitPrReview"
  >

  beforeEach(() => {
    client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
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
    }
  })

  it("submits review with inline comments using addPullRequestReview mutation", async () => {
    const result = await runGraphqlCapability(
      client as unknown as GithubClient,
      "pr.review.submit",
      {
        owner: "owner",
        name: "repo",
        prNumber: 1,
        event: "COMMENT",
        body: "LGTM",
        comments: [{ path: "src/index.ts", body: "Fix this", line: 10 }],
      },
    )

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(client.submitPrReview).toHaveBeenCalledOnce()
  })

  it("submits review without comments (body-only)", async () => {
    const result = await runGraphqlCapability(
      client as unknown as GithubClient,
      "pr.review.submit",
      {
        owner: "owner",
        name: "repo",
        prNumber: 1,
        event: "APPROVE",
        body: "Looks good",
      },
    )

    expect(result.ok).toBe(true)
    expect(client.submitPrReview).toHaveBeenCalledWith(
      expect.objectContaining({ event: "APPROVE", body: "Looks good" }),
    )
  })
})
