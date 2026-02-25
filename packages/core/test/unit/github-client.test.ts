import { createGithubClient, createGithubClientFromToken } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

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
            defaultBranchRef: { name: "main" },
          },
        } as TData
      },
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
              url: "https://github.com/go-modkit/modkit/issues/210",
            },
          },
        } as TData
      },
    })

    const issue = await client.fetchIssueView({
      owner: "go-modkit",
      name: "modkit",
      issueNumber: 210,
    })

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
                  url: "https://github.com/go-modkit/modkit/issues/210",
                },
              ],
              pageInfo: {
                endCursor: "cursor-1",
                hasNextPage: false,
              },
            },
          },
        } as TData
      },
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
                    author: { login: "octocat" },
                  },
                ],
                pageInfo: {
                  endCursor: "cursor-1",
                  hasNextPage: true,
                },
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchIssueCommentsList({
      owner: "go-modkit",
      name: "modkit",
      issueNumber: 210,
      first: 1,
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
            issue: null,
          },
        } as TData
      },
    })

    await expect(
      client.fetchIssueCommentsList({
        owner: "go-modkit",
        name: "modkit",
        issueNumber: 210,
        first: 1,
      }),
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
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    await expect(
      client.fetchIssueCommentsList({
        owner: "go-modkit",
        name: "modkit",
        issueNumber: 210,
        first: 1,
        after: 123 as unknown as string,
      }),
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
              url: "https://github.com/go-modkit/modkit/pull/232",
            },
          },
        } as TData
      },
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
                  url: "https://github.com/go-modkit/modkit/pull/232",
                },
              ],
              pageInfo: {
                endCursor: "cursor-pr-1",
                hasNextPage: true,
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchPrList({ owner: "go-modkit", name: "modkit", first: 1 })

    expect(list.items[0]?.number).toBe(232)
    expect(list.pageInfo.hasNextPage).toBe(true)
  })

  it("exposes typed pr.threads.list helper with unresolved filtering", async () => {
    const execute = async <TData>(
      _query: string,
      variables?: Record<string, unknown>,
    ): Promise<TData> => {
      const after = (variables?.after as string | null | undefined) ?? null
      if (after === null) {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [
                  {
                    cursor: "cursor-0",
                    node: {
                      id: "thread-1",
                      path: "src/a.ts",
                      line: 10,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: true,
                      isOutdated: false,
                      viewerCanReply: true,
                      viewerCanResolve: true,
                      viewerCanUnresolve: false,
                      resolvedBy: { login: "octocat" },
                      comments: {
                        nodes: [
                          {
                            id: "comment-1",
                            body: "resolved",
                            createdAt: "2025-01-01T00:00:00Z",
                            url: "https://example.com/comment-1",
                            author: { login: "octocat" },
                          },
                        ],
                      },
                    },
                  },
                ],
                pageInfo: {
                  endCursor: "cursor-1",
                  hasNextPage: true,
                },
              },
            },
          },
        } as TData
      }

      return {
        repository: {
          pullRequest: {
            reviewThreads: {
              edges: [
                {
                  cursor: "cursor-2",
                  node: {
                    id: "thread-2",
                    path: "src/b.ts",
                    line: 20,
                    startLine: null,
                    diffSide: "RIGHT",
                    subjectType: "LINE",
                    isResolved: false,
                    isOutdated: false,
                    viewerCanReply: false,
                    viewerCanResolve: true,
                    viewerCanUnresolve: true,
                    resolvedBy: null,
                    comments: {
                      nodes: [
                        {
                          id: "comment-2",
                          body: "needs work",
                          createdAt: "2025-01-02T00:00:00Z",
                          url: "https://example.com/comment-2",
                          author: { login: "hubot" },
                        },
                      ],
                    },
                  },
                },
              ],
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
            },
          },
        },
      } as TData
    }

    const client = createGithubClient({ execute })
    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 1,
      unresolvedOnly: true,
      includeOutdated: false,
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe("thread-2")
    expect(list.items[0]?.viewerCanReply).toBe(false)
    expect(list.filterApplied).toEqual({ unresolvedOnly: true, includeOutdated: false })
    expect(list.scan.pagesScanned).toBe(2)
  })

  it("keeps outdated threads when unresolvedOnly is false", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [
                  {
                    cursor: "cursor-1",
                    node: {
                      id: "thread-outdated",
                      path: "src/a.ts",
                      line: 10,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: true,
                      isOutdated: true,
                      viewerCanReply: true,
                      viewerCanResolve: false,
                      viewerCanUnresolve: false,
                      resolvedBy: null,
                      comments: { nodes: [] },
                    },
                  },
                ],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
      unresolvedOnly: false,
      includeOutdated: true,
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe("thread-outdated")
  })

  it("returns cursor for last returned filtered item", async () => {
    const execute = async <TData>(
      _query: string,
      variables?: Record<string, unknown>,
    ): Promise<TData> => {
      const after = (variables?.after as string | null | undefined) ?? null
      if (after === null) {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [
                  {
                    cursor: "cursor-1",
                    node: {
                      id: "thread-1",
                      path: "src/a.ts",
                      line: 10,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: false,
                      isOutdated: false,
                      viewerCanReply: true,
                      viewerCanResolve: true,
                      viewerCanUnresolve: false,
                      resolvedBy: null,
                      comments: { nodes: [] },
                    },
                  },
                ],
                pageInfo: {
                  endCursor: "page-end-1",
                  hasNextPage: true,
                },
              },
            },
          },
        } as TData
      }

      return {
        repository: {
          pullRequest: {
            reviewThreads: {
              edges: [
                {
                  cursor: "cursor-2",
                  node: {
                    id: "thread-2",
                    path: "src/b.ts",
                    line: 20,
                    startLine: null,
                    diffSide: "RIGHT",
                    subjectType: "LINE",
                    isResolved: false,
                    isOutdated: false,
                    viewerCanReply: true,
                    viewerCanResolve: true,
                    viewerCanUnresolve: false,
                    resolvedBy: null,
                    comments: { nodes: [] },
                  },
                },
                {
                  cursor: "cursor-3",
                  node: {
                    id: "thread-3",
                    path: "src/c.ts",
                    line: 30,
                    startLine: null,
                    diffSide: "RIGHT",
                    subjectType: "LINE",
                    isResolved: false,
                    isOutdated: false,
                    viewerCanReply: true,
                    viewerCanResolve: true,
                    viewerCanUnresolve: false,
                    resolvedBy: null,
                    comments: { nodes: [] },
                  },
                },
              ],
              pageInfo: {
                endCursor: "page-end-2",
                hasNextPage: true,
              },
            },
          },
        },
      } as TData
    }

    const client = createGithubClient({ execute })
    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 2,
      unresolvedOnly: true,
      includeOutdated: true,
    })

    expect(list.items.map((item) => item.id)).toEqual(["thread-1", "thread-2"])
    expect(list.pageInfo.hasNextPage).toBe(true)
    expect(list.pageInfo.endCursor).toBe("cursor-2")
  })

  it("throws when pr.threads.list payload is missing threads", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: null,
          },
        } as TData
      },
    })

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1,
      }),
    ).rejects.toThrow("Pull request review threads not found")
  })

  it("throws when pr.threads.list unresolvedOnly/includeOutdated has invalid type", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1,
        unresolvedOnly: "yes" as unknown as boolean,
      }),
    ).rejects.toThrow("unresolvedOnly must be a boolean")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1,
        includeOutdated: "no" as unknown as boolean,
      }),
    ).rejects.toThrow("includeOutdated must be a boolean")
  })

  it("exposes typed pr.reviews.list helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviews: {
                nodes: [
                  {
                    id: "review-1",
                    body: "looks good",
                    state: "APPROVED",
                    submittedAt: "2025-01-01T00:00:00Z",
                    url: "https://example.com/review-1",
                    author: { login: "octocat" },
                    commit: { oid: "abc123" },
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        } as TData
      },
    })

    const reviews = await client.fetchPrReviewsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
    })

    expect(reviews.items[0]?.id).toBe("review-1")
    expect(reviews.items[0]?.authorLogin).toBe("octocat")
  })

  it("exposes typed pr.diff.files helper", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              files: {
                nodes: [
                  {
                    path: "src/index.ts",
                    additions: 5,
                    deletions: 1,
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        } as TData
      },
    })

    const files = await client.fetchPrDiffListFiles({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
    })

    expect(files.items[0]?.path).toBe("src/index.ts")
    expect(files.items[0]?.additions).toBe(5)
  })

  it("throws when pr.reviews.list payload is missing reviews", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: null,
          },
        } as TData
      },
    })

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 10,
      }),
    ).rejects.toThrow("Pull request reviews not found")
  })

  it("throws when pr.diff.files payload is missing files", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              files: null,
            },
          },
        } as TData
      },
    })

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 10,
      }),
    ).rejects.toThrow("Pull request files not found")
  })

  it("validates PR reviews and diff inputs before querying", async () => {
    const execute = vi.fn(async () => ({}))
    const client = createGithubClient({ execute } as never)

    await expect(
      client.fetchPrReviewsList({
        owner: "",
        name: "modkit",
        prNumber: 232,
        first: 10,
      }),
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "",
        prNumber: 232,
        first: 10,
      }),
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10,
      }),
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0,
      }),
    ).rejects.toThrow("List page size must be a positive integer")

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0,
      }),
    ).rejects.toThrow("List page size must be a positive integer")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10,
      }),
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrCommentsList({
        owner: "",
        name: "modkit",
        prNumber: 232,
        first: 10,
      }),
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10,
      }),
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0,
      }),
    ).rejects.toThrow("List page size must be a positive integer")

    expect(execute).not.toHaveBeenCalled()
  })

  it("normalizes nullable PR review and diff nodes", async () => {
    const client = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("query PrReviewsList")) {
          return {
            repository: {
              pullRequest: {
                reviews: {
                  nodes: [
                    null,
                    {
                      id: "review-1",
                      body: "",
                      state: "COMMENTED",
                      submittedAt: null,
                      url: "https://example.com/review-1",
                      author: null,
                      commit: null,
                    },
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                },
              },
            },
          } as TData
        }

        return {
          repository: {
            pullRequest: {
              files: {
                nodes: [
                  null,
                  {
                    path: "src/main.ts",
                    additions: 1,
                    deletions: 2,
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        } as TData
      },
    })

    const reviews = await client.fetchPrReviewsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
    })
    const files = await client.fetchPrDiffListFiles({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
    })

    expect(reviews.items).toHaveLength(1)
    expect(reviews.items[0]).toEqual(
      expect.objectContaining({
        id: "review-1",
        authorLogin: null,
        submittedAt: null,
        commitOid: null,
      }),
    )
    expect(files.items).toHaveLength(1)
    expect(files.items[0]).toEqual(
      expect.objectContaining({ path: "src/main.ts", additions: 1, deletions: 2 }),
    )
  })

  it("normalizes PR comments threads with malformed edges and nodes fallback", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [
                  null,
                  {
                    cursor: 123,
                    node: {
                      id: "thread-1",
                      path: 99,
                      line: "x",
                      startLine: "y",
                      diffSide: 1,
                      subjectType: 2,
                      isResolved: false,
                      isOutdated: false,
                      viewerCanReply: true,
                      viewerCanResolve: false,
                      viewerCanUnresolve: false,
                      resolvedBy: { login: 1 },
                      comments: {
                        nodes: [
                          null,
                          {
                            id: "comment-1",
                            body: 42,
                            createdAt: 42,
                            url: 42,
                            author: null,
                          },
                        ],
                      },
                    },
                  },
                ],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toEqual(
      expect.objectContaining({
        path: null,
        line: null,
        startLine: null,
        diffSide: null,
        subjectType: null,
        resolvedByLogin: null,
        comments: [
          expect.objectContaining({
            id: "comment-1",
            authorLogin: null,
            body: "",
            createdAt: "",
            url: "42",
          }),
        ],
      }),
    )
  })

  it("uses reviewThreads.nodes fallback when edges are unavailable", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: "thread-fallback",
                    path: "src/fallback.ts",
                    line: 20,
                    startLine: null,
                    diffSide: "RIGHT",
                    subjectType: "LINE",
                    isResolved: false,
                    isOutdated: false,
                    viewerCanReply: true,
                    viewerCanResolve: false,
                    viewerCanUnresolve: false,
                    resolvedBy: null,
                    comments: { nodes: [] },
                  },
                ],
                pageInfo: {
                  endCursor: "cursor-1",
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 1,
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe("thread-fallback")
    expect(list.pageInfo.endCursor).toBeNull()
  })

  it("applies PR comments filtering branches for invalid, resolved, and outdated threads", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [
                  { cursor: "invalid", node: null },
                  {
                    cursor: "resolved",
                    node: {
                      id: "thread-resolved",
                      path: "src/a.ts",
                      line: 10,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: true,
                      isOutdated: false,
                      viewerCanReply: true,
                      viewerCanResolve: false,
                      viewerCanUnresolve: false,
                      resolvedBy: null,
                      comments: { nodes: [] },
                    },
                  },
                  {
                    cursor: "outdated",
                    node: {
                      id: "thread-outdated",
                      path: "src/b.ts",
                      line: 11,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: false,
                      isOutdated: true,
                      viewerCanReply: true,
                      viewerCanResolve: false,
                      viewerCanUnresolve: false,
                      resolvedBy: null,
                      comments: { nodes: [] },
                    },
                  },
                  {
                    cursor: "kept",
                    node: {
                      id: "thread-kept",
                      path: "src/c.ts",
                      line: 12,
                      startLine: null,
                      diffSide: "RIGHT",
                      subjectType: "LINE",
                      isResolved: false,
                      isOutdated: false,
                      viewerCanReply: true,
                      viewerCanResolve: true,
                      viewerCanUnresolve: true,
                      resolvedBy: null,
                      comments: {
                        nodes: [
                          {
                            id: "comment-1",
                            body: "ok",
                            createdAt: "2025-01-02T00:00:00Z",
                            url: "https://example.com/comment-1",
                            author: { login: "hubot" },
                          },
                        ],
                      },
                    },
                  },
                ],
                pageInfo: {
                  endCursor: null,
                  hasNextPage: false,
                },
              },
            },
          },
        } as TData
      },
    })

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
      unresolvedOnly: true,
      includeOutdated: false,
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe("thread-kept")
    expect(list.scan.sourceItemsScanned).toBe(4)
  })

  it("supports pr review-thread mutations", async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes("mutation PrCommentReply")) {
        return {
          addPullRequestReviewThreadReply: {
            comment: { id: "comment-1" },
          },
        }
      }

      if (query.includes("mutation PrCommentResolve")) {
        return {
          resolveReviewThread: {
            thread: { id: "thread-1", isResolved: true },
          },
        }
      }

      if (query.includes("mutation PrCommentUnresolve")) {
        return {
          unresolveReviewThread: {
            thread: { id: "thread-1", isResolved: false },
          },
        }
      }

      if (query.includes("query ReviewThreadState")) {
        return {
          node: {
            id: "thread-1",
            isResolved: true,
          },
        }
      }

      throw new Error("unexpected query")
    })

    const client = createGithubClient({ execute } as never)

    await expect(
      client.replyToReviewThread({ threadId: "thread-1", body: "done" }),
    ).resolves.toEqual({
      id: "thread-1",
      isResolved: true,
      commentId: "comment-1",
      commentUrl: "",
    })
    await expect(client.resolveReviewThread({ threadId: "thread-1" })).resolves.toEqual({
      id: "thread-1",
      isResolved: true,
    })
    await expect(client.unresolveReviewThread({ threadId: "thread-1" })).resolves.toEqual({
      id: "thread-1",
      isResolved: false,
    })
  })

  it("throws when pr.threads.reply mutation payload is missing comment", async () => {
    const client = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation PrCommentReply")) {
          return {
            addPullRequestReviewThreadReply: {
              comment: null,
            },
          } as TData
        }

        return {
          node: {
            id: "thread-1",
            isResolved: true,
          },
        } as TData
      },
    })

    await expect(
      client.replyToReviewThread({ threadId: "thread-1", body: "done" }),
    ).rejects.toThrow("Review thread mutation failed")
  })

  it("throws when pr.threads.reply thread-state lookup returns no node", async () => {
    const client = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation PrCommentReply")) {
          return {
            addPullRequestReviewThreadReply: {
              comment: { id: "comment-1" },
            },
          } as TData
        }

        return {
          node: null,
        } as TData
      },
    })

    await expect(
      client.replyToReviewThread({ threadId: "thread-1", body: "done" }),
    ).rejects.toThrow("Review thread state lookup failed")
  })

  it("throws when pr.threads.resolve payload has no thread", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          resolveReviewThread: {
            thread: null,
          },
        } as TData
      },
    })

    await expect(client.resolveReviewThread({ threadId: "thread-1" })).rejects.toThrow(
      "Review thread mutation failed",
    )
  })

  it("validates non-empty review thread id for thread mutations", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          resolveReviewThread: {
            thread: { id: "thread-1", isResolved: true },
          },
        } as TData
      },
    })

    await expect(client.resolveReviewThread({ threadId: " " })).rejects.toThrow(
      "Review thread id is required",
    )
    await expect(client.resolveReviewThread({ threadId: 1 as unknown as string })).rejects.toThrow(
      "Review thread id is required",
    )
  })

  it("validates non-empty body for pr.threads.reply", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          addPullRequestReviewThreadReply: {
            comment: { id: "comment-1" },
          },
        } as TData
      },
    })

    await expect(client.replyToReviewThread({ threadId: "thread-1", body: "   " })).rejects.toThrow(
      "Reply body is required",
    )
    await expect(
      client.replyToReviewThread({ threadId: "thread-1", body: 1 as unknown as string }),
    ).rejects.toThrow("Reply body is required")
  })

  it("supports issue lifecycle, metadata, and relation helpers", async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes("query IssueCreateRepositoryId")) {
        return {
          repository: {
            id: "repo-1",
          },
        }
      }

      if (query.includes("mutation IssueCreate")) {
        return {
          createIssue: {
            issue: {
              id: "issue-1",
              number: 501,
              title: "Created issue",
              state: "OPEN",
              url: "https://example.com/issues/501",
            },
          },
        }
      }

      if (query.includes("mutation IssueUpdate")) {
        return {
          updateIssue: {
            issue: {
              id: "issue-1",
              number: 501,
              title: "Updated issue",
              state: "OPEN",
              url: "https://example.com/issues/501",
            },
          },
        }
      }

      if (query.includes("mutation IssueClose")) {
        return {
          closeIssue: {
            issue: {
              id: "issue-1",
              number: 501,
              state: "CLOSED",
            },
          },
        }
      }

      if (query.includes("mutation IssueReopen")) {
        return {
          reopenIssue: {
            issue: {
              id: "issue-1",
              number: 501,
              state: "OPEN",
            },
          },
        }
      }

      if (query.includes("mutation IssueDelete")) {
        return {
          deleteIssue: {
            clientMutationId: "ok",
          },
        }
      }

      if (query.includes("mutation IssueLabelsUpdate")) {
        return {
          updateIssue: {
            issue: {
              id: "issue-1",
              labels: {
                nodes: [{ name: "bug" }, { name: "batch-b" }],
              },
            },
          },
        }
      }

      if (query.includes("query IssueLabelsLookup")) {
        return {
          repository: {
            issue: { id: "issue-1" },
            labels: {
              nodes: [
                { id: "label-bug", name: "bug" },
                { id: "label-batch-b", name: "batch-b" },
              ],
            },
          },
        }
      }

      if (query.includes("mutation IssueAssigneesUpdate")) {
        return {
          updateIssue: {
            issue: {
              id: "issue-1",
              assignees: {
                nodes: [{ login: "octocat" }],
              },
            },
          },
        }
      }

      if (query.includes("query IssueAssigneesLookup")) {
        return {
          repository: {
            issue: { id: "issue-1" },
            assignableUsers: {
              nodes: [{ id: "user-octocat", login: "octocat" }],
            },
          },
        }
      }

      if (query.includes("mutation IssueMilestoneSet")) {
        return {
          updateIssue: {
            issue: {
              id: "issue-1",
              milestone: {
                number: 3,
              },
            },
          },
        }
      }

      if (query.includes("query IssueMilestoneLookupByNumber")) {
        return {
          repository: {
            issue: { id: "issue-1" },
            milestone: { id: "milestone-3" },
          },
        }
      }

      if (query.includes("query IssueNodeIdLookup")) {
        return {
          repository: {
            issue: { id: "issue-1" },
          },
        }
      }

      if (query.includes("mutation IssueCommentCreate")) {
        return {
          addComment: {
            commentEdge: {
              node: {
                id: "comment-1",
                body: "ack",
                url: "https://example.com/comment/1",
              },
            },
          },
        }
      }

      if (query.includes("query IssueLinkedPrsList")) {
        return {
          repository: {
            issue: {
              timelineItems: {
                nodes: [
                  {
                    __typename: "ConnectedEvent",
                    subject: {
                      __typename: "PullRequest",
                      id: "pr-1",
                      number: 42,
                      title: "Fixes #501",
                      state: "OPEN",
                      url: "https://example.com/pull/42",
                    },
                  },
                ],
              },
            },
          },
        }
      }

      if (query.includes("query IssueRelationsGet")) {
        return {
          repository: {
            issue: {
              id: "issue-1",
              number: 501,
              parent: {
                id: "issue-parent",
                number: 500,
              },
              subIssues: {
                nodes: [{ id: "issue-child", number: 502 }],
              },
              blockedBy: {
                nodes: [{ id: "issue-blocker", number: 499 }],
              },
            },
          },
        }
      }

      if (query.includes("mutation IssueParentSet")) {
        return {
          addSubIssue: {
            issue: { id: "issue-parent" },
            subIssue: { id: "issue-child" },
          },
        }
      }

      if (query.includes("query IssueParentLookup")) {
        return {
          node: {
            id: "issue-child",
            parent: { id: "issue-parent" },
          },
        }
      }

      if (query.includes("mutation IssueParentRemove")) {
        return {
          removeSubIssue: {
            issue: { id: "issue-parent" },
            subIssue: { id: "issue-child" },
          },
        }
      }

      if (query.includes("mutation IssueBlockedByAdd")) {
        return {
          addBlockedBy: {
            issue: { id: "issue-1" },
            blockingIssue: { id: "issue-blocker" },
          },
        }
      }

      if (query.includes("mutation IssueBlockedByRemove")) {
        return {
          removeBlockedBy: {
            issue: { id: "issue-1" },
            blockingIssue: { id: "issue-blocker" },
          },
        }
      }

      throw new Error("unexpected query")
    })

    const client = createGithubClient({ execute } as never)

    await expect(
      client.createIssue({ owner: "acme", name: "modkit", title: "Created issue" }),
    ).resolves.toEqual(
      expect.objectContaining({ id: "issue-1", number: 501, title: "Created issue" }),
    )
    await expect(
      client.updateIssue({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        title: "Updated issue",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", title: "Updated issue" }))
    await expect(
      client.closeIssue({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", state: "CLOSED", closed: true }))
    await expect(
      client.reopenIssue({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", state: "OPEN", reopened: true }))
    await expect(
      client.deleteIssue({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", deleted: true }))
    await expect(
      client.updateIssueLabels({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        labels: ["bug", "batch-b"],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", labels: ["bug", "batch-b"] }))
    await expect(
      client.updateIssueAssignees({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        assignees: ["octocat"],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", assignees: ["octocat"] }))
    await expect(
      client.setIssueMilestone({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        milestoneNumber: 3,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "issue-1", milestoneNumber: 3 }))
    await expect(
      client.createIssueComment({ owner: "acme", name: "modkit", issueNumber: 501, body: "ack" }),
    ).resolves.toEqual(expect.objectContaining({ id: "comment-1", body: "ack" }))
    await expect(
      client.fetchIssueLinkedPrs({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).resolves.toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ id: "pr-1", number: 42 })] }),
    )
    await expect(
      client.fetchIssueRelations({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).resolves.toEqual(
      expect.objectContaining({
        issue: expect.objectContaining({ id: "issue-1", number: 501 }),
        parent: expect.objectContaining({ id: "issue-parent", number: 500 }),
      }),
    )
    await expect(
      client.setIssueParent({ issueId: "issue-child", parentIssueId: "issue-parent" }),
    ).resolves.toEqual(
      expect.objectContaining({ issueId: "issue-child", parentIssueId: "issue-parent" }),
    )
    await expect(client.removeIssueParent({ issueId: "issue-child" })).resolves.toEqual(
      expect.objectContaining({ issueId: "issue-child", parentRemoved: true }),
    )
    await expect(
      client.addIssueBlockedBy({ issueId: "issue-1", blockedByIssueId: "issue-blocker" }),
    ).resolves.toEqual(
      expect.objectContaining({ issueId: "issue-1", blockedByIssueId: "issue-blocker" }),
    )
    await expect(
      client.removeIssueBlockedBy({ issueId: "issue-1", blockedByIssueId: "issue-blocker" }),
    ).resolves.toEqual(
      expect.objectContaining({
        issueId: "issue-1",
        blockedByIssueId: "issue-blocker",
        removed: true,
      }),
    )
  })

  it("covers issue mutation error branches for lookups and malformed payloads", async () => {
    const createRepoMissingClient = createGithubClient({
      execute: vi.fn(async () => ({ repository: { id: null } })),
    } as never)
    await expect(
      createRepoMissingClient.createIssue({ owner: "acme", name: "repo", title: "hello" }),
    ).rejects.toThrow("Repository not found")

    const createMalformedNodeClient = createGithubClient({
      execute: vi
        .fn()
        .mockResolvedValueOnce({ repository: { id: "repo-1" } })
        .mockResolvedValueOnce({ createIssue: { issue: { id: "issue-1" } } }),
    } as never)
    await expect(
      createMalformedNodeClient.createIssue({ owner: "acme", name: "repo", title: "hello" }),
    ).rejects.toThrow("Issue mutation failed")

    const deleteMissingMutationClient = createGithubClient({
      execute: vi
        .fn()
        .mockResolvedValueOnce({ repository: { issue: { id: "issue-1" } } })
        .mockResolvedValueOnce({ deleteIssue: null }),
    } as never)
    await expect(
      deleteMissingMutationClient.deleteIssue({ owner: "acme", name: "modkit", issueNumber: 501 }),
    ).rejects.toThrow("Issue deletion failed")

    const labelsLookupMissingClient = createGithubClient({
      execute: vi.fn(async () => ({
        repository: { issue: { id: "issue-1" }, labels: { nodes: [] } },
      })),
    } as never)
    await expect(
      labelsLookupMissingClient.updateIssueLabels({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        labels: ["bug"],
      }),
    ).rejects.toThrow("Label not found: bug")

    const assigneesLookupMissingClient = createGithubClient({
      execute: vi.fn(async () => ({
        repository: { issue: { id: "issue-1" }, assignableUsers: { nodes: [] } },
      })),
    } as never)
    await expect(
      assigneesLookupMissingClient.updateIssueAssignees({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        assignees: ["octocat"],
      }),
    ).rejects.toThrow("Assignee not found: octocat")

    const milestoneLookupMissingClient = createGithubClient({
      execute: vi
        .fn()
        .mockResolvedValueOnce({ repository: { issue: { id: "issue-1" }, milestone: null } }),
    } as never)
    await expect(
      milestoneLookupMissingClient.setIssueMilestone({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        milestoneNumber: 2,
      }),
    ).rejects.toThrow("Milestone not found: 2")

    const commentMalformedClient = createGithubClient({
      execute: vi
        .fn()
        .mockResolvedValueOnce({ repository: { issue: { id: "issue-1" } } })
        .mockResolvedValueOnce({ addComment: { commentEdge: { node: { id: "comment-1" } } } }),
    } as never)
    await expect(
      commentMalformedClient.createIssueComment({
        owner: "acme",
        name: "modkit",
        issueNumber: 501,
        body: "ack",
      }),
    ).rejects.toThrow("Issue comment creation failed")
  })

  it("covers issue relation and dependency failure paths", async () => {
    const relationsMissingClient = createGithubClient({
      execute: vi.fn(async () => ({ repository: { issue: null } })),
    } as never)
    await expect(
      relationsMissingClient.fetchIssueRelations({ owner: "acme", name: "repo", issueNumber: 1 }),
    ).rejects.toThrow("Issue relations not found")

    const parentSetMissingIdsClient = createGithubClient({
      execute: vi.fn(async () => ({ addSubIssue: { issue: {}, subIssue: {} } })),
    } as never)
    await expect(
      parentSetMissingIdsClient.setIssueParent({ issueId: "issue-1", parentIssueId: "issue-2" }),
    ).rejects.toThrow("Issue parent update failed")

    const parentLookupMissingClient = createGithubClient({
      execute: vi.fn(async () => ({ node: { parent: null } })),
    } as never)
    await expect(
      parentLookupMissingClient.removeIssueParent({ issueId: "issue-1" }),
    ).rejects.toThrow("Issue parent removal failed")

    const parentRemoveMissingIdsClient = createGithubClient({
      execute: vi
        .fn()
        .mockResolvedValueOnce({ node: { parent: { id: "issue-parent" } } })
        .mockResolvedValueOnce({ removeSubIssue: { issue: {}, subIssue: {} } }),
    } as never)
    await expect(
      parentRemoveMissingIdsClient.removeIssueParent({ issueId: "issue-1" }),
    ).rejects.toThrow("Issue parent removal failed")

    const blockedByAddMissingIdsClient = createGithubClient({
      execute: vi.fn(async () => ({ addBlockedBy: { issue: {}, blockingIssue: {} } })),
    } as never)
    await expect(
      blockedByAddMissingIdsClient.addIssueBlockedBy({
        issueId: "issue-1",
        blockedByIssueId: "issue-2",
      }),
    ).rejects.toThrow("Issue dependency mutation failed")

    const blockedByRemoveMissingIdsClient = createGithubClient({
      execute: vi.fn(async () => ({ removeBlockedBy: { issue: {}, blockingIssue: {} } })),
    } as never)
    await expect(
      blockedByRemoveMissingIdsClient.removeIssueBlockedBy({
        issueId: "issue-1",
        blockedByIssueId: "issue-2",
      }),
    ).rejects.toThrow("Issue dependency mutation failed")
  })

  it("filters malformed linked PR and issue relation nodes", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        repository: {
          issue: {
            timelineItems: {
              nodes: [
                {
                  subject: {
                    __typename: "PullRequest",
                    id: "pr-1",
                    number: 2,
                    title: "ok",
                    state: "OPEN",
                    url: "u",
                  },
                },
                {
                  subject: {
                    __typename: "PullRequest",
                    id: "pr-2",
                    number: "bad",
                    title: "skip",
                    state: "OPEN",
                    url: "u",
                  },
                },
              ],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        repository: {
          issue: {
            id: "issue-1",
            number: 10,
            parent: { id: 1 },
            subIssues: { nodes: [{ id: "issue-2", number: 11 }, { id: "bad" }] },
            blockedBy: { nodes: [{ id: "issue-3", number: 7 }, { number: 9 }] },
          },
        },
      })

    const client = createGithubClient({ execute } as never)

    const linked = await client.fetchIssueLinkedPrs({
      owner: "acme",
      name: "repo",
      issueNumber: 10,
    })
    const relations = await client.fetchIssueRelations({
      owner: "acme",
      name: "repo",
      issueNumber: 10,
    })

    expect(linked.items).toEqual([{ id: "pr-1", number: 2, title: "ok", state: "OPEN", url: "u" }])
    expect(relations.parent).toBeNull()
    expect(relations.children).toEqual([{ id: "issue-2", number: 11 }])
    expect(relations.blockedBy).toEqual([{ id: "issue-3", number: 7 }])
  })
})

describe("createGithubClientFromToken", () => {
  it("throws when token is empty", () => {
    expect(() => createGithubClientFromToken("")).toThrow("GitHub token is required")
  })

  it("throws when token is whitespace", () => {
    expect(() => createGithubClientFromToken("   ")).toThrow("GitHub token is required")
  })

  it("accepts a token string and returns a client with expected methods", () => {
    const client = createGithubClientFromToken("ghp_test123")

    expect(client).toBeDefined()
    expect(typeof client.query).toBe("function")
    expect(typeof client.fetchRepoView).toBe("function")
    expect(typeof client.fetchIssueView).toBe("function")
    expect(typeof client.fetchPrView).toBe("function")
  })

  it("accepts an options object with token", () => {
    const client = createGithubClientFromToken({ token: "ghp_test123" })

    expect(client).toBeDefined()
    expect(typeof client.query).toBe("function")
  })

  it("accepts an options object with token and graphqlUrl", () => {
    const client = createGithubClientFromToken({
      token: "ghp_test123",
      graphqlUrl: "https://ghe.example.com/api/graphql",
    })

    expect(client).toBeDefined()
    expect(typeof client.query).toBe("function")
  })

  it("reads GITHUB_GRAPHQL_URL from env when no graphqlUrl provided", () => {
    const originalEnv = process.env.GITHUB_GRAPHQL_URL
    process.env.GITHUB_GRAPHQL_URL = "https://custom.example.com/graphql"

    try {
      const client = createGithubClientFromToken("ghp_test123")
      expect(client).toBeDefined()
    } finally {
      if (originalEnv === undefined) {
        delete process.env.GITHUB_GRAPHQL_URL
      } else {
        process.env.GITHUB_GRAPHQL_URL = originalEnv
      }
    }
  })

  it("reads GH_HOST from env when GITHUB_GRAPHQL_URL is not set", () => {
    const originalGraphqlUrl = process.env.GITHUB_GRAPHQL_URL
    const originalHost = process.env.GH_HOST
    delete process.env.GITHUB_GRAPHQL_URL
    process.env.GH_HOST = "ghe.corp.example.com"

    try {
      const client = createGithubClientFromToken("ghp_test123")
      expect(client).toBeDefined()
    } finally {
      if (originalGraphqlUrl === undefined) {
        delete process.env.GITHUB_GRAPHQL_URL
      } else {
        process.env.GITHUB_GRAPHQL_URL = originalGraphqlUrl
      }
      if (originalHost === undefined) {
        delete process.env.GH_HOST
      } else {
        process.env.GH_HOST = originalHost
      }
    }
  })

  it("issues a fetch call when executing a query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          repository: {
            id: "R_123",
            name: "test",
            nameWithOwner: "owner/test",
            isPrivate: false,
            stargazerCount: 0,
            forkCount: 0,
            url: "https://github.com/owner/test",
            defaultBranchRef: { name: "main" },
          },
        },
      }),
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const client = createGithubClientFromToken("ghp_test_token")
      const result = await client.fetchRepoView({ owner: "owner", name: "test" })

      expect(result.name).toBe("test")
      expect(result.nameWithOwner).toBe("owner/test")
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe("https://api.github.com/graphql")
      expect((options.headers as Record<string, string>).authorization).toBe(
        "Bearer ghp_test_token",
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws on non-ok HTTP response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Bad credentials" }),
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const client = createGithubClientFromToken("ghp_bad_token")
      await expect(client.fetchRepoView({ owner: "o", name: "r" })).rejects.toThrow(
        "Bad credentials",
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws on GraphQL errors in response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: "Field 'xyz' not found" }],
      }),
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const client = createGithubClientFromToken("ghp_test")
      await expect(client.fetchRepoView({ owner: "o", name: "r" })).rejects.toThrow(
        "Field 'xyz' not found",
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws when GraphQL response has no data", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const client = createGithubClientFromToken("ghp_test")
      await expect(client.fetchRepoView({ owner: "o", name: "r" })).rejects.toThrow(
        "GraphQL response missing data",
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("uses custom graphqlUrl when provided in options", async () => {
    const customUrl = "https://ghe.corp.example.com/api/graphql"
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          repository: {
            id: "R_1",
            name: "test",
            nameWithOwner: "o/test",
            isPrivate: false,
            stargazerCount: 0,
            forkCount: 0,
            url: "https://ghe.corp.example.com/o/test",
            defaultBranchRef: null,
          },
        },
      }),
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const client = createGithubClientFromToken({ token: "ghp_ent", graphqlUrl: customUrl })
      await client.fetchRepoView({ owner: "o", name: "test" })

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toBe(customUrl)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe("createGithubClient — release helpers", () => {
  it("delegates fetchReleaseView to the release domain", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        release: {
          databaseId: 10,
          tagName: "v2.0.0",
          name: "Release 2.0.0",
          isDraft: false,
          isPrerelease: false,
          url: "https://github.com/acme/repo/releases/tag/v2.0.0",
          createdAt: "2025-06-01T00:00:00Z",
          publishedAt: "2025-06-01T12:00:00Z",
          tagCommit: { oid: "deadbeef" },
        },
      },
    })
    const client = createGithubClient({ execute })

    const result = await client.fetchReleaseView({ owner: "acme", name: "repo", tagName: "v2.0.0" })

    expect(result.tagName).toBe("v2.0.0")
    expect(result.id).toBe(10)
    expect(result.targetCommitish).toBe("deadbeef")
  })

  it("delegates fetchReleaseList to the release domain", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        releases: {
          nodes: [
            {
              databaseId: 5,
              tagName: "v1.0.0",
              name: "Release 1.0.0",
              isDraft: false,
              isPrerelease: false,
              url: "https://github.com/acme/repo/releases/tag/v1.0.0",
              createdAt: "2025-01-01T00:00:00Z",
              publishedAt: null,
              tagCommit: null,
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const client = createGithubClient({ execute })

    const result = await client.fetchReleaseList({ owner: "acme", name: "repo", first: 10 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.tagName).toBe("v1.0.0")
    expect(result.pageInfo.hasNextPage).toBe(false)
  })
})

describe("createGithubClient — issue assignee add/remove helpers", () => {
  function makeAssigneesExecute() {
    return vi.fn().mockImplementation(async (query: string) => {
      if (
        query.includes("IssueAssigneesLookupByNumber") ||
        query.includes("IssueAssigneesLookup")
      ) {
        return {
          repository: {
            issue: { id: "issue-abc" },
            assignableUsers: {
              nodes: [{ id: "user-alice", login: "alice" }],
            },
          },
        }
      }
      if (query.includes("mutation IssueAssigneesAdd")) {
        return {
          addAssigneesToAssignable: {
            assignable: {
              id: "issue-abc",
              assignees: { nodes: [{ login: "alice" }] },
            },
          },
        }
      }
      if (query.includes("mutation IssueAssigneesRemove")) {
        return {
          removeAssigneesFromAssignable: {
            assignable: {
              id: "issue-abc",
              assignees: { nodes: [] },
            },
          },
        }
      }
      throw new Error(`unexpected query: ${query}`)
    })
  }

  it("delegates addIssueAssignees to the issue-mutations domain", async () => {
    const execute = makeAssigneesExecute()
    const client = createGithubClient({ execute })

    const result = await client.addIssueAssignees({
      owner: "acme",
      name: "repo",
      issueNumber: 1,
      assignees: ["alice"],
    })

    expect(result.id).toBe("issue-abc")
    expect(result.assignees).toEqual(["alice"])
  })

  it("delegates removeIssueAssignees to the issue-mutations domain", async () => {
    const execute = makeAssigneesExecute()
    const client = createGithubClient({ execute })

    const result = await client.removeIssueAssignees({
      owner: "acme",
      name: "repo",
      issueNumber: 1,
      assignees: ["alice"],
    })

    expect(result.id).toBe("issue-abc")
    expect(result.assignees).toEqual([])
  })
})
