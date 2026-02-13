import { describe, expect, it, vi } from "vitest"

import { runGraphqlCapability } from "../../src/core/execution/adapters/graphql-capability-adapter.js"

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
        defaultBranch: "main"
      })),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn()
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "repo-id",
        nameWithOwner: "acme/modkit"
      })
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
      fetchPrList: vi.fn()
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit"
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
            url: "https://github.com/acme/modkit/issues/1#issuecomment-1"
          }
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      })),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn()
    }

    const result = await runGraphqlCapability(client, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "comment-1", authorLogin: "octocat" })]
      })
    )
  })

  it("defaults first for list capabilities when omitted", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } }))
    }

    await runGraphqlCapability(client, "issue.list", {
      owner: "acme",
      name: "modkit"
    })

    await runGraphqlCapability(client, "pr.list", {
      owner: "acme",
      name: "modkit"
    })

    expect(client.fetchIssueList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 })
    )
    expect(client.fetchPrList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 })
    )
  })
})
