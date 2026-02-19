import { describe, expect, it, vi } from "vitest"
import { runPrCommentsList, runSubmitPrReview } from "../../src/gql/domains/pr-mutations.js"
import type { GraphqlTransport } from "../../src/gql/transport.js"

describe("runSubmitPrReview", () => {
  it("validates required repository and event fields", async () => {
    const transport: GraphqlTransport = {
      execute: vi.fn(),
    }

    await expect(
      runSubmitPrReview(transport, {
        owner: "",
        name: "repo",
        prNumber: 1,
        event: "COMMENT",
      }),
    ).rejects.toThrow("Repository owner and name are required")

    await expect(
      runSubmitPrReview(transport, {
        owner: "owner",
        name: "repo",
        prNumber: 0,
        event: "COMMENT",
      }),
    ).rejects.toThrow("PR number must be a positive integer")

    await expect(
      runSubmitPrReview(transport, {
        owner: "owner",
        name: "repo",
        prNumber: 1,
        event: "",
      }),
    ).rejects.toThrow("Review event is required")
  })

  it("throws when pull request id lookup fails", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: null,
      },
    })
    const transport: GraphqlTransport = { execute }

    await expect(
      runSubmitPrReview(transport, {
        owner: "owner",
        name: "repo",
        prNumber: 1,
        event: "COMMENT",
      }),
    ).rejects.toThrow("Failed to retrieve pull request ID")
  })

  it("submits review with optional body omitted and no threads", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        repository: {
          pullRequest: { id: "PR_1" },
        },
      })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: {
            id: "R_1",
            state: "APPROVED",
            url: "https://example.com/review/1",
            body: null,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runSubmitPrReview(transport, {
      owner: "owner",
      name: "repo",
      prNumber: 1,
      event: "APPROVE",
    })

    expect(result).toEqual({
      id: "R_1",
      state: "APPROVED",
      url: "https://example.com/review/1",
      body: null,
    })
    expect(execute).toHaveBeenCalledTimes(2)

    const secondCallVariables = execute.mock.calls[1]?.[1] as Record<string, unknown>
    expect(secondCallVariables).toMatchObject({
      pullRequestId: "PR_1",
      event: "APPROVE",
    })
    expect(secondCallVariables).not.toHaveProperty("body")
    expect(secondCallVariables).not.toHaveProperty("threads")
  })

  it("throws when review mutation payload does not contain review id", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        repository: {
          pullRequest: { id: "PR_1" },
        },
      })
      .mockResolvedValueOnce({
        addPullRequestReview: {
          pullRequestReview: {
            state: "COMMENTED",
            url: "https://example.com/review/1",
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    await expect(
      runSubmitPrReview(transport, {
        owner: "owner",
        name: "repo",
        prNumber: 2,
        event: "COMMENT",
        body: "LGTM",
        comments: [{ path: "src/index.ts", body: "Fix this", line: 10, side: "RIGHT" }],
      }),
    ).rejects.toThrow("Failed to parse pull request review response")
  })
})

describe("runPrCommentsList", () => {
  it("uses node fallback and source end cursor when thread cursor is absent", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "T_1",
                path: "src/index.ts",
                line: 42,
                startLine: null,
                diffSide: "RIGHT",
                subjectType: "LINE",
                isResolved: false,
                isOutdated: false,
                viewerCanReply: true,
                viewerCanResolve: true,
                viewerCanUnresolve: false,
                resolvedBy: null,
                comments: {
                  nodes: [
                    {
                      id: "C_1",
                      author: { login: "octocat" },
                      body: "please fix",
                      createdAt: "2026-02-19T00:00:00Z",
                      url: "https://example.com/comment/1",
                    },
                  ],
                },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: "cursor-from-source",
            },
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsList(transport, {
      owner: "owner",
      name: "repo",
      prNumber: 1,
      first: 1,
      unresolvedOnly: true,
      includeOutdated: true,
    })

    expect(result.items).toHaveLength(1)
    expect(result.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: "cursor-from-source",
    })
    expect(result.scan.pagesScanned).toBe(1)
    expect(result.scan.sourceItemsScanned).toBe(1)
  })
})
