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
})
