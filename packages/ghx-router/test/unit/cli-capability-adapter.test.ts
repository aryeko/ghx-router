import { describe, expect, it, vi } from "vitest"

import { runCliCapability } from "../../src/core/execution/adapters/cli-capability-adapter.js"

describe("runCliCapability", () => {
  it("builds gh args and parses json output", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: "repo-id",
          name: "modkit",
          nameWithOwner: "acme/modkit",
          isPrivate: false,
          stargazerCount: 10,
          forkCount: 2,
          url: "https://github.com/acme/modkit",
          defaultBranchRef: { name: "main" }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "repo-id",
        defaultBranch: "main"
      })
    )
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["repo", "view", "acme/modkit", "--json"]),
      10_000
    )
  })

  it("normalizes repo.view when stdout is empty", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "  ", stderr: "", exitCode: 0 }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        defaultBranch: null
      })
    )
  })

  it("supports issue.view and pr.view success paths", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: "issue-id", number: 7, title: "Issue", state: "OPEN", url: "u" }),
          stderr: "",
          exitCode: 0
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: "pr-id", number: 9, title: "PR", state: "OPEN", url: "u" }),
          stderr: "",
          exitCode: 0
        })
    }

    const issueResult = await runCliCapability(runner, "issue.view", {
      owner: "acme",
      name: "modkit",
      issueNumber: 7
    })
    const prResult = await runCliCapability(runner, "pr.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 9
    })

    expect(issueResult.ok).toBe(true)
    expect(prResult.ok).toBe(true)
    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["issue", "view", "7", "--repo", "acme/modkit"]),
      10_000
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "view", "9", "--repo", "acme/modkit"]),
      10_000
    )
  })

  it("maps cli failures to normalized error", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "unauthorized", exitCode: 1 }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
  })

  it("defaults first for list capabilities when omitted", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: JSON.stringify([]), stderr: "", exitCode: 0 }))
    }

    const issueResult = await runCliCapability(runner, "issue.list", {
      owner: "",
      name: ""
    })

    const prResult = await runCliCapability(runner, "pr.list", {
      owner: "acme",
      name: "modkit"
    })

    expect(issueResult.ok).toBe(true)
    expect(prResult.ok).toBe(true)

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    const issueArgs = calls[0]?.[1]
    const prArgs = calls[1]?.[1]

    expect(issueArgs).toEqual(expect.arrayContaining(["issue", "list", "--limit", "30"]))
    expect(issueArgs).not.toContain("--repo")
    expect(prArgs).toEqual(expect.arrayContaining(["pr", "list", "--repo", "acme/modkit", "--limit", "30"]))
  })

  it("rejects invalid provided first for list capabilities", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "[]", stderr: "", exitCode: 0 }))
    }

    const issueResult = await runCliCapability(runner, "issue.list", {
      owner: "acme",
      name: "modkit",
      first: { bad: "input" }
    })

    const prResult = await runCliCapability(runner, "pr.list", {
      owner: "acme",
      name: "modkit",
      first: 12.9
    })

    expect(issueResult.ok).toBe(false)
    expect(issueResult.error?.code).toBe("VALIDATION")
    expect(prResult.ok).toBe(false)
    expect(prResult.error?.code).toBe("VALIDATION")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("requires strict integer issue/pr numbers for view capabilities", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "{}", stderr: "", exitCode: 0 }))
    }

    const issueViewResult = await runCliCapability(runner, "issue.view", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1.5
    })

    const issueCommentsResult = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1.5,
      first: 20
    })

    const prViewResult = await runCliCapability(runner, "pr.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 2.5
    })

    expect(issueViewResult.ok).toBe(false)
    expect(issueViewResult.error?.code).toBe("VALIDATION")
    expect(issueCommentsResult.ok).toBe(false)
    expect(issueCommentsResult.error?.code).toBe("VALIDATION")
    expect(prViewResult.ok).toBe(false)
    expect(prViewResult.error?.code).toBe("VALIDATION")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("normalizes repo.view output shape", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: "repo-id",
          name: "modkit",
          nameWithOwner: "acme/modkit",
          isPrivate: false,
          stargazerCount: 10,
          forkCount: 2,
          url: "https://github.com/acme/modkit",
          defaultBranchRef: { name: "main" }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      id: "repo-id",
      name: "modkit",
      nameWithOwner: "acme/modkit",
      isPrivate: false,
      stargazerCount: 10,
      forkCount: 2,
      url: "https://github.com/acme/modkit",
      defaultBranch: "main"
    })
  })

  it("normalizes issue.list output into items and pageInfo", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            id: "issue-id",
            number: 12,
            title: "Broken test",
            state: "OPEN",
            url: "https://github.com/acme/modkit/issues/12"
          }
        ]),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.list", {
      owner: "acme",
      name: "modkit",
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "issue-id",
          number: 12,
          title: "Broken test",
          state: "OPEN",
          url: "https://github.com/acme/modkit/issues/12"
        }
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    })
  })

  it("normalizes issue.comments.list into items and pageInfo", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [
                    {
                      id: "comment-1",
                      body: "Looks good to me",
                      author: { login: "octocat" },
                      url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
                      createdAt: "2025-01-01T00:00:00Z"
                    }
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  }
                }
              }
            }
          }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "comment-1",
          body: "Looks good to me",
          authorLogin: "octocat",
          url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
          createdAt: "2025-01-01T00:00:00Z"
        }
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    })
  })

  it("applies first limit for issue.comments.list and keeps cursor paging disabled", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [
                    {
                      id: "comment-1",
                      body: "first",
                      author: { login: "octocat" },
                      url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
                      createdAt: "2025-01-01T00:00:00Z"
                    }
                  ],
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: "cursor-1"
                  }
                }
              }
            }
          }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 1
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "comment-1",
          body: "first",
          authorLogin: "octocat",
          url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
          createdAt: "2025-01-01T00:00:00Z"
        }
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1"
      }
    })
  })

  it("passes through after cursor for comments fallback", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  }
                }
              }
            }
          }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
      after: "cursor-1"
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-f", "after=cursor-1"]),
      10_000
    )
  })

  it("passes requested comment page size through to fallback graphql call", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  }
                }
              }
            }
          }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 200
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-F", "first=200"]),
      10_000
    )
  })

  it("returns server error when comments payload is malformed", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({ wrong: [] }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
  })

  it("returns validation error for invalid after cursor type", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({}),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
      after: 123
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("returns server error when comment item fields are invalid", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          comments: [
            {
              id: 123,
              body: "valid",
              author: { login: "octocat" },
              url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
              createdAt: "2025-01-01T00:00:00Z"
            }
          ]
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
  })

  it("returns server error when comment item is not an object", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [null],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null
                  }
                }
              }
            }
          }
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
  })

  it("maps thrown non-Error failures", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw "forbidden"
      })
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.message).toBe("forbidden")
  })
})
