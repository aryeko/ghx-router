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
          comments: [
            {
              id: "comment-1",
              body: "Looks good to me",
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
          comments: [
            {
              id: "comment-1",
              body: "first",
              author: { login: "octocat" },
              url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
              createdAt: "2025-01-01T00:00:00Z"
            },
            {
              id: "comment-2",
              body: "second",
              author: { login: "hubot" },
              url: "https://github.com/acme/modkit/issues/1#issuecomment-2",
              createdAt: "2025-01-01T00:01:00Z"
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
        hasNextPage: false,
        endCursor: null
      }
    })
    expect(result.meta.pagination?.next).toEqual(
      expect.objectContaining({
        cursor_supported: false,
        more_items_observed: true
      })
    )
  })

  it("returns adapter unsupported when cursor pagination is requested for comments fallback", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
      after: "cursor-1"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("returns adapter unsupported when comment limit exceeds cli cap", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 200
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(runner.run).not.toHaveBeenCalled()
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

  it("keeps hasNextPage false at cli cap boundary without cursor", async () => {
    const comments = Array.from({ length: 100 }, (_, index) => ({
      id: `comment-${index + 1}`,
      body: `comment ${index + 1}`,
      author: { login: "octocat" },
      url: `https://github.com/acme/modkit/issues/1#issuecomment-${index + 1}`,
      createdAt: "2025-01-01T00:00:00Z"
    }))

    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({ comments }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 100
    })

    expect(result.ok).toBe(true)
    expect((result.data as { pageInfo: { hasNextPage: boolean } }).pageInfo.hasNextPage).toBe(false)
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
})
