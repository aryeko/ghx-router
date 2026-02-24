import { describe, expect, it, vi } from "vitest"
import {
  runPrAssigneesAdd,
  runPrAssigneesRemove,
  runPrBranchUpdate,
  runPrCreate,
  runPrMerge,
  runPrReviewsRequest,
  runPrUpdate,
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.number).toBe(42)
    expect(result.title).toBe("Add new feature")
    expect(result.state).toBe("OPEN")
    expect(result.url).toBe("https://github.com/acme/repo/pull/42")
    expect(result.isDraft).toBe(false)
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

    expect(result.isDraft).toBe(true)
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.number).toBe(42)
    expect(result.title).toBe("Updated title")
    expect(result.state).toBe("OPEN")
    expect(result.isDraft).toBe(false)
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.number).toBe(42)
    expect(result.state).toBe("MERGED")
    expect(result.merged).toBe(true)
    expect(result.mergedAt).toBe("2025-01-15T10:00:00Z")
  })

  it("returns mergedAt as null when not present", async () => {
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
            mergedAt: null,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrMerge(transport, mergeInput)

    expect(result.mergedAt).toBeNull()
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.updated).toBe(true)
  })
})

// --- runPrAssigneesAdd ---

describe("runPrAssigneesAdd", () => {
  const assigneesInput = {
    ...baseInput,
    prNumber: 42,
    logins: ["alice", "bob"],
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.assignees).toEqual(["alice", "bob"])
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

    const result = await runPrAssigneesAdd(transport, { ...assigneesInput, logins: ["alice"] })

    expect(result.assignees).toEqual(["alice"])
  })
})

// --- runPrAssigneesRemove ---

describe("runPrAssigneesRemove", () => {
  const assigneesInput = {
    ...baseInput,
    prNumber: 42,
    logins: ["alice"],
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.assignees).toEqual(["bob"])
  })
})

// --- runPrReviewsRequest ---

describe("runPrReviewsRequest", () => {
  const reviewsRequestInput = {
    ...baseInput,
    prNumber: 42,
    reviewerLogins: ["charlie"],
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

    expect(result.id).toBe("PR_kwDOA123")
    expect(result.requestedReviewers).toEqual(["charlie"])
  })

  it("filters non-User reviewers from results", async () => {
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

    expect(result.requestedReviewers).toEqual(["charlie"])
  })
})
