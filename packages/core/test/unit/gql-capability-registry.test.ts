import { getGraphqlHandler, listGraphqlCapabilities } from "@core/gql/capability-registry.js"
import { describe, expect, it, vi } from "vitest"

describe("gql capability registry", () => {
  it("lists capabilities and validates submit handler availability", async () => {
    const capabilities = listGraphqlCapabilities()
    expect(capabilities).toContain("pr.review.submit")
    expect(capabilities).toContain("issue.labels.add")

    const submitHandler = getGraphqlHandler("pr.review.submit")
    expect(submitHandler).toBeDefined()
    if (!submitHandler) {
      throw new Error("missing submit handler")
    }

    expect(() =>
      submitHandler(
        {
          fetchRepoView: vi.fn(),
          fetchIssueView: vi.fn(),
          fetchIssueList: vi.fn(),
          fetchIssueCommentsList: vi.fn(),
          fetchPrView: vi.fn(),
          fetchPrList: vi.fn(),
          fetchPrReviewsList: vi.fn(),
          fetchPrDiffListFiles: vi.fn(),
          fetchPrMergeStatus: vi.fn(),
          fetchPrCommentsList: vi.fn(),
          replyToReviewThread: vi.fn(),
          resolveReviewThread: vi.fn(),
          unresolveReviewThread: vi.fn(),
          submitPrReview: undefined,
        } as unknown as Parameters<NonNullable<typeof submitHandler>>[0],
        {
          owner: "owner",
          name: "repo",
          prNumber: 1,
          event: "COMMENT",
        },
      ),
    ).toThrow("submitPrReview operation not available")
  })

  it("throws when issue.labels.add operation is unavailable", async () => {
    const labelsAddHandler = getGraphqlHandler("issue.labels.add")
    expect(labelsAddHandler).toBeDefined()
    if (!labelsAddHandler) {
      throw new Error("missing issue.labels.add handler")
    }

    expect(() =>
      labelsAddHandler(
        {
          fetchRepoView: vi.fn(),
          fetchIssueView: vi.fn(),
          fetchIssueList: vi.fn(),
          fetchIssueCommentsList: vi.fn(),
          fetchPrView: vi.fn(),
          fetchPrList: vi.fn(),
          fetchPrReviewsList: vi.fn(),
          fetchPrDiffListFiles: vi.fn(),
          fetchPrMergeStatus: vi.fn(),
          fetchPrCommentsList: vi.fn(),
          replyToReviewThread: vi.fn(),
          resolveReviewThread: vi.fn(),
          unresolveReviewThread: vi.fn(),
          addIssueLabels: undefined,
        } as unknown as Parameters<NonNullable<typeof labelsAddHandler>>[0],
        { issueId: "I_1", labels: ["bug"] },
      ),
    ).toThrow("addIssueLabels operation not available")
  })
})
