import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("createGithubClient sdk integration", () => {
  it("builds the high-level API from generated sdk methods", async () => {
    const repoView = vi.fn(async () => ({
      repository: {
        id: "repo-id",
        name: "modkit",
        nameWithOwner: "go-modkit/modkit",
        isPrivate: false,
        stargazerCount: 10,
        forkCount: 2,
        url: "https://github.com/go-modkit/modkit",
        defaultBranchRef: { name: "main" },
      },
    }))
    const issueView = vi.fn(async () => ({
      repository: {
        issue: {
          id: "issue-id",
          number: 42,
          title: "Issue title",
          state: "OPEN",
          url: "https://github.com/go-modkit/modkit/issues/42",
        },
      },
    }))
    const prView = vi.fn(async () => ({
      repository: {
        pullRequest: {
          id: "pr-id",
          number: 7,
          title: "PR title",
          state: "OPEN",
          url: "https://github.com/go-modkit/modkit/pull/7",
        },
      },
    }))
    const getRepoViewSdk = vi.fn(() => ({ RepoView: repoView }))
    const getIssueViewSdk = vi.fn(() => ({ IssueView: issueView }))
    const getPrViewSdk = vi.fn(() => ({ PrView: prView }))

    vi.doMock("@core/gql/operations/repo-view.generated.js", () => ({ getSdk: getRepoViewSdk }))
    vi.doMock("@core/gql/operations/issue-view.generated.js", () => ({
      getSdk: getIssueViewSdk,
    }))
    vi.doMock("@core/gql/operations/pr-view.generated.js", () => ({ getSdk: getPrViewSdk }))

    const { createGithubClient } = await import("@core/gql/github-client.js")

    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    await client.fetchRepoView({ owner: "go-modkit", name: "modkit" })
    await client.fetchIssueView({ owner: "go-modkit", name: "modkit", issueNumber: 42 })
    await client.fetchPrView({ owner: "go-modkit", name: "modkit", prNumber: 7 })

    expect(getRepoViewSdk).toHaveBeenCalledTimes(1)
    expect(getIssueViewSdk).toHaveBeenCalledTimes(1)
    expect(getPrViewSdk).toHaveBeenCalledTimes(1)
    expect(repoView).toHaveBeenCalledWith({ owner: "go-modkit", name: "modkit" })
    expect(issueView).toHaveBeenCalledWith({ owner: "go-modkit", name: "modkit", issueNumber: 42 })
    expect(prView).toHaveBeenCalledWith({ owner: "go-modkit", name: "modkit", prNumber: 7 })
  })
})
