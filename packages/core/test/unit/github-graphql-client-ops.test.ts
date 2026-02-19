import { createGithubClient } from "@core/gql/client.js"
import { parse } from "graphql"
import { describe, expect, it, vi } from "vitest"

describe("createGithubClient", () => {
  it("maps repo and issue/pr payloads from GraphQL responses", async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes("RepoView")) {
        return {
          repository: {
            id: "repo-1",
            name: "ghx-router",
            nameWithOwner: "acme/ghx-router",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/acme/ghx-router",
            defaultBranchRef: { name: "main" },
          },
        }
      }

      if (query.includes("IssueList")) {
        return {
          repository: {
            issues: {
              nodes: [
                null,
                {
                  id: "issue-1",
                  number: 10,
                  title: "Title",
                  state: "OPEN",
                  url: "https://github.com/acme/ghx-router/issues/10",
                },
              ],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        }
      }

      if (query.includes("PrList")) {
        return {
          repository: {
            pullRequests: {
              nodes: [
                {
                  id: "pr-1",
                  number: 5,
                  title: "PR",
                  state: "OPEN",
                  url: "https://github.com/acme/ghx-router/pull/5",
                },
              ],
              pageInfo: { endCursor: "cursor", hasNextPage: true },
            },
          },
        }
      }

      throw new Error(`unexpected query: ${query}`)
    })

    const client = createGithubClient({ execute } as never)

    const repo = await client.fetchRepoView({ owner: "acme", name: "ghx-router" })
    const issues = await client.fetchIssueList({ owner: "acme", name: "ghx-router", first: 10 })
    const prs = await client.fetchPrList({ owner: "acme", name: "ghx-router", first: 5 })

    expect(repo.defaultBranch).toBe("main")
    expect(issues.items).toHaveLength(1)
    expect(issues.items[0]?.number).toBe(10)
    expect(prs.pageInfo.hasNextPage).toBe(true)
  })

  it("maps issue comments and handles nullable author logins", async () => {
    const execute = vi.fn(async (query: string) => {
      if (!query.includes("IssueCommentsList")) {
        throw new Error("unexpected query")
      }

      return {
        repository: {
          issue: {
            comments: {
              nodes: [
                {
                  id: "c1",
                  body: "hello",
                  author: null,
                  createdAt: "2025-01-01T00:00:00Z",
                  url: "https://github.com/acme/ghx-router/issues/10#issuecomment-1",
                },
              ],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        },
      }
    })

    const client = createGithubClient({ execute } as never)
    const data = await client.fetchIssueCommentsList({
      owner: "acme",
      name: "ghx-router",
      issueNumber: 10,
      first: 20,
    })

    expect(data.items[0]?.authorLogin).toBeNull()
    expect(data.pageInfo.hasNextPage).toBe(false)
  })

  it("throws validation errors before transport call", async () => {
    const execute = vi.fn(async () => ({}))
    const client = createGithubClient({ execute } as never)

    await expect(client.fetchRepoView({ owner: " ", name: "repo" })).rejects.toThrow(
      "Repository owner and name are required",
    )
    await expect(
      client.fetchIssueView({ owner: "acme", name: "repo", issueNumber: 0 }),
    ).rejects.toThrow("Issue number must be a positive integer")
    await expect(client.fetchIssueList({ owner: "acme", name: "repo", first: 0 })).rejects.toThrow(
      "List page size must be a positive integer",
    )
    await expect(
      client.fetchIssueCommentsList({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        first: 10,
        after: 42 as never,
      }),
    ).rejects.toThrow("After cursor must be a string")
    await expect(client.fetchPrView({ owner: "acme", name: "repo", prNumber: 0 })).rejects.toThrow(
      "PR number must be a positive integer",
    )
    await expect(client.fetchPrList({ owner: "acme", name: "repo", first: 0 })).rejects.toThrow(
      "List page size must be a positive integer",
    )

    expect(execute).not.toHaveBeenCalled()
  })

  it("throws not-found errors when nested resources are missing", async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes("RepoView")) {
        return { repository: null }
      }
      if (query.includes("IssueView")) {
        return { repository: { issue: null } }
      }
      if (query.includes("IssueList")) {
        return { repository: { issues: null } }
      }
      if (query.includes("IssueCommentsList")) {
        return { repository: { issue: { comments: null } } }
      }
      if (query.includes("PrView")) {
        return { repository: { pullRequest: null } }
      }
      if (query.includes("PrList")) {
        return { repository: { pullRequests: null } }
      }
      throw new Error("unexpected query")
    })

    const client = createGithubClient({ execute } as never)

    await expect(client.fetchRepoView({ owner: "acme", name: "repo" })).rejects.toThrow(
      "Repository not found",
    )
    await expect(
      client.fetchIssueView({ owner: "acme", name: "repo", issueNumber: 1 }),
    ).rejects.toThrow("Issue not found")
    await expect(client.fetchIssueList({ owner: "acme", name: "repo", first: 1 })).rejects.toThrow(
      "Issues not found",
    )
    await expect(
      client.fetchIssueCommentsList({ owner: "acme", name: "repo", issueNumber: 1, first: 1 }),
    ).rejects.toThrow("Issue comments not found")
    await expect(client.fetchPrView({ owner: "acme", name: "repo", prNumber: 1 })).rejects.toThrow(
      "Pull request not found",
    )
    await expect(client.fetchPrList({ owner: "acme", name: "repo", first: 1 })).rejects.toThrow(
      "Pull requests not found",
    )
  })

  it("supports raw query with DocumentNode and fallback query object", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true })

    const client = createGithubClient({ execute } as never)
    const doc = parse("query Viewer { viewer { login } }")

    await expect(client.query<{ ok: boolean }>(doc)).resolves.toEqual({ ok: true })
    await expect(client.query<{ ok: boolean }>({} as never)).resolves.toEqual({ ok: true })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it("filters null nodes in comments and PR list", async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes("IssueCommentsList")) {
        return {
          repository: {
            issue: {
              comments: {
                nodes: [
                  null,
                  {
                    id: "c1",
                    body: "hello",
                    author: { login: "octocat" },
                    createdAt: "2025-01-01T00:00:00Z",
                    url: "https://github.com/acme/ghx-router/issues/10#issuecomment-1",
                  },
                ],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        }
      }

      if (query.includes("PrList")) {
        return {
          repository: {
            pullRequests: {
              nodes: [null],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        }
      }

      throw new Error("unexpected query")
    })

    const client = createGithubClient({ execute } as never)
    const comments = await client.fetchIssueCommentsList({
      owner: "acme",
      name: "ghx-router",
      issueNumber: 10,
      first: 20,
    })
    const prs = await client.fetchPrList({ owner: "acme", name: "ghx-router", first: 10 })

    expect(comments.items).toHaveLength(1)
    expect(prs.items).toEqual([])
  })
})
