import { runGraphqlCapability } from "@core/core/execution/adapters/graphql-capability-adapter.js"
import { describe, expect, it, vi } from "vitest"

describe("runGraphqlCapability", () => {
  it("returns normalized data for supported capability", async () => {
    const client = {
      fetchRepoView: vi.fn(async () => ({
        id: "repo-id",
        name: "modkit",
        nameWithOwner: "acme/modkit",
        isPrivate: false,
        stargazerCount: 1,
        forkCount: 0,
        url: "https://github.com/acme/modkit",
        defaultBranch: "main",
      })),
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
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "repo-id",
        nameWithOwner: "acme/modkit",
      }),
    )
  })

  it("maps thrown client errors", async () => {
    const client = {
      fetchRepoView: vi.fn(async () => {
        throw new Error("network timeout")
      }),
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
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NETWORK")
    expect(result.error?.retryable).toBe(true)
  })

  it("routes issue.comments.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(async () => ({
        items: [
          {
            id: "comment-1",
            body: "looks good",
            authorLogin: "octocat",
            createdAt: "2025-01-01T00:00:00Z",
            url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      })),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "comment-1", authorLogin: "octocat" })],
      }),
    )
  })

  it("defaults first for list capabilities when omitted", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
      fetchPrCommentsList: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        filterApplied: { unresolvedOnly: true, includeOutdated: true },
        scan: { pagesScanned: 1, sourceItemsScanned: 0, scanTruncated: false },
      })),
      fetchPrReviewsList: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
      fetchPrDiffListFiles: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      })),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    await runGraphqlCapability(client, "issue.list", {
      owner: "acme",
      name: "modkit",
    })

    await runGraphqlCapability(client, "pr.list", {
      owner: "acme",
      name: "modkit",
    })

    expect(client.fetchIssueList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 }),
    )
    expect(client.fetchPrList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 }),
    )
  })

  it("routes pr.thread.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      fetchPrCommentsList: vi.fn(async () => ({
        items: [
          {
            id: "thread-1",
            path: "src/index.ts",
            line: 10,
            startLine: null,
            diffSide: "RIGHT",
            subjectType: "LINE",
            isResolved: false,
            isOutdated: false,
            viewerCanReply: true,
            viewerCanResolve: true,
            viewerCanUnresolve: false,
            resolvedByLogin: null,
            comments: [],
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
        filterApplied: {
          unresolvedOnly: true,
          includeOutdated: false,
        },
        scan: {
          pagesScanned: 1,
          sourceItemsScanned: 1,
          scanTruncated: false,
        },
      })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.thread.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      unresolvedOnly: true,
      includeOutdated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "thread-1", isResolved: false })],
        filterApplied: {
          unresolvedOnly: true,
          includeOutdated: false,
        },
      }),
    )
  })

  it("routes pr.review.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(async () => ({
        items: [
          {
            id: "review-1",
            authorLogin: "octocat",
            body: "Looks good",
            state: "APPROVED",
            submittedAt: "2025-01-01T00:00:00Z",
            url: "https://example.com/review-1",
            commitOid: "abc123",
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      })),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.review.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "review-1", state: "APPROVED" })],
      }),
    )
  })

  it("routes pr.diff.files through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(async () => ({
        items: [
          {
            path: "src/index.ts",
            additions: 10,
            deletions: 2,
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      })),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: "src/index.ts" })],
      }),
    )
  })

  it("routes pr.merge.status through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(async () => ({
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "APPROVED",
        isDraft: false,
        state: "OPEN",
      })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.merge.status", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual({
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      reviewDecision: "APPROVED",
      isDraft: false,
      state: "OPEN",
    })
  })

  it("routes pr.thread.reply through the GraphQL client", async () => {
    const client = {
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
      replyToReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: false })),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.thread.reply", {
      threadId: "thread-1",
      body: "Thanks, addressed",
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: "thread-1", isResolved: false })
  })

  it("routes pr.thread.resolve and pr.thread.unresolve through the GraphQL client", async () => {
    const client = {
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
      resolveReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: true })),
      unresolveReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: false })),
    }

    const resolveResult = await runGraphqlCapability(client, "pr.thread.resolve", {
      threadId: "thread-1",
    })
    const unresolveResult = await runGraphqlCapability(client, "pr.thread.unresolve", {
      threadId: "thread-1",
    })

    expect(resolveResult.ok).toBe(true)
    expect(unresolveResult.ok).toBe(true)
    expect(resolveResult.data).toEqual({ id: "thread-1", isResolved: true })
    expect(unresolveResult.data).toEqual({ id: "thread-1", isResolved: false })
  })

  it("returns validation error for missing thread mutation inputs", async () => {
    const client = {
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
    }

    const replyResult = await runGraphqlCapability(client, "pr.thread.reply", {
      threadId: "",
      body: "ok",
    })

    const resolveResult = await runGraphqlCapability(client, "pr.thread.resolve", {
      threadId: "",
    })

    expect(replyResult.ok).toBe(false)
    expect(resolveResult.ok).toBe(false)
    expect(replyResult.error?.code).toBe("VALIDATION")
    expect(resolveResult.error?.code).toBe("VALIDATION")
  })

  it("routes issue lifecycle and relation capabilities through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      createIssue: vi.fn(async () => ({
        id: "issue-1",
        number: 501,
        title: "Created issue",
        state: "OPEN",
        url: "https://example.com/issues/501",
      })),
      updateIssue: vi.fn(async () => ({
        id: "issue-1",
        number: 501,
        title: "Updated issue",
        state: "OPEN",
        url: "https://example.com/issues/501",
      })),
      closeIssue: vi.fn(async () => ({
        id: "issue-1",
        number: 501,
        state: "CLOSED",
        closed: true,
      })),
      reopenIssue: vi.fn(async () => ({
        id: "issue-1",
        number: 501,
        state: "OPEN",
        reopened: true,
      })),
      deleteIssue: vi.fn(async () => ({ id: "issue-1", number: 501, deleted: true })),
      addIssueLabels: vi.fn(async () => ({ id: "issue-1", labels: ["bug", "batch-b"] })),
      updateIssueLabels: vi.fn(async () => ({ id: "issue-1", labels: ["bug", "batch-b"] })),
      updateIssueAssignees: vi.fn(async () => ({ id: "issue-1", assignees: ["octocat"] })),
      setIssueMilestone: vi.fn(async () => ({ id: "issue-1", milestoneNumber: 3 })),
      createIssueComment: vi.fn(async () => ({
        id: "comment-1",
        body: "ack",
        url: "https://example.com/comment/1",
      })),
      fetchIssueLinkedPrs: vi.fn(async () => ({
        items: [
          {
            id: "pr-1",
            number: 42,
            title: "Fixes #501",
            state: "OPEN",
            url: "https://example.com/pull/42",
          },
        ],
      })),
      fetchIssueRelations: vi.fn(async () => ({
        issue: { id: "issue-1", number: 501 },
        parent: { id: "issue-parent", number: 500 },
        children: [{ id: "issue-child", number: 502 }],
        blockedBy: [{ id: "issue-blocker", number: 499 }],
      })),
      setIssueParent: vi.fn(async () => ({ issueId: "issue-1", parentIssueId: "issue-parent" })),
      removeIssueParent: vi.fn(async () => ({ issueId: "issue-1", parentRemoved: true })),
      addIssueBlockedBy: vi.fn(async () => ({
        issueId: "issue-1",
        blockedByIssueId: "issue-blocker",
      })),
      removeIssueBlockedBy: vi.fn(async () => ({
        issueId: "issue-1",
        blockedByIssueId: "issue-blocker",
        removed: true,
      })),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const createResult = await runGraphqlCapability(client, "issue.create", {
      owner: "acme",
      name: "modkit",
      title: "Created issue",
    })
    const updateResult = await runGraphqlCapability(client, "issue.update", {
      issueId: "issue-1",
      title: "Updated issue",
    })
    const closeResult = await runGraphqlCapability(client, "issue.close", { issueId: "issue-1" })
    const reopenResult = await runGraphqlCapability(client, "issue.reopen", { issueId: "issue-1" })
    const deleteResult = await runGraphqlCapability(client, "issue.delete", { issueId: "issue-1" })
    const labelsAddResult = await runGraphqlCapability(client, "issue.labels.add", {
      issueId: "issue-1",
      labels: ["bug", "batch-b"],
    })
    const labelsResult = await runGraphqlCapability(client, "issue.labels.update", {
      issueId: "issue-1",
      labels: ["bug", "batch-b"],
    })
    const assigneesResult = await runGraphqlCapability(client, "issue.assignees.update", {
      issueId: "issue-1",
      assignees: ["octocat"],
    })
    const milestoneResult = await runGraphqlCapability(client, "issue.milestone.set", {
      issueId: "issue-1",
      milestoneNumber: 3,
    })
    const commentResult = await runGraphqlCapability(client, "issue.comments.create", {
      issueId: "issue-1",
      body: "ack",
    })
    const linkedPrsResult = await runGraphqlCapability(client, "issue.linked_prs.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 501,
    })
    const relationsResult = await runGraphqlCapability(client, "issue.relations.get", {
      owner: "acme",
      name: "modkit",
      issueNumber: 501,
    })
    const parentSetResult = await runGraphqlCapability(client, "issue.parent.set", {
      issueId: "issue-1",
      parentIssueId: "issue-parent",
    })
    const parentRemoveResult = await runGraphqlCapability(client, "issue.parent.remove", {
      issueId: "issue-1",
    })
    const blockedByAddResult = await runGraphqlCapability(client, "issue.blocked_by.add", {
      issueId: "issue-1",
      blockedByIssueId: "issue-blocker",
    })
    const blockedByRemoveResult = await runGraphqlCapability(client, "issue.blocked_by.remove", {
      issueId: "issue-1",
      blockedByIssueId: "issue-blocker",
    })

    expect(createResult.ok).toBe(true)
    expect(updateResult.ok).toBe(true)
    expect(closeResult.ok).toBe(true)
    expect(reopenResult.ok).toBe(true)
    expect(deleteResult.ok).toBe(true)
    expect(labelsAddResult.ok).toBe(true)
    expect(labelsResult.ok).toBe(true)
    expect(assigneesResult.ok).toBe(true)
    expect(milestoneResult.ok).toBe(true)
    expect(commentResult.ok).toBe(true)
    expect(linkedPrsResult.ok).toBe(true)
    expect(relationsResult.ok).toBe(true)
    expect(parentSetResult.ok).toBe(true)
    expect(parentRemoveResult.ok).toBe(true)
    expect(blockedByAddResult.ok).toBe(true)
    expect(blockedByRemoveResult.ok).toBe(true)
    expect(client.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", title: "Created issue" }),
    )
    expect(client.fetchIssueRelations).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", issueNumber: 501 }),
    )
  })

  it("returns capability limit error for unsupported capability id", async () => {
    const client = {
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
    }

    const result = await runGraphqlCapability(
      client,
      "unsupported.capability" as unknown as Parameters<typeof runGraphqlCapability>[1],
      {},
    )

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(result.meta.reason).toBe("CAPABILITY_LIMIT")
  })

  it("returns adapter unsupported when required GraphQL operation is unavailable", async () => {
    const client = {
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
    }

    const result = await runGraphqlCapability(client, "issue.create", {
      owner: "acme",
      name: "modkit",
      title: "Missing GraphQL op",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
  })

  it("returns adapter unsupported for optional issue mutation capabilities when operations are unavailable", async () => {
    const client = {
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
    }

    const unsupportedCalls = await Promise.all([
      runGraphqlCapability(client, "issue.update", { issueId: "issue-1", title: "x" }),
      runGraphqlCapability(client, "issue.close", { issueId: "issue-1" }),
      runGraphqlCapability(client, "issue.reopen", { issueId: "issue-1" }),
      runGraphqlCapability(client, "issue.delete", { issueId: "issue-1" }),
      runGraphqlCapability(client, "issue.labels.update", { issueId: "issue-1", labels: ["bug"] }),
      runGraphqlCapability(client, "issue.assignees.update", {
        issueId: "issue-1",
        assignees: ["octocat"],
      }),
      runGraphqlCapability(client, "issue.milestone.set", {
        issueId: "issue-1",
        milestoneNumber: 2,
      }),
      runGraphqlCapability(client, "issue.comments.create", { issueId: "issue-1", body: "ack" }),
      runGraphqlCapability(client, "issue.linked_prs.list", {
        owner: "acme",
        name: "modkit",
        issueNumber: 1,
      }),
      runGraphqlCapability(client, "issue.relations.get", {
        owner: "acme",
        name: "modkit",
        issueNumber: 1,
      }),
      runGraphqlCapability(client, "issue.parent.set", {
        issueId: "issue-1",
        parentIssueId: "issue-2",
      }),
      runGraphqlCapability(client, "issue.parent.remove", { issueId: "issue-1" }),
      runGraphqlCapability(client, "issue.blocked_by.add", {
        issueId: "issue-1",
        blockedByIssueId: "issue-2",
      }),
      runGraphqlCapability(client, "issue.blocked_by.remove", {
        issueId: "issue-1",
        blockedByIssueId: "issue-2",
      }),
    ])

    for (const result of unsupportedCalls) {
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
      expect(result.meta.reason).toBe("CAPABILITY_LIMIT")
    }
  })

  it("handles label not found error in issue.labels.add", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      addIssueLabels: vi.fn(async () => {
        throw new Error("Label not found: nonexistent-label")
      }),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "issue.labels.add", {
      issueId: "issue-1",
      labels: ["nonexistent-label"],
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(result.error?.message).toContain("Label not found")
  })

  it("handles empty array for labels in issue.labels.add response", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      addIssueLabels: vi.fn(async () => ({
        id: "issue-1",
        labels: [],
      })),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "issue.labels.add", {
      issueId: "issue-1",
      labels: ["bug"],
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: "issue-1", labels: [] })
  })

  it("handles PR not found error in pr.merge.status", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(async () => {
        throw new Error("Pull request not found")
      }),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.merge.status", {
      owner: "acme",
      name: "modkit",
      prNumber: 9999,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(result.error?.message).toContain("Pull request not found")
  })

  it("handles null field defaults in pr.merge.status", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrMergeStatus: vi.fn(async () => ({
        mergeable: null,
        mergeStateStatus: null,
        reviewDecision: null,
        isDraft: false,
        state: "OPEN",
      })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn(),
    }

    const result = await runGraphqlCapability(client, "pr.merge.status", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      mergeable: null,
      mergeStateStatus: null,
      reviewDecision: null,
      isDraft: false,
      state: "OPEN",
    })
  })

  it("rejects invalid thread mutation inputs - missing threadId", async () => {
    const client = {
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
    }

    const result = await runGraphqlCapability(client, "pr.thread.reply", {
      threadId: undefined,
      body: "comment",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
  })

  it("rejects invalid thread mutation inputs - empty body", async () => {
    const client = {
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
    }

    const result = await runGraphqlCapability(client, "pr.thread.reply", {
      threadId: "thread-1",
      body: "   ",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
  })

  it("handles truly unknown capability id", async () => {
    const client = {
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
    }

    const result = await runGraphqlCapability(client, "completely.unknown.capability" as never, {})

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(result.meta.reason).toBe("CAPABILITY_LIMIT")
  })
})
