import { describe, expect, it, vi } from "vitest"
import {
  runPrAssigneesAdd,
  runPrAssigneesRemove,
  runPrBranchUpdate,
  runPrCreate,
  runPrMerge,
  runPrReviewsRequest,
  runPrUpdate,
  runResolveReviewThread,
  runSubmitPrReview,
  runUnresolveReviewThread,
} from "../../../../src/gql/domains/pr-mutations.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const baseInput = {
  owner: "acme",
  name: "repo",
}

// --- runPrCreate ---

describe("runPrCreate", () => {
  const createInput = {
    ...baseInput,
    baseRefName: "main",
    headRefName: "feat/new-feature",
    title: "Add new feature",
  }

  it("throws when repository is not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runPrCreate(transport, createInput)).rejects.toThrow(
      "Repository acme/repo not found",
    )
  })

  it("throws when createPullRequest returns no pr", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { id: "repo-id-123" } })
      .mockResolvedValueOnce({ createPullRequest: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrCreate(transport, createInput)).rejects.toThrow(
      "Failed to create pull request",
    )
  })

  it("returns mapped data on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { id: "repo-id-123" } })
      .mockResolvedValueOnce({
        createPullRequest: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
            title: "Add new feature",
            state: "OPEN",
            url: "https://github.com/acme/repo/pull/42",
            isDraft: false,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCreate(transport, createInput)

    expect(result.number).toBe(42)
    expect(result.title).toBe("Add new feature")
    expect(result.state).toBe("OPEN")
    expect(result.url).toBe("https://github.com/acme/repo/pull/42")
    expect(result.draft).toBe(false)
  })

  it("passes draft flag when provided", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { id: "repo-id-123" } })
      .mockResolvedValueOnce({
        createPullRequest: {
          pullRequest: {
            id: "PR_kwDOA456",
            number: 43,
            title: "Draft PR",
            state: "OPEN",
            url: "https://github.com/acme/repo/pull/43",
            isDraft: true,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCreate(transport, { ...createInput, draft: true })

    expect(result.draft).toBe(true)
    const secondCall = execute.mock.calls[1]
    expect(secondCall?.[1]).toMatchObject({ draft: true })
  })
})

// --- runPrUpdate ---

describe("runPrUpdate", () => {
  const updateInput = {
    ...baseInput,
    prNumber: 42,
    title: "Updated title",
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrUpdate(transport, updateInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when updatePullRequest returns no pr", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ updatePullRequest: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrUpdate(transport, updateInput)).rejects.toThrow(
      "Failed to update pull request",
    )
  })

  it("returns mapped data on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        updatePullRequest: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
            title: "Updated title",
            state: "OPEN",
            url: "https://github.com/acme/repo/pull/42",
            isDraft: false,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrUpdate(transport, updateInput)

    expect(result.number).toBe(42)
    expect(result.title).toBe("Updated title")
    expect(result.state).toBe("OPEN")
    expect(result.draft).toBe(false)
  })

  it("throws when draft is provided without title or body", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrUpdate(transport, { ...baseInput, prNumber: 42, draft: true }),
    ).rejects.toThrow("operation not available")
    expect(execute).not.toHaveBeenCalled()
  })

  it("throws when draft is provided alongside title or body", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrUpdate(transport, { ...baseInput, prNumber: 42, draft: true, title: "new title" }),
    ).rejects.toThrow("operation not available")
    expect(execute).not.toHaveBeenCalled()
  })
})

// --- runPrMerge ---

describe("runPrMerge", () => {
  const mergeInput = {
    ...baseInput,
    prNumber: 42,
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrMerge(transport, mergeInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when mergePullRequest returns no pr", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ mergePullRequest: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrMerge(transport, mergeInput)).rejects.toThrow("Failed to merge pull request")
  })

  it("returns mapped data on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        mergePullRequest: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
            state: "MERGED",
            merged: true,
            mergedAt: "2025-01-15T10:00:00Z",
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrMerge(transport, mergeInput)

    expect(result.prNumber).toBe(42)
    expect(result.method).toBe("merge")
    expect(result.isMethodAssumed).toBe(true)
    expect(result.queued).toBe(false)
    expect(result.deleteBranch).toBe(false)
  })

  it("reflects mergeMethod from input", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        mergePullRequest: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
            state: "MERGED",
            merged: true,
            mergedAt: "2025-01-15T10:00:00Z",
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrMerge(transport, {
      ...mergeInput,
      mergeMethod: "SQUASH",
    })

    expect(result.method).toBe("squash")
    expect(result.isMethodAssumed).toBe(false)
    expect(result.deleteBranch).toBe(false)
  })

  it("throws when deleteBranch is true", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runPrMerge(transport, { ...mergeInput, deleteBranch: true })).rejects.toThrow(
      "deleteBranch operation not available via GraphQL mergePullRequest mutation; use the CLI route to delete the branch after merging",
    )
    expect(execute).not.toHaveBeenCalled()
  })
})

// --- runPrBranchUpdate ---

describe("runPrBranchUpdate", () => {
  const branchUpdateInput = {
    ...baseInput,
    prNumber: 42,
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrBranchUpdate(transport, branchUpdateInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when updatePullRequestBranch returns no pr", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ updatePullRequestBranch: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrBranchUpdate(transport, branchUpdateInput)).rejects.toThrow(
      "Failed to update pull request branch",
    )
  })

  it("returns mapped data on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        updatePullRequestBranch: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrBranchUpdate(transport, branchUpdateInput)

    expect(result.prNumber).toBe(42)
    expect(result.updated).toBe(true)
  })
})

// --- runPrAssigneesAdd ---

describe("runPrAssigneesAdd", () => {
  const assigneesInput = {
    ...baseInput,
    prNumber: 42,
    assignees: ["alice", "bob"],
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesAdd(transport, assigneesInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when assignable is not PullRequest", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({ user: { id: "U_bob" } })
      .mockResolvedValueOnce({
        addAssigneesToAssignable: {
          assignable: { __typename: "Issue", id: "I_abc" },
        },
      })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesAdd(transport, assigneesInput)).rejects.toThrow(
      "Failed to add assignees to pull request",
    )
  })

  it("throws when any login cannot be resolved", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesAdd(transport, assigneesInput)).rejects.toThrow(
      "Could not resolve user: bob",
    )
  })

  it("throws with 'Could not resolve user:' message when one login is unresolvable", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({ user: undefined })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesAdd(transport, assigneesInput)).rejects.toThrow(
      "Could not resolve user:",
    )
  })

  it("returns mapped assignees on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({ user: { id: "U_bob" } })
      .mockResolvedValueOnce({
        addAssigneesToAssignable: {
          assignable: {
            __typename: "PullRequest",
            id: "PR_kwDOA123",
            assignees: {
              nodes: [{ login: "alice" }, { login: "bob" }],
            },
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrAssigneesAdd(transport, assigneesInput)

    expect(result.prNumber).toBe(42)
    expect(result.added).toEqual(["alice", "bob"])
  })

  it("filters null assignee nodes", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({
        addAssigneesToAssignable: {
          assignable: {
            __typename: "PullRequest",
            id: "PR_kwDOA123",
            assignees: {
              nodes: [null, { login: "alice" }, null],
            },
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrAssigneesAdd(transport, { ...assigneesInput, assignees: ["alice"] })

    expect(result.added).toEqual(["alice"])
  })
})

// --- runPrAssigneesRemove ---

describe("runPrAssigneesRemove", () => {
  const assigneesInput = {
    ...baseInput,
    prNumber: 42,
    assignees: ["alice"],
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesRemove(transport, assigneesInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when assignable is not PullRequest", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({
        removeAssigneesFromAssignable: {
          assignable: null,
        },
      })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesRemove(transport, assigneesInput)).rejects.toThrow(
      "Failed to remove assignees from pull request",
    )
  })

  it("throws when any login cannot be resolved", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runPrAssigneesRemove(transport, assigneesInput)).rejects.toThrow(
      "Could not resolve user: alice",
    )
  })

  it("returns mapped assignees after removal", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_alice" } })
      .mockResolvedValueOnce({
        removeAssigneesFromAssignable: {
          assignable: {
            __typename: "PullRequest",
            id: "PR_kwDOA123",
            assignees: {
              nodes: [{ login: "bob" }],
            },
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrAssigneesRemove(transport, assigneesInput)

    expect(result.prNumber).toBe(42)
    expect(result.removed).toEqual(["alice"])
  })
})

// --- runPrReviewsRequest ---

describe("runPrReviewsRequest", () => {
  const reviewsRequestInput = {
    ...baseInput,
    prNumber: 42,
    reviewers: ["charlie"],
  }

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrReviewsRequest(transport, reviewsRequestInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when requestReviews returns no pr", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_charlie" } })
      .mockResolvedValueOnce({ requestReviews: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrReviewsRequest(transport, reviewsRequestInput)).rejects.toThrow(
      "Failed to request pull request reviews",
    )
  })

  it("throws when any reviewer login cannot be resolved", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: null })
    const transport: GraphqlTransport = { execute }

    await expect(runPrReviewsRequest(transport, reviewsRequestInput)).rejects.toThrow(
      "Could not resolve user: charlie",
    )
  })

  it("returns requested reviewers on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_charlie" } })
      .mockResolvedValueOnce({
        requestReviews: {
          pullRequest: {
            id: "PR_kwDOA123",
            reviewRequests: {
              nodes: [
                {
                  requestedReviewer: { __typename: "User", login: "charlie" },
                },
              ],
            },
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrReviewsRequest(transport, reviewsRequestInput)

    expect(result.prNumber).toBe(42)
    expect(result.reviewers).toEqual(["charlie"])
    expect(result.updated).toBe(true)
  })

  it("includes Team reviewers alongside User reviewers in results", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ user: { id: "U_charlie" } })
      .mockResolvedValueOnce({
        requestReviews: {
          pullRequest: {
            id: "PR_kwDOA123",
            reviewRequests: {
              nodes: [
                { requestedReviewer: { __typename: "Team", slug: "eng-team" } },
                { requestedReviewer: { __typename: "User", login: "charlie" } },
                null,
              ],
            },
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrReviewsRequest(transport, reviewsRequestInput)

    expect(result.reviewers).toEqual(["eng-team", "charlie"])
  })
})

// --- runResolveReviewThread ---

describe("runResolveReviewThread", () => {
  it("throws when thread is null in mutation result", async () => {
    const execute = vi.fn().mockResolvedValue({ resolveReviewThread: { thread: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runResolveReviewThread(transport, { threadId: "thread-1" })).rejects.toThrow(
      "Review thread mutation failed",
    )
  })

  it("throws when thread id is not a string", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ resolveReviewThread: { thread: { id: 123, isResolved: true } } })
    const transport: GraphqlTransport = { execute }

    await expect(runResolveReviewThread(transport, { threadId: "thread-1" })).rejects.toThrow(
      "Review thread mutation failed",
    )
  })

  it("returns thread data on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      resolveReviewThread: { thread: { id: "thread-1", isResolved: true } },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runResolveReviewThread(transport, { threadId: "thread-1" })

    expect(result.id).toBe("thread-1")
    expect(result.isResolved).toBe(true)
  })

  it("throws when assertReviewThreadInput fails on empty threadId", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runResolveReviewThread(transport, { threadId: "" })).rejects.toThrow(
      "Review thread id is required",
    )
    expect(execute).not.toHaveBeenCalled()
  })
})

// --- runUnresolveReviewThread ---

describe("runUnresolveReviewThread", () => {
  it("throws when thread is null in mutation result", async () => {
    const execute = vi.fn().mockResolvedValue({ unresolveReviewThread: { thread: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runUnresolveReviewThread(transport, { threadId: "thread-1" })).rejects.toThrow(
      "Review thread mutation failed",
    )
  })

  it("returns thread data on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      unresolveReviewThread: { thread: { id: "thread-1", isResolved: false } },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runUnresolveReviewThread(transport, { threadId: "thread-1" })

    expect(result.id).toBe("thread-1")
    expect(result.isResolved).toBe(false)
  })

  it("throws when mutation result has missing thread", async () => {
    const execute = vi.fn().mockResolvedValue({ unresolveReviewThread: null })
    const transport: GraphqlTransport = { execute }

    await expect(runUnresolveReviewThread(transport, { threadId: "thread-1" })).rejects.toThrow(
      "Review thread mutation failed",
    )
  })
})

// --- runSubmitPrReview ---

describe("runSubmitPrReview", () => {
  const baseInput = {
    owner: "acme",
    name: "repo",
    prNumber: 42,
    event: "COMMENT",
  }

  it("throws when owner is empty (assertPrReviewSubmitInput)", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runSubmitPrReview(transport, { ...baseInput, owner: "" })).rejects.toThrow(
      "Repository owner is required",
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("throws when prNumber is 0 (assertPrReviewSubmitInput)", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runSubmitPrReview(transport, { ...baseInput, prNumber: 0 })).rejects.toThrow(
      "PR number must be a positive integer",
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("throws when event is missing (assertPrReviewSubmitInput)", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runSubmitPrReview(transport, { ...baseInput, event: "" })).rejects.toThrow(
      "Review event is required",
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("throws when pr node id not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runSubmitPrReview(transport, baseInput)).rejects.toThrow(
      "Failed to retrieve pull request ID",
    )
  })

  it("throws when review response has no id", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ addPullRequestReview: { pullRequestReview: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runSubmitPrReview(transport, baseInput)).rejects.toThrow(
      "Failed to parse pull request review response",
    )
  })

  it("returns review data on success without comments", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: { id: "PRR_abc", state: "COMMENTED", body: "looks good" },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runSubmitPrReview(transport, baseInput)

    expect(result.id).toBe("PRR_abc")
    expect(result.state).toBe("COMMENTED")
  })

  it("passes optional comment fields (side, startLine, startSide) when provided", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: { id: "PRR_abc", state: "COMMENTED", body: "" },
        },
      })
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      ...baseInput,
      comments: [
        {
          path: "src/index.ts",
          body: "nit",
          line: 10,
          side: "RIGHT",
          startLine: 8,
          startSide: "RIGHT",
        },
      ],
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    expect((vars as Record<string, unknown>).threads).toMatchObject([
      expect.objectContaining({ side: "RIGHT", startLine: 8, startSide: "RIGHT" }),
    ])
  })

  it("omits optional comment fields when not provided", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: { id: "PRR_abc", state: "COMMENTED", body: "" },
        },
      })
    const transport: GraphqlTransport = { execute }

    await runSubmitPrReview(transport, {
      ...baseInput,
      comments: [{ path: "src/index.ts", body: "nit", line: 10 }],
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, vars] = execute.mock.calls[1]!
    const thread = ((vars as Record<string, unknown>).threads as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(thread).not.toHaveProperty("side")
    expect(thread).not.toHaveProperty("startLine")
    expect(thread).not.toHaveProperty("startSide")
  })
})
