import { describe, expect, it } from "vitest"

import { createGithubClient } from "../../src/gql/client.js"

describe("createGithubClient", () => {
  it("exposes typed repo.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" }
          }
        } as TData
      }
    })

    const result = await client.fetchRepoView({ owner: "go-modkit", name: "modkit" })

    expect(result.nameWithOwner).toBe("go-modkit/modkit")
    expect(result.defaultBranch).toBe("main")
  })

  it("exposes typed issue.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issue: {
              id: "issue-id",
              number: 210,
              title: "Fix parser edge case",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/issues/210"
            }
          }
        } as TData
      }
    })

    const issue = await client.fetchIssueView({ owner: "go-modkit", name: "modkit", issueNumber: 210 })

    expect(issue.number).toBe(210)
    expect(issue.title).toContain("parser")
  })

  it("exposes typed issue.list helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issues: {
              nodes: [
                {
                  id: "issue-id",
                  number: 210,
                  title: "Fix parser edge case",
                  state: "OPEN",
                  url: "https://github.com/go-modkit/modkit/issues/210"
                }
              ],
              pageInfo: {
                endCursor: "cursor-1",
                hasNextPage: false
              }
            }
          }
        } as TData
      }
    })

    const list = await client.fetchIssueList({ owner: "go-modkit", name: "modkit", first: 1 })

    expect(list.items[0]?.number).toBe(210)
    expect(list.pageInfo.hasNextPage).toBe(false)
  })

  it("exposes typed issue.comments.list helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issue: {
              comments: {
                nodes: [
                  {
                    id: "comment-id",
                    body: "Looks good",
                    createdAt: "2025-01-01T00:00:00Z",
                    url: "https://github.com/go-modkit/modkit/issues/210#issuecomment-1",
                    author: { login: "octocat" }
                  }
                ],
                pageInfo: {
                  endCursor: "cursor-1",
                  hasNextPage: true
                }
              }
            }
          }
        } as TData
      }
    })

    const list = await client.fetchIssueCommentsList({
      owner: "go-modkit",
      name: "modkit",
      issueNumber: 210,
      first: 1
    })

    expect(list.items[0]?.id).toBe("comment-id")
    expect(list.items[0]?.authorLogin).toBe("octocat")
    expect(list.pageInfo.hasNextPage).toBe(true)
    expect(list.pageInfo.endCursor).toBe("cursor-1")
  })

  it("throws when issue.comments.list payload is missing comments", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issue: null
          }
        } as TData
      }
    })

    await expect(
      client.fetchIssueCommentsList({
        owner: "go-modkit",
        name: "modkit",
        issueNumber: 210,
        first: 1
      })
    ).rejects.toThrow("Issue comments not found")
  })

  it("throws when issue.comments.list after cursor has invalid type", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            issue: {
              comments: {
                nodes: [],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false
                }
              }
            }
          }
        } as TData
      }
    })

    await expect(
      client.fetchIssueCommentsList({
        owner: "go-modkit",
        name: "modkit",
        issueNumber: 210,
        first: 1,
        after: 123 as unknown as string
      })
    ).rejects.toThrow("After cursor must be a string")
  })

  it("exposes typed pr.view helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              id: "pr-id",
              number: 232,
              title: "Add benchmark improvements",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/pull/232"
            }
          }
        } as TData
      }
    })

    const pr = await client.fetchPrView({ owner: "go-modkit", name: "modkit", prNumber: 232 })

    expect(pr.number).toBe(232)
    expect(pr.title).toContain("benchmark")
  })

  it("exposes typed pr.list helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequests: {
              nodes: [
                {
                  id: "pr-id",
                  number: 232,
                  title: "Add benchmark improvements",
                  state: "OPEN",
                  url: "https://github.com/go-modkit/modkit/pull/232"
                }
              ],
              pageInfo: {
                endCursor: "cursor-pr-1",
                hasNextPage: true
              }
            }
          }
        } as TData
      }
    })

    const list = await client.fetchPrList({ owner: "go-modkit", name: "modkit", first: 1 })

    expect(list.items[0]?.number).toBe(232)
    expect(list.pageInfo.hasNextPage).toBe(true)
  })
})
