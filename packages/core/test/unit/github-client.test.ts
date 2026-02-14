import { describe, expect, it, vi } from "vitest"

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

  it("exposes typed pr.comments.list helper with unresolved filtering", async () => {
    const execute = async <TData>(_query: string, variables?: Record<string, unknown>): Promise<TData> => {
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
                            author: { login: "octocat" }
                          }
                        ]
                      }
                    }
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
                          author: { login: "hubot" }
                        }
                      ]
                    }
                  }
                }
              ],
              pageInfo: {
                endCursor: null,
                hasNextPage: false
              }
            }
          }
        }
      } as TData
    }

    const client = createGithubClient({ execute })
    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 1,
      unresolvedOnly: true,
      includeOutdated: false
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
                      comments: { nodes: [] }
                    }
                  }
                ],
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

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
      unresolvedOnly: false,
      includeOutdated: false
    })

    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.id).toBe("thread-outdated")
  })

  it("returns cursor for last returned filtered item", async () => {
    const execute = async <TData>(_query: string, variables?: Record<string, unknown>): Promise<TData> => {
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
                      comments: { nodes: [] }
                    }
                  }
                ],
                pageInfo: {
                  endCursor: "page-end-1",
                  hasNextPage: true
                }
              }
            }
          }
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
                    comments: { nodes: [] }
                  }
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
                    comments: { nodes: [] }
                  }
                }
              ],
              pageInfo: {
                endCursor: "page-end-2",
                hasNextPage: true
              }
            }
          }
        }
      } as TData
    }

    const client = createGithubClient({ execute })
    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 2,
      unresolvedOnly: true,
      includeOutdated: true
    })

    expect(list.items.map((item) => item.id)).toEqual(["thread-1", "thread-2"])
    expect(list.pageInfo.hasNextPage).toBe(true)
    expect(list.pageInfo.endCursor).toBe("cursor-2")
  })

  it("throws when pr.comments.list payload is missing threads", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: null
          }
        } as TData
      }
    })

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1
      })
    ).rejects.toThrow("Pull request review threads not found")
  })

  it("throws when pr.comments.list unresolvedOnly/includeOutdated has invalid type", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                edges: [],
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
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1,
        unresolvedOnly: "yes" as unknown as boolean
      })
    ).rejects.toThrow("unresolvedOnly must be a boolean")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 1,
        includeOutdated: "no" as unknown as boolean
      })
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
                    commit: { oid: "abc123" }
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null
                }
              }
            }
          }
        } as TData
      }
    })

    const reviews = await client.fetchPrReviewsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10
    })

    expect(reviews.items[0]?.id).toBe("review-1")
    expect(reviews.items[0]?.authorLogin).toBe("octocat")
  })

  it("exposes typed pr.diff.list_files helper", async () => {
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
                    deletions: 1
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null
                }
              }
            }
          }
        } as TData
      }
    })

    const files = await client.fetchPrDiffListFiles({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10
    })

    expect(files.items[0]?.path).toBe("src/index.ts")
    expect(files.items[0]?.additions).toBe(5)
  })

  it("throws when pr.reviews.list payload is missing reviews", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: null
          }
        } as TData
      }
    })

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 10
      })
    ).rejects.toThrow("Pull request reviews not found")
  })

  it("throws when pr.diff.list_files payload is missing files", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              files: null
            }
          }
        } as TData
      }
    })

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 10
      })
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
        first: 10
      })
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "",
        prNumber: 232,
        first: 10
      })
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10
      })
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0
      })
    ).rejects.toThrow("List page size must be a positive integer")

    await expect(
      client.fetchPrReviewsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0
      })
    ).rejects.toThrow("List page size must be a positive integer")

    await expect(
      client.fetchPrDiffListFiles({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10
      })
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrCommentsList({
        owner: "",
        name: "modkit",
        prNumber: 232,
        first: 10
      })
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
        first: 10
      })
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      client.fetchPrCommentsList({
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        first: 0
      })
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
                      commit: null
                    }
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  }
                }
              }
            }
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
                    deletions: 2
                  }
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null
                }
              }
            }
          }
        } as TData
      }
    })

    const reviews = await client.fetchPrReviewsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10
    })
    const files = await client.fetchPrDiffListFiles({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10
    })

    expect(reviews.items).toHaveLength(1)
    expect(reviews.items[0]).toEqual(
      expect.objectContaining({
        id: "review-1",
        authorLogin: null,
        submittedAt: null,
        commitOid: null
      })
    )
    expect(files.items).toHaveLength(1)
    expect(files.items[0]).toEqual(expect.objectContaining({ path: "src/main.ts", additions: 1, deletions: 2 }))
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
                            author: null
                          }
                        ]
                      }
                    }
                  }
                ],
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

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10
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
            url: "42"
          })
        ]
      })
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
                    comments: { nodes: [] }
                  }
                ],
                pageInfo: {
                  endCursor: "cursor-1",
                  hasNextPage: false
                }
              }
            }
          }
        } as TData
      }
    })

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 1
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
                      comments: { nodes: [] }
                    }
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
                      comments: { nodes: [] }
                    }
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
                            author: { login: "hubot" }
                          }
                        ]
                      }
                    }
                  }
                ],
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

    const list = await client.fetchPrCommentsList({
      owner: "go-modkit",
      name: "modkit",
      prNumber: 232,
      first: 10,
      unresolvedOnly: true,
      includeOutdated: false
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
            comment: { id: "comment-1" }
          }
        }
      }

      if (query.includes("mutation PrCommentResolve")) {
        return {
          resolveReviewThread: {
            thread: { id: "thread-1", isResolved: true }
          }
        }
      }

      if (query.includes("mutation PrCommentUnresolve")) {
        return {
          unresolveReviewThread: {
            thread: { id: "thread-1", isResolved: false }
          }
        }
      }

      if (query.includes("query ReviewThreadState")) {
        return {
          node: {
            id: "thread-1",
            isResolved: true
          }
        }
      }

      throw new Error("unexpected query")
    })

    const client = createGithubClient({ execute } as never)

    await expect(client.replyToReviewThread({ threadId: "thread-1", body: "done" })).resolves.toEqual({
      id: "thread-1",
      isResolved: true
    })
    await expect(client.resolveReviewThread({ threadId: "thread-1" })).resolves.toEqual({
      id: "thread-1",
      isResolved: true
    })
    await expect(client.unresolveReviewThread({ threadId: "thread-1" })).resolves.toEqual({
      id: "thread-1",
      isResolved: false
    })
  })

  it("throws when pr.comment.reply mutation payload is missing comment", async () => {
    const client = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation PrCommentReply")) {
          return {
            addPullRequestReviewThreadReply: {
              comment: null
            }
          } as TData
        }

        return {
          node: {
            id: "thread-1",
            isResolved: true
          }
        } as TData
      }
    })

    await expect(client.replyToReviewThread({ threadId: "thread-1", body: "done" })).rejects.toThrow(
      "Review thread mutation failed"
    )
  })

  it("throws when pr.comment.reply thread-state lookup returns no node", async () => {
    const client = createGithubClient({
      async execute<TData>(query: string): Promise<TData> {
        if (query.includes("mutation PrCommentReply")) {
          return {
            addPullRequestReviewThreadReply: {
              comment: { id: "comment-1" }
            }
          } as TData
        }

        return {
          node: null
        } as TData
      }
    })

    await expect(client.replyToReviewThread({ threadId: "thread-1", body: "done" })).rejects.toThrow(
      "Review thread state lookup failed"
    )
  })

  it("throws when pr.comment.resolve payload has no thread", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          resolveReviewThread: {
            thread: null
          }
        } as TData
      }
    })

    await expect(client.resolveReviewThread({ threadId: "thread-1" })).rejects.toThrow("Review thread mutation failed")
  })

  it("validates non-empty review thread id for thread mutations", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          resolveReviewThread: {
            thread: { id: "thread-1", isResolved: true }
          }
        } as TData
      }
    })

    await expect(client.resolveReviewThread({ threadId: " " })).rejects.toThrow("Review thread id is required")
    await expect(client.resolveReviewThread({ threadId: 1 as unknown as string })).rejects.toThrow(
      "Review thread id is required"
    )
  })

  it("validates non-empty body for pr.comment.reply", async () => {
    const client = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          addPullRequestReviewThreadReply: {
            comment: { id: "comment-1" }
          }
        } as TData
      }
    })

    await expect(client.replyToReviewThread({ threadId: "thread-1", body: "   " })).rejects.toThrow(
      "Reply body is required"
    )
    await expect(client.replyToReviewThread({ threadId: "thread-1", body: 1 as unknown as string })).rejects.toThrow(
      "Reply body is required"
    )
  })
})
