import { getGraphqlHandler, listGraphqlCapabilities } from "@core/gql/capability-registry.js"
import { describe, expect, it, vi } from "vitest"

describe("gql capability registry", () => {
  it("lists capabilities and validates submit handler availability", async () => {
    const capabilities = listGraphqlCapabilities()
    expect(capabilities).toContain("pr.reviews.submit")
    expect(capabilities).toContain("issue.labels.add")

    const submitHandler = getGraphqlHandler("pr.reviews.submit")
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

  describe("pr.merge method normalization", () => {
    function makeMergeClient(mergePr: ReturnType<typeof vi.fn>) {
      return {
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
        mergePr,
      } as unknown as Parameters<NonNullable<ReturnType<typeof getGraphqlHandler>>>[0]
    }

    it('maps lowercase "merge" → "MERGE"', () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
        method: "merge",
      })
      expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "MERGE" }))
    })

    it('maps lowercase "squash" → "SQUASH"', () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
        method: "squash",
      })
      expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "SQUASH" }))
    })

    it('maps lowercase "rebase" → "REBASE"', () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
        method: "rebase",
      })
      expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "REBASE" }))
    })

    it('maps uppercase "SQUASH" → "SQUASH" (case-insensitive normalization)', () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
        method: "SQUASH",
      })
      expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "SQUASH" }))
    })

    it('defaults to "MERGE" when method is undefined', () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
      })
      expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "MERGE" }))
    })
  })
})
