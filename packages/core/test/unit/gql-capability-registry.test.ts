import { getGraphqlHandler, listGraphqlCapabilities } from "@core/gql/capability-registry.js"
import { describe, expect, it, vi } from "vitest"

describe("gql capability registry", () => {
  describe("smoke tests: all new handlers are registered", () => {
    const newHandlers = [
      "repo.labels.list",
      "repo.issue_types.list",
      "release.view",
      "release.list",
      "project_v2.org.view",
      "project_v2.user.view",
      "project_v2.fields.list",
      "project_v2.items.list",
      "pr.create",
      "pr.update",
      "pr.merge",
      "pr.branch.update",
      "pr.assignees.add",
      "pr.assignees.remove",
      "pr.reviews.request",
      "project_v2.items.issue.add",
      "project_v2.items.issue.remove",
      "project_v2.items.field.update",
    ]

    for (const capabilityId of newHandlers) {
      it(`returns a defined handler for ${capabilityId}`, () => {
        const handler = getGraphqlHandler(capabilityId)
        expect(handler).toBeDefined()
      })
    }
  })

  describe("representative handler invocation tests", () => {
    it("project_v2.items.issue.add handler throws when addProjectV2Item is undefined", () => {
      const handler = getGraphqlHandler("project_v2.items.issue.add")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing project_v2.items.issue.add handler")

      const client = {
        addProjectV2Item: undefined,
      } as unknown as Parameters<NonNullable<typeof handler>>[0]

      expect(() =>
        handler(client, {
          owner: "acme",
          projectNumber: 1,
          issueUrl: "https://github.com/acme/repo/issues/1",
        }),
      ).toThrow()
    })

    it("pr.create handler throws when createPr is undefined", () => {
      const handler = getGraphqlHandler("pr.create")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.create handler")

      const client = {
        createPr: undefined,
      } as unknown as Parameters<NonNullable<typeof handler>>[0]

      expect(() =>
        handler(client, {
          owner: "acme",
          name: "repo",
          title: "My PR",
          head: "feat/branch",
          base: "main",
        }),
      ).toThrow()
    })

    it("release.view handler delegates to fetchReleaseView", () => {
      const handler = getGraphqlHandler("release.view")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing release.view handler")

      const fetchReleaseView = vi.fn().mockResolvedValue({ tagName: "v1.0.0" })
      const client = { fetchReleaseView } as unknown as Parameters<NonNullable<typeof handler>>[0]

      handler(client, { owner: "acme", name: "repo", tagName: "v1.0.0" })
      expect(fetchReleaseView).toHaveBeenCalledWith({
        owner: "acme",
        name: "repo",
        tagName: "v1.0.0",
      })
    })
  })

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

    it("omits mergeMethod when method is undefined (server applies its own default)", () => {
      const handler = getGraphqlHandler("pr.merge")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.merge handler")
      const mergePr = vi.fn().mockResolvedValue({})
      handler(makeMergeClient(mergePr), {
        owner: "o",
        name: "r",
        prNumber: 1,
      })
      expect(mergePr).toHaveBeenCalledWith(
        expect.not.objectContaining({ mergeMethod: expect.anything() }),
      )
    })
  })

  describe("requireNonEmptyString via pr.threads handlers", () => {
    function makeThreadClient() {
      return {
        replyToReviewThread: vi.fn().mockResolvedValue({}),
        resolveReviewThread: vi.fn().mockResolvedValue({}),
        unresolveReviewThread: vi.fn().mockResolvedValue({}),
      } as unknown as Parameters<NonNullable<ReturnType<typeof getGraphqlHandler>>>[0]
    }

    it("pr.threads.reply throws when threadId is missing", () => {
      const handler = getGraphqlHandler("pr.threads.reply")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.threads.reply handler")

      expect(() => handler(makeThreadClient(), { threadId: "", body: "ok" })).toThrow(
        "Missing or invalid threadId for pr.threads.reply",
      )
    })

    it("pr.threads.reply throws when body is missing", () => {
      const handler = getGraphqlHandler("pr.threads.reply")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.threads.reply handler")

      expect(() => handler(makeThreadClient(), { threadId: "thread-1", body: "" })).toThrow(
        "Missing or invalid body for pr.threads.reply",
      )
    })

    it("pr.threads.reply throws when threadId is non-string", () => {
      const handler = getGraphqlHandler("pr.threads.reply")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.threads.reply handler")

      expect(() => handler(makeThreadClient(), { threadId: 42, body: "ok" })).toThrow(
        "Missing or invalid threadId for pr.threads.reply",
      )
    })

    it("pr.threads.resolve throws when threadId is empty", () => {
      const handler = getGraphqlHandler("pr.threads.resolve")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.threads.resolve handler")

      expect(() => handler(makeThreadClient(), { threadId: "" })).toThrow(
        "Missing or invalid threadId for pr.threads.resolve",
      )
    })

    it("pr.threads.unresolve throws when threadId is empty", () => {
      const handler = getGraphqlHandler("pr.threads.unresolve")
      expect(handler).toBeDefined()
      if (!handler) throw new Error("missing pr.threads.unresolve handler")

      expect(() => handler(makeThreadClient(), { threadId: "" })).toThrow(
        "Missing or invalid threadId for pr.threads.unresolve",
      )
    })
  })
})
