import { describe, expect, it, vi } from "vitest"

import { runCliCapability } from "../../src/core/execution/adapters/cli-capability-adapter.js"
import type { OperationCard } from "../../src/core/registry/types.js"

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
          defaultBranchRef: { name: "main" },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("cli")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "repo-id",
        defaultBranch: "main",
      }),
    )
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["repo", "view", "acme/modkit", "--json"]),
      10_000,
    )
  })

  it("uses card-provided CLI command and json fields when available", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: "repo-id",
          name: "modkit",
          nameWithOwner: "acme/modkit",
          isPrivate: false,
          url: "u",
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const card = {
      capability_id: "repo.view",
      version: "1.0.0",
      description: "Repo",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "cli", fallbacks: ["graphql"] },
      cli: {
        command: "repo view",
        jsonFields: ["id", "name", "nameWithOwner", "isPrivate", "url"],
      },
    } as unknown as OperationCard

    await runCliCapability(runner, "repo.view", { owner: "acme", name: "modkit" }, card)

    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["repo", "view", "acme/modkit", "--json", "id,name,nameWithOwner,isPrivate,url"],
      10_000,
    )
  })

  it("normalizes repo.view when stdout is empty", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "  ", stderr: "", exitCode: 0 })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        defaultBranch: null,
      }),
    )
  })

  it("supports issue.view and pr.view success paths", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: "issue-id",
            number: 7,
            title: "Issue",
            state: "OPEN",
            url: "u",
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: "pr-id", number: 9, title: "PR", state: "OPEN", url: "u" }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const issueResult = await runCliCapability(runner, "issue.view", {
      owner: "acme",
      name: "modkit",
      issueNumber: 7,
    })
    const prResult = await runCliCapability(runner, "pr.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 9,
    })

    expect(issueResult.ok).toBe(true)
    expect(prResult.ok).toBe(true)
    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["issue", "view", "7", "--repo", "acme/modkit"]),
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "view", "9", "--repo", "acme/modkit"]),
      10_000,
    )
  })

  it("maps cli failures to normalized error", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "", stderr: "unauthorized", exitCode: 1 })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
  })

  it("defaults first for list capabilities when omitted", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: JSON.stringify([]), stderr: "", exitCode: 0 })),
    }

    const issueResult = await runCliCapability(runner, "issue.list", {
      owner: "",
      name: "",
    })

    const prResult = await runCliCapability(runner, "pr.list", {
      owner: "acme",
      name: "modkit",
    })

    expect(issueResult.ok).toBe(true)
    expect(prResult.ok).toBe(true)

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    const issueArgs = calls[0]?.[1]
    const prArgs = calls[1]?.[1]

    expect(issueArgs).toEqual(expect.arrayContaining(["issue", "list", "--limit", "30"]))
    expect(issueArgs).not.toContain("--repo")
    expect(prArgs).toEqual(
      expect.arrayContaining(["pr", "list", "--repo", "acme/modkit", "--limit", "30"]),
    )
  })

  it("rejects invalid provided first for list capabilities", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "[]", stderr: "", exitCode: 0 })),
    }

    const issueResult = await runCliCapability(runner, "issue.list", {
      owner: "acme",
      name: "modkit",
      first: { bad: "input" },
    })

    const prResult = await runCliCapability(runner, "pr.list", {
      owner: "acme",
      name: "modkit",
      first: 12.9,
    })

    expect(issueResult.ok).toBe(false)
    expect(issueResult.error?.code).toBe("VALIDATION")
    expect(prResult.ok).toBe(false)
    expect(prResult.error?.code).toBe("VALIDATION")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("requires strict integer issue/pr numbers for view capabilities", async () => {
    const runner = {
      run: vi.fn(async () => ({ stdout: "{}", stderr: "", exitCode: 0 })),
    }

    const issueViewResult = await runCliCapability(runner, "issue.view", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1.5,
    })

    const issueCommentsResult = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1.5,
      first: 20,
    })

    const prViewResult = await runCliCapability(runner, "pr.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 2.5,
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
          defaultBranchRef: { name: "main" },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
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
      defaultBranch: "main",
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
            url: "https://github.com/acme/modkit/issues/12",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "issue-id",
          number: 12,
          title: "Broken test",
          state: "OPEN",
          url: "https://github.com/acme/modkit/issues/12",
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
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
                      createdAt: "2025-01-01T00:00:00Z",
                    },
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: null,
                  },
                },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "comment-1",
          body: "Looks good to me",
          authorLogin: "octocat",
          url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
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
                      createdAt: "2025-01-01T00:00:00Z",
                    },
                  ],
                  pageInfo: {
                    hasNextPage: true,
                    endCursor: "cursor-1",
                  },
                },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          id: "comment-1",
          body: "first",
          authorLogin: "octocat",
          url: "https://github.com/acme/modkit/issues/1#issuecomment-1",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
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
                    endCursor: null,
                  },
                },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
      after: "cursor-1",
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-f", "after=cursor-1"]),
      10_000,
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
                    endCursor: null,
                  },
                },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 200,
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-F", "first=200"]),
      10_000,
    )
  })

  it("returns server error when comments payload is malformed", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({ wrong: [] }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
  })

  it("returns validation error for invalid after cursor type", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({}),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
      after: 123,
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
              createdAt: "2025-01-01T00:00:00Z",
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
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
                    endCursor: null,
                  },
                },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
  })

  it("maps thrown non-Error failures", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw "forbidden"
      }),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.message).toBe("forbidden")
  })

  it("redacts sensitive stderr and omits command args in error details", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "authorization: Bearer ghp_supersecrettokenvalue123",
        exitCode: 1,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_kwDO123",
      itemId: "ITEM_123",
      fieldId: "FIELD_123",
      valueText: "password=supersecret",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe("gh command failed; stderr redacted for safety")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        capabilityId: "project_v2.item.field.update",
        exitCode: 1,
      }),
    )
    expect(String(result.error?.details ?? "")).not.toContain("supersecret")
    expect(String(result.error?.details ?? "")).not.toContain("ghp_supersecrettokenvalue123")
  })

  it("normalizes pr.status.checks from gh pr checks output", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            name: "unit-tests",
            state: "SUCCESS",
            bucket: "pass",
            workflow: "ci",
            link: "https://example.com/check/1",
          },
          {
            name: "lint",
            state: "FAILURE",
            bucket: "fail",
            workflow: "ci",
            link: "https://example.com/check/2",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "checks", "10", "--repo", "acme/modkit", "--json", "name,state,bucket,workflow,link"],
      10_000,
    )
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({ name: "unit-tests" }),
          expect.objectContaining({ name: "lint" }),
        ],
        summary: expect.objectContaining({ total: 2, failed: 1, passed: 1 }),
      }),
    )
  })

  it("filters failed checks for pr.checks.get_failed", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            name: "unit-tests",
            state: "SUCCESS",
            bucket: "pass",
            workflow: "ci",
            link: "https://example.com/check/1",
          },
          {
            name: "lint",
            state: "FAILURE",
            bucket: "fail",
            workflow: "ci",
            link: "https://example.com/check/2",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.checks.get_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ name: "lint", state: "FAILURE" })],
        summary: expect.objectContaining({ total: 2, failed: 1 }),
      }),
    )
  })

  it("normalizes mergeability fields for pr.mergeability.view", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewDecision: "APPROVED",
          isDraft: false,
          state: "OPEN",
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      reviewDecision: "APPROVED",
      isDraft: false,
      state: "OPEN",
    })
  })

  it("executes ready-for-review mutation through gh pr ready", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      ready: true,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ prNumber: 10, isDraft: false })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "ready", "10", "--repo", "acme/modkit"],
      10_000,
    )
  })

  it("executes Batch A PR review and merge mutations", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const approve = await runCliCapability(runner, "pr.review.submit_approve", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      body: "Ship it",
    })
    const requestChanges = await runCliCapability(runner, "pr.review.submit_request_changes", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      body: "Please add tests",
    })
    const comment = await runCliCapability(runner, "pr.review.submit_comment", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      body: "Looks good with one note",
    })
    const merge = await runCliCapability(runner, "pr.merge.execute", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      method: "squash",
      deleteBranch: true,
    })
    const branchUpdate = await runCliCapability(runner, "pr.branch.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
    })

    expect(approve.ok).toBe(true)
    expect(requestChanges.ok).toBe(true)
    expect(comment.ok).toBe(true)
    expect(merge.ok).toBe(true)
    expect(branchUpdate.ok).toBe(true)

    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      ["pr", "review", "10", "--repo", "acme/modkit", "--approve", "--body", "Ship it"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      [
        "pr",
        "review",
        "10",
        "--repo",
        "acme/modkit",
        "--request-changes",
        "--body",
        "Please add tests",
      ],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      3,
      "gh",
      [
        "pr",
        "review",
        "10",
        "--repo",
        "acme/modkit",
        "--comment",
        "--body",
        "Looks good with one note",
      ],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      4,
      "gh",
      ["pr", "merge", "10", "--repo", "acme/modkit", "--squash", "--delete-branch"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      5,
      "gh",
      ["pr", "update-branch", "10", "--repo", "acme/modkit"],
      10_000,
    )
  })

  it("executes Batch A check reruns and reviewer/assignee updates", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const rerunFailed = await runCliCapability(runner, "pr.checks.rerun_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      runId: 88,
    })
    const rerunAll = await runCliCapability(runner, "pr.checks.rerun_all", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      runId: 88,
    })
    const reviewers = await runCliCapability(runner, "pr.reviewers.request", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      reviewers: ["octocat", "hubot"],
    })
    const assignees = await runCliCapability(runner, "pr.assignees.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      add: ["octocat"],
      remove: ["hubot"],
    })

    expect(rerunFailed.ok).toBe(true)
    expect(rerunAll.ok).toBe(true)
    expect(reviewers.ok).toBe(true)
    expect(assignees.ok).toBe(true)

    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      ["run", "rerun", "88", "--repo", "acme/modkit", "--failed"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      ["run", "rerun", "88", "--repo", "acme/modkit"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      3,
      "gh",
      ["pr", "edit", "10", "--repo", "acme/modkit", "--add-reviewer", "octocat,hubot"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      4,
      "gh",
      [
        "pr",
        "edit",
        "10",
        "--repo",
        "acme/modkit",
        "--add-assignee",
        "octocat",
        "--remove-assignee",
        "hubot",
      ],
      10_000,
    )
  })

  it("falls back to rerun-all when rerun-failed cannot be retried", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "run 88 cannot be rerun; This workflow run cannot be retried",
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          stdout: "queued",
          stderr: "",
          exitCode: 0,
        }),
    }

    const rerunFailed = await runCliCapability(runner, "pr.checks.rerun_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      runId: 88,
    })

    expect(rerunFailed.ok).toBe(true)
    expect(rerunFailed.data).toEqual({
      prNumber: 10,
      runId: 88,
      mode: "all",
      queued: true,
    })
    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      ["run", "rerun", "88", "--repo", "acme/modkit", "--failed"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      ["run", "rerun", "88", "--repo", "acme/modkit"],
      10_000,
    )
  })

  it("treats workflow rerun stdout as non-JSON", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "queued",
        stderr: "",
        exitCode: 0,
      })),
    }

    const rerunResult = await runCliCapability(runner, "workflow_run.rerun_failed", {
      owner: "acme",
      name: "modkit",
      runId: 88,
    })

    expect(rerunResult.ok).toBe(true)
    expect(rerunResult.data).toEqual({
      runId: 88,
      rerunFailed: true,
    })
  })

  it("validates required Batch A mutation inputs", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const invalidReviewBody = await runCliCapability(runner, "pr.review.submit_comment", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      body: "",
    })
    const invalidMergeMethod = await runCliCapability(runner, "pr.merge.execute", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      method: "fast-forward",
    })
    const invalidRerun = await runCliCapability(runner, "pr.checks.rerun_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      runId: 0,
    })
    const invalidReviewers = await runCliCapability(runner, "pr.reviewers.request", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      reviewers: [],
    })
    const invalidAssignees = await runCliCapability(runner, "pr.assignees.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      add: [],
      remove: [],
    })

    expect(invalidReviewBody.ok).toBe(false)
    expect(invalidMergeMethod.ok).toBe(false)
    expect(invalidRerun.ok).toBe(false)
    expect(invalidReviewers.ok).toBe(false)
    expect(invalidAssignees.ok).toBe(false)
    expect(invalidReviewBody.error?.code).toBe("VALIDATION")
    expect(invalidMergeMethod.error?.code).toBe("VALIDATION")
    expect(invalidRerun.error?.code).toBe("VALIDATION")
    expect(invalidReviewers.error?.code).toBe("VALIDATION")
    expect(invalidAssignees.error?.code).toBe("VALIDATION")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("normalizes check run annotations list", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            path: "src/index.ts",
            start_line: 10,
            end_line: 10,
            annotation_level: "failure",
            message: "Unexpected any",
            title: "Type check",
            raw_details: "no-explicit-any",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 100,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: "src/index.ts", level: "failure" })],
      }),
    )
  })

  it("returns validation error when check run annotations owner/name is missing", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "",
      name: "",
      checkRunId: 100,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("Missing owner/name for check_run.annotations.list")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("normalizes workflow runs list", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            databaseId: 1,
            workflowName: "CI",
            status: "completed",
            conclusion: "success",
            headBranch: "main",
            url: "https://example.com/run/1",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 1, workflowName: "CI" })],
      }),
    )
  })

  it("normalizes workflow run jobs list", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          jobs: [
            {
              databaseId: 11,
              name: "build",
              status: "completed",
              conclusion: "success",
              startedAt: "2025-01-01T00:00:00Z",
              completedAt: "2025-01-01T00:01:00Z",
              url: "https://example.com/job/11",
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 200,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 11, name: "build" })],
      }),
    )
  })

  it("returns bounded workflow job logs payload", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "line1\nline2",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 300,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      jobId: 300,
      log: "line1\nline2",
      truncated: false,
    })
  })

  it("analyzes workflow job logs into structured summary", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "ERROR test failed\nwarning: flaky\nError: compile failed",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow_job.logs.analyze", {
      owner: "acme",
      name: "modkit",
      jobId: 300,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        jobId: 300,
        summary: expect.objectContaining({
          errorCount: 2,
          warningCount: 1,
          topErrorLines: expect.arrayContaining(["ERROR test failed", "Error: compile failed"]),
        }),
      }),
    )
  })

  it("validates PR and workflow numeric inputs", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0,
      })),
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
    })
    const mergeabilityResult = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
    })
    const readyResult = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      ready: "yes",
    })
    const readyInvalidPrResult = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
      ready: true,
    })
    const workflowListResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 0,
    })
    const workflowJobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 0,
    })
    const workflowLogsResult = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 0,
    })
    const checkRunInvalidIdResult = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 0,
    })

    expect(checksResult.ok).toBe(false)
    expect(mergeabilityResult.ok).toBe(false)
    expect(readyResult.ok).toBe(false)
    expect(readyInvalidPrResult.ok).toBe(false)
    expect(workflowListResult.ok).toBe(false)
    expect(workflowJobsResult.ok).toBe(false)
    expect(workflowLogsResult.ok).toBe(false)
    expect(checkRunInvalidIdResult.ok).toBe(false)
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("includes workflow filters and undo flag in generated args", async () => {
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: "[]",
            stderr: "",
            exitCode: 0,
          }
        }

        return {
          stdout: "{}",
          stderr: "",
          exitCode: 0,
        }
      }),
    }

    await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 10,
      branch: "main",
      event: "push",
      status: "completed",
    })
    await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      ready: false,
    })

    const workflowRunCall = runner.run.mock.calls.find(
      (call: [string, string[]]) => call[1][0] === "run" && call[1][1] === "list",
    )
    expect(workflowRunCall?.[1]).toEqual(
      expect.arrayContaining(["--branch", "main", "--event", "push", "--status", "completed"]),
    )

    const readyCall = runner.run.mock.calls.find(
      (call: [string, string[]]) => call[1][0] === "pr" && call[1][1] === "ready",
    )
    expect(readyCall?.[1]).toEqual(expect.arrayContaining(["--undo"]))
  })

  it("normalizes fallback defaults for check, run, job, and annotation payloads", async () => {
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "pr" && args[1] === "checks") {
          return {
            stdout: JSON.stringify([null, { state: 42 }]),
            stderr: "",
            exitCode: 0,
          }
        }
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([null]),
            stderr: "",
            exitCode: 0,
          }
        }
        if (args[0] === "run" && args[1] === "view" && args.includes("--json")) {
          return {
            stdout: JSON.stringify({ jobs: [null] }),
            stderr: "",
            exitCode: 0,
          }
        }

        return {
          stdout: JSON.stringify([null]),
          stderr: "",
          exitCode: 0,
        }
      }),
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })
    const runsResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1,
    })
    const jobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 1,
    })
    const annotationsResult = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 1,
    })

    expect(checksResult.ok).toBe(true)
    expect(checksResult.data).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            name: null,
            state: null,
            bucket: null,
            workflow: null,
            link: null,
          }),
          expect.objectContaining({
            name: null,
            state: null,
            bucket: null,
            workflow: null,
            link: null,
          }),
        ],
      }),
    )
    expect(runsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 0, workflowName: null, status: null })],
      }),
    )
    expect(jobsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 0, name: null, status: null })],
      }),
    )
    expect(annotationsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: null, level: null, message: null })],
      }),
    )
  })

  it("normalizes non-array checks and non-object workflow payloads", async () => {
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "pr" && args[1] === "checks") {
          return {
            stdout: JSON.stringify({ unexpected: true }),
            stderr: "",
            exitCode: 0,
          }
        }
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([
              {
                databaseId: "x",
                workflowName: 1,
                status: 2,
                conclusion: 3,
                headBranch: 4,
                url: 5,
              },
            ]),
            stderr: "",
            exitCode: 0,
          }
        }
        if (args[0] === "run" && args[1] === "view" && args.includes("--json")) {
          return {
            stdout: JSON.stringify(null),
            stderr: "",
            exitCode: 0,
          }
        }

        return {
          stdout: "null",
          stderr: "",
          exitCode: 0,
        }
      }),
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })
    const runsResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1,
    })
    const jobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 1,
    })

    expect(checksResult.data).toEqual(
      expect.objectContaining({
        items: [],
        summary: expect.objectContaining({ total: 0, failed: 0, pending: 0, passed: 0 }),
      }),
    )
    expect(runsResult.data).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 0,
            workflowName: null,
            status: null,
            conclusion: null,
            headBranch: null,
            url: null,
          }),
        ],
      }),
    )
    expect(jobsResult.data).toEqual(
      expect.objectContaining({
        items: [],
      }),
    )
  })

  it("handles truncated logs and unknown mergeability payload", async () => {
    const longLog = "x".repeat(50_200)
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "pr" && args[1] === "view") {
          return {
            stdout: "null",
            stderr: "",
            exitCode: 0,
          }
        }

        return {
          stdout: longLog,
          stderr: "",
          exitCode: 0,
        }
      }),
    }

    const mergeabilityResult = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 2,
    })
    const logsResult = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 2,
    })

    expect(mergeabilityResult.ok).toBe(true)
    expect(mergeabilityResult.data).toEqual(
      expect.objectContaining({
        mergeable: null,
        mergeStateStatus: null,
        reviewDecision: null,
        isDraft: false,
        state: "UNKNOWN",
      }),
    )
    expect(logsResult.ok).toBe(true)
    expect((logsResult.data as { truncated: boolean }).truncated).toBe(true)
    expect((logsResult.data as { log: string }).log.length).toBe(50_000)
  })

  it("supports workflow control capabilities", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify([
            { id: 1, name: "CI", state: "active", path: ".github/workflows/ci.yml" },
          ]),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 1,
            name: "CI",
            state: "active",
            path: ".github/workflows/ci.yml",
            url: "https://example.com/workflow/1",
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            databaseId: 123,
            workflowName: "CI",
            status: "completed",
            conclusion: "success",
            headBranch: "main",
            url: "https://example.com/run/123",
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "cancellation requested", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            artifacts: [
              {
                id: 10,
                name: "coverage",
                sizeInBytes: 1234,
                archiveDownloadUrl: "https://example.com/artifacts/10",
              },
            ],
          }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const workflowList = await runCliCapability(runner, "workflow.list", {
      owner: "acme",
      name: "modkit",
      first: 10,
    })
    const workflowGet = await runCliCapability(runner, "workflow.get", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
    })
    const workflowRunGet = await runCliCapability(runner, "workflow_run.get", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const rerunAll = await runCliCapability(runner, "workflow_run.rerun_all", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const cancel = await runCliCapability(runner, "workflow_run.cancel", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const artifacts = await runCliCapability(runner, "workflow_run.artifacts.list", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })

    expect(workflowList.ok).toBe(true)
    expect(workflowGet.ok).toBe(true)
    expect(workflowRunGet.ok).toBe(true)
    expect(rerunAll.data).toEqual({ runId: 123, status: "requested" })
    expect(cancel.data).toEqual({ runId: 123, status: "cancel_requested" })
    expect(artifacts.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 10, name: "coverage" })],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      [
        "workflow",
        "list",
        "--repo",
        "acme/modkit",
        "--limit",
        "10",
        "--json",
        "id,name,path,state",
      ],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      ["workflow", "view", "ci.yml", "--repo", "acme/modkit", "--json", "id,name,path,state,url"],
      10_000,
    )
  })

  it("supports numeric workflow identifiers for workflow.get", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: 123,
          name: "CI",
          path: ".github/workflows/ci.yml",
          state: "active",
          url: "https://example.com/workflow/123",
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.get", {
      owner: "acme",
      name: "modkit",
      workflowId: 123,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        id: 123,
        name: "CI",
        url: "https://example.com/workflow/123",
      }),
    )
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["workflow", "view", "123", "--repo", "acme/modkit", "--json", "id,name,path,state,url"],
      10_000,
    )
  })

  it("accepts numeric and boolean workflow dispatch inputs", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow_dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "release.yml",
      ref: "main",
      inputs: {
        retryCount: 2,
        dryRun: true,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      workflowId: "release.yml",
      ref: "main",
      dispatched: true,
    })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-f", "inputs[retryCount]=2", "-f", "inputs[dryRun]=true"]),
      10_000,
    )
  })

  it("supports projects v2 capabilities and keeps output v2-only", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: "PVT_org_1",
            title: "Platform",
            shortDescription: "Org project",
            public: false,
            closed: false,
            url: "https://example.com/org/project/1",
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: "PVT_user_2",
            title: "Personal",
            shortDescription: "User project",
            public: true,
            closed: false,
            url: "https://example.com/user/project/2",
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            fields: [{ id: "PVTF_1", name: "Status", dataType: "SINGLE_SELECT" }],
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            items: [
              { id: "PVTI_1", content: { type: "Issue", number: 10, title: "Track batch D" } },
            ],
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: "PVTI_2" }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }),
    }

    const org = await runCliCapability(runner, "project_v2.org.get", {
      org: "acme",
      projectNumber: 1,
    })
    const user = await runCliCapability(runner, "project_v2.user.get", {
      user: "octocat",
      projectNumber: 2,
    })
    const fields = await runCliCapability(runner, "project_v2.fields.list", {
      owner: "acme",
      projectNumber: 1,
    })
    const items = await runCliCapability(runner, "project_v2.items.list", {
      owner: "acme",
      projectNumber: 1,
      first: 10,
    })
    const addIssue = await runCliCapability(runner, "project_v2.item.add_issue", {
      owner: "acme",
      projectNumber: 1,
      issueUrl: "https://github.com/acme/modkit/issues/10",
    })
    const fieldUpdate = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_org_1",
      itemId: "PVTI_1",
      fieldId: "PVTF_1",
      valueSingleSelectOptionId: "a1b2c3",
    })

    expect(org.ok).toBe(true)
    expect(user.ok).toBe(true)
    expect(fields.data).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ id: "PVTF_1" })] }),
    )
    expect(items.data).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ id: "PVTI_1" })] }),
    )
    expect(addIssue.data).toEqual({ itemId: "PVTI_2", added: true })
    expect(fieldUpdate.data).toEqual({ itemId: "PVTI_1", updated: true })
    expect((org.data as Record<string, unknown>).columns).toBeUndefined()
    expect((user.data as Record<string, unknown>).columns).toBeUndefined()
  })

  it("supports repo metadata capabilities", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify([
            {
              id: "LA_kwDOA",
              name: "bug",
              description: "Something is broken",
              color: "d73a4a",
              isDefault: true,
            },
          ]),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            data: {
              repository: {
                issueTypes: {
                  nodes: [{ id: "IT_kwDOA", name: "Bug", color: "RED", isEnabled: true }],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const labels = await runCliCapability(runner, "repo.labels.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
    })
    const issueTypes = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
    })

    expect(labels.ok).toBe(true)
    expect(labels.data).toEqual(
      expect.objectContaining({ items: [expect.objectContaining({ name: "bug" })] }),
    )
    expect(issueTypes.ok).toBe(true)
    expect(issueTypes.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "IT_kwDOA", name: "Bug" })],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    )
  })

  it("validates repo metadata capability inputs", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0,
      })),
    }

    const labelsFirstInvalid = await runCliCapability(runner, "repo.labels.list", {
      owner: "acme",
      name: "modkit",
      first: 0,
    })
    const issueTypesFirstInvalid = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "acme",
      name: "modkit",
      first: 0,
    })
    const issueTypesAfterInvalid = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
      after: 123,
    })
    const issueTypesMissingRepo = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "",
      name: "",
      first: 20,
    })

    expect(labelsFirstInvalid.ok).toBe(false)
    expect(labelsFirstInvalid.error?.message).toContain(
      "Missing or invalid first for repo.labels.list",
    )

    expect(issueTypesFirstInvalid.ok).toBe(false)
    expect(issueTypesFirstInvalid.error?.message).toContain(
      "Missing or invalid first for repo.issue_types.list",
    )

    expect(issueTypesAfterInvalid.ok).toBe(false)
    expect(issueTypesAfterInvalid.error?.message).toContain(
      "Invalid after cursor for repo.issue_types.list",
    )

    expect(issueTypesMissingRepo.ok).toBe(false)
    expect(issueTypesMissingRepo.error?.message).toContain(
      "Missing owner/name for repo.issue_types.list",
    )

    expect(runner.run).not.toHaveBeenCalled()
  })

  it("passes repo.issue_types.list after cursor to gh api graphql args", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issueTypes: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
      after: "cursor-123",
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["-f", "after=cursor-123"]),
      expect.any(Number),
    )
  })

  it("normalizes release list and get responses", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify([
            {
              id: 101,
              tag_name: "v1.0.0",
              name: "v1.0.0",
              draft: true,
              prerelease: false,
              html_url: "https://github.com/acme/modkit/releases/tag/v1.0.0",
              target_commitish: "main",
              created_at: "2026-02-01T00:00:00Z",
              published_at: null,
            },
          ]),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 102,
            tag_name: "v1.0.1",
            name: "v1.0.1",
            draft: false,
            prerelease: false,
            html_url: "https://github.com/acme/modkit/releases/tag/v1.0.1",
            target_commitish: "main",
            created_at: "2026-02-02T00:00:00Z",
            published_at: "2026-02-02T00:10:00Z",
          }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const listResult = await runCliCapability(runner, "release.list", {
      owner: "acme",
      name: "modkit",
      first: 10,
    })
    const getResult = await runCliCapability(runner, "release.get", {
      owner: "acme",
      name: "modkit",
      tagName: "v1.0.1",
    })

    expect(listResult.ok).toBe(true)
    expect(listResult.data).toEqual({
      items: [
        {
          id: 101,
          tagName: "v1.0.0",
          name: "v1.0.0",
          isDraft: true,
          isPrerelease: false,
          url: "https://github.com/acme/modkit/releases/tag/v1.0.0",
          targetCommitish: "main",
          createdAt: "2026-02-01T00:00:00Z",
          publishedAt: null,
        },
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    })

    expect(getResult.ok).toBe(true)
    expect(getResult.data).toEqual({
      id: 102,
      tagName: "v1.0.1",
      name: "v1.0.1",
      isDraft: false,
      isPrerelease: false,
      url: "https://github.com/acme/modkit/releases/tag/v1.0.1",
      targetCommitish: "main",
      createdAt: "2026-02-02T00:00:00Z",
      publishedAt: "2026-02-02T00:10:00Z",
    })

    expect(runner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      ["api", "repos/acme/modkit/releases", "-F", "per_page=10"],
      10_000,
    )
    expect(runner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      ["api", "repos/acme/modkit/releases/tags/v1.0.1"],
      10_000,
    )
  })

  it("enforces draft-first semantics for release create, update, and publish", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 201,
            tag_name: "v2.0.0-rc.1",
            name: "v2.0.0-rc.1",
            draft: true,
            prerelease: true,
            html_url: "https://github.com/acme/modkit/releases/tag/v2.0.0-rc.1",
            target_commitish: "main",
            created_at: "2026-02-05T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 201,
            tag_name: "v2.0.0-rc.1",
            name: "v2.0.0",
            draft: true,
            prerelease: false,
            html_url: "https://github.com/acme/modkit/releases/tag/v2.0.0",
            target_commitish: "main",
            created_at: "2026-02-05T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 201,
            tag_name: "v2.0.0-rc.1",
            name: "v2.0.0",
            draft: true,
            prerelease: false,
            html_url: "https://github.com/acme/modkit/releases/tag/v2.0.0",
            target_commitish: "main",
            created_at: "2026-02-05T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 201,
            tag_name: "v2.0.0-rc.1",
            name: "v2.0.0",
            draft: false,
            prerelease: false,
            html_url: "https://github.com/acme/modkit/releases/tag/v2.0.0",
            target_commitish: "main",
            created_at: "2026-02-05T00:00:00Z",
            published_at: "2026-02-06T00:00:00Z",
          }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const createResult = await runCliCapability(runner, "release.create_draft", {
      owner: "acme",
      name: "modkit",
      tagName: "v2.0.0-rc.1",
      title: "v2.0.0-rc.1",
      notes: "release candidate",
      prerelease: true,
    })

    const updateResult = await runCliCapability(runner, "release.update", {
      owner: "acme",
      name: "modkit",
      releaseId: 201,
      title: "v2.0.0-rc.1",
      notes: "updated notes",
      draft: true,
    })

    const publishResult = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 201,
      title: "v2.0.0",
    })

    const invalidUpdateResult = await runCliCapability(runner, "release.update", {
      owner: "acme",
      name: "modkit",
      releaseId: 201,
      draft: false,
    })

    expect(createResult.ok).toBe(true)
    expect((createResult.data as { isDraft: boolean }).isDraft).toBe(true)
    expect(updateResult.ok).toBe(true)
    expect((updateResult.data as { isDraft: boolean }).isDraft).toBe(true)
    expect(publishResult.ok).toBe(true)
    expect(publishResult.data).toEqual(
      expect.objectContaining({
        id: 201,
        isDraft: false,
        publishedAt: "2026-02-06T00:00:00Z",
        wasDraft: true,
      }),
    )

    expect(invalidUpdateResult.ok).toBe(false)
    expect(invalidUpdateResult.error?.code).toBe("VALIDATION")
  })

  it("dispatches workflows and reruns failed workflow jobs", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "",
          exitCode: 0,
        }),
    }

    const dispatchResult = await runCliCapability(runner, "workflow_dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "release.yml",
      ref: "main",
      inputs: {
        channel: "stable",
        force: "true",
      },
    })

    const rerunResult = await runCliCapability(runner, "workflow_run.rerun_failed", {
      owner: "acme",
      name: "modkit",
      runId: 500,
    })

    const invalidDispatchResult = await runCliCapability(runner, "workflow_dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "release.yml",
      ref: "main",
      inputs: "invalid",
    })

    expect(dispatchResult.ok).toBe(true)
    expect(dispatchResult.data).toEqual({
      workflowId: "release.yml",
      ref: "main",
      dispatched: true,
    })
    expect(rerunResult.ok).toBe(true)
    expect(rerunResult.data).toEqual({
      runId: 500,
      rerunFailed: true,
    })

    expect(invalidDispatchResult.ok).toBe(false)
    expect(invalidDispatchResult.error?.code).toBe("VALIDATION")
  })

  it("maps release.publish_draft command failure after draft pre-check", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: 301,
            tag_name: "v3.0.0-rc.1",
            name: "v3.0.0-rc.1",
            draft: true,
            prerelease: true,
            html_url: "https://github.com/acme/modkit/releases/tag/v3.0.0-rc.1",
            target_commitish: "main",
            created_at: "2026-02-10T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "forbidden",
          exitCode: 1,
        }),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 301,
      title: "v3.0.0",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        capabilityId: "release.publish_draft",
        exitCode: 1,
      }),
    )
  })

  it("rejects release.publish_draft when current release is not draft", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: 401,
          tag_name: "v4.0.0",
          name: "v4.0.0",
          draft: false,
          prerelease: false,
          html_url: "https://github.com/acme/modkit/releases/tag/v4.0.0",
          target_commitish: "main",
          created_at: "2026-02-12T00:00:00Z",
          published_at: "2026-02-12T00:01:00Z",
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 401,
      title: "v4.0.0",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("requires an existing draft release")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("maps release.publish_draft pre-check read failure", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "unauthorized",
        exitCode: 1,
      })),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 500,
      title: "v5.0.0",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        capabilityId: "release.publish_draft",
        exitCode: 1,
      }),
    )
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("rejects release.publish_draft when pre-check payload is not an object", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 501,
      title: "v5.0.1",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("requires an existing draft release")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("maps invalid JSON output to server error", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "{invalid-json",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
    expect(result.error?.message).toBe("Failed to parse CLI JSON output")
  })

  it("treats non-JSON stdout as success for pr.branch.update", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "✓ PR branch already up-to-date\n",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.branch.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ prNumber: 42, updated: true })
  })

  it("returns validation error when release.publish_draft params are incomplete", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("UNKNOWN")
    expect(result.error?.message).toContain("Missing owner/name/releaseId")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("returns fallback defaults for malformed artifacts, project, and release payloads", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ artifacts: [null] }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ fields: [null] }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ items: [null] }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify([]),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify([]),
          stderr: "",
          exitCode: 0,
        }),
    }

    const artifactsResult = await runCliCapability(runner, "workflow_run.artifacts.list", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const fieldsResult = await runCliCapability(runner, "project_v2.fields.list", {
      owner: "acme",
      projectNumber: 1,
    })
    const itemsResult = await runCliCapability(runner, "project_v2.items.list", {
      owner: "acme",
      projectNumber: 1,
      first: 10,
    })
    const addIssueResult = await runCliCapability(runner, "project_v2.item.add_issue", {
      owner: "acme",
      projectNumber: 1,
      issueUrl: "https://github.com/acme/modkit/issues/1",
    })
    const releaseGetResult = await runCliCapability(runner, "release.get", {
      owner: "acme",
      name: "modkit",
      tagName: "v1.0.0",
    })

    expect(artifactsResult.ok).toBe(true)
    expect(artifactsResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: 0,
            name: null,
            sizeInBytes: null,
            archiveDownloadUrl: null,
          },
        ],
      }),
    )

    expect(fieldsResult.ok).toBe(true)
    expect(fieldsResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: null,
            name: null,
            dataType: null,
          },
        ],
      }),
    )

    expect(itemsResult.ok).toBe(true)
    expect(itemsResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: null,
            contentType: null,
            contentNumber: null,
            contentTitle: null,
          },
        ],
      }),
    )

    expect(addIssueResult.ok).toBe(true)
    expect(addIssueResult.data).toEqual({ itemId: null, added: true })

    expect(releaseGetResult.ok).toBe(true)
    expect(releaseGetResult.data).toEqual({
      id: 0,
      tagName: null,
      name: null,
      isDraft: false,
      isPrerelease: false,
      url: null,
      targetCommitish: null,
      createdAt: null,
      publishedAt: null,
    })
  })

  it("returns gh exit-code error message when stderr is empty", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 2,
      })),
    }

    const result = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe("gh exited with code 2")
  })

  it("returns validation error when repo-required capabilities miss owner/name", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "release.list", {
      owner: "",
      name: "",
      first: 10,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("UNKNOWN")
    expect(result.error?.message).toContain("Missing owner/name")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("covers validation failure branches across roadmap CLI capabilities", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw new Error("runner should not be invoked for build-arg validation failures")
      }),
    }

    const cases = [
      { capabilityId: "pr.review.submit_approve", params: { prNumber: 0 }, message: "prNumber" },
      {
        capabilityId: "pr.review.submit_request_changes",
        params: { prNumber: 1 },
        message: "body",
      },
      { capabilityId: "pr.merge.execute", params: { prNumber: 0 }, message: "prNumber" },
      {
        capabilityId: "pr.merge.execute",
        params: { prNumber: 1, method: "fast-forward" },
        message: "method",
      },
      {
        capabilityId: "pr.merge.execute",
        params: { prNumber: 1, method: "merge", deleteBranch: "yes" },
        message: "deleteBranch",
      },
      {
        capabilityId: "pr.checks.rerun_failed",
        params: { prNumber: 0, runId: 1 },
        message: "prNumber",
      },
      {
        capabilityId: "pr.reviewers.request",
        params: { prNumber: 0, reviewers: ["octocat"] },
        message: "prNumber",
      },
      {
        capabilityId: "pr.reviewers.request",
        params: { prNumber: 1, reviewers: [] },
        message: "reviewers",
      },
      {
        capabilityId: "pr.assignees.update",
        params: { prNumber: 0, add: ["octocat"] },
        message: "prNumber",
      },
      {
        capabilityId: "pr.assignees.update",
        params: { prNumber: 1, add: [], remove: [] },
        message: "assignees",
      },
      { capabilityId: "pr.branch.update", params: { prNumber: 0 }, message: "prNumber" },
      {
        capabilityId: "workflow.list",
        params: { owner: "acme", name: "modkit", first: 0 },
        message: "first",
      },
      {
        capabilityId: "workflow.get",
        params: { owner: "acme", name: "modkit", workflowId: null },
        message: "workflowId",
      },
      {
        capabilityId: "workflow_run.get",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "workflow_run.rerun_all",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "workflow_run.artifacts.list",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "project_v2.fields.list",
        params: { owner: "", projectNumber: 1 },
        message: "owner/projectNumber",
      },
      {
        capabilityId: "project_v2.items.list",
        params: { owner: "acme", projectNumber: 1, first: 0 },
        message: "owner/projectNumber/first",
      },
      {
        capabilityId: "release.list",
        params: { owner: "acme", name: "modkit", first: 0 },
        message: "first",
      },
      {
        capabilityId: "release.get",
        params: { owner: "acme", name: "modkit", tagName: "" },
        message: "tagName",
      },
      {
        capabilityId: "release.create_draft",
        params: { owner: "acme", name: "modkit", tagName: "" },
        message: "tagName",
      },
      {
        capabilityId: "release.update",
        params: { owner: "acme", name: "modkit", releaseId: 0 },
        message: "releaseId",
      },
      {
        capabilityId: "release.publish_draft",
        params: { owner: "acme", name: "modkit", releaseId: 0 },
        message: "releaseId",
      },
      {
        capabilityId: "workflow_dispatch.run",
        params: { owner: "acme", name: "modkit", ref: "main" },
        message: "workflowId",
      },
      {
        capabilityId: "workflow_dispatch.run",
        params: { owner: "acme", name: "modkit", workflowId: "ci" },
        message: "ref",
      },
      {
        capabilityId: "workflow_dispatch.run",
        params: { owner: "acme", name: "modkit", workflowId: "ci", ref: "main", inputs: null },
        message: "inputs",
      },
      {
        capabilityId: "workflow_dispatch.run",
        params: {
          owner: "acme",
          name: "modkit",
          workflowId: "ci",
          ref: "main",
          inputs: { "": "x" },
        },
        message: "inputs",
      },
      {
        capabilityId: "workflow_dispatch.run",
        params: {
          owner: "acme",
          name: "modkit",
          workflowId: "ci",
          ref: "main",
          inputs: { env: {} },
        },
        message: "inputs",
      },
      {
        capabilityId: "workflow_run.rerun_failed",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "project_v2.item.add_issue",
        params: { owner: "acme", projectNumber: 1, issueUrl: "" },
        message: "owner/projectNumber/issueUrl",
      },
      {
        capabilityId: "project_v2.item.field.update",
        params: { projectId: "", itemId: "", fieldId: "" },
        message: "projectId/itemId/fieldId",
      },
    ] as const

    for (const testCase of cases) {
      const result = await runCliCapability(runner, testCase.capabilityId, testCase.params)
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain(testCase.message)
    }

    expect(runner.run).not.toHaveBeenCalled()
  })

  it("covers value-number field updates and passthrough normalization paths", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ id: "item-42" }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ items: [{ id: "item-1", content: null }] }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ updated: true, marker: "passthrough" }),
          stderr: "",
          exitCode: 0,
        }),
    }

    const fieldUpdateResult = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "project-1",
      itemId: "item-42",
      fieldId: "field-9",
      valueNumber: 3.14,
    })
    const itemsResult = await runCliCapability(runner, "project_v2.items.list", {
      owner: "acme",
      projectNumber: 1,
      first: 10,
    })
    const branchUpdateResult = await runCliCapability(runner, "pr.branch.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 7,
    })

    expect(fieldUpdateResult.ok).toBe(true)
    expect(fieldUpdateResult.data).toEqual({
      itemId: "item-42",
      updated: true,
    })

    expect(itemsResult.ok).toBe(true)
    expect(itemsResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: "item-1",
            contentType: null,
            contentNumber: null,
            contentTitle: null,
          },
        ],
      }),
    )

    expect(branchUpdateResult.ok).toBe(true)
    expect(branchUpdateResult.data).toEqual({ prNumber: 7, updated: true })
  })

  it("normalizes project_v2.items.list when CLI payload is not an object", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "null",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.items.list", {
      owner: "acme",
      projectNumber: 1,
      first: 10,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    })
  })

  it("treats non-JSON stdout as success for reviewer and assignee updates", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ stdout: "requested reviewers", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "updated assignees", stderr: "", exitCode: 0 }),
    }

    const reviewersResult = await runCliCapability(runner, "pr.reviewers.request", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      reviewers: ["octocat"],
    })

    const assigneesResult = await runCliCapability(runner, "pr.assignees.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      add: ["octocat"],
      remove: ["hubot"],
    })

    expect(reviewersResult.ok).toBe(true)
    expect(reviewersResult.data).toEqual({
      prNumber: 42,
      reviewers: ["octocat"],
      updated: true,
    })

    expect(assigneesResult.ok).toBe(true)
    expect(assigneesResult.data).toEqual({
      prNumber: 42,
      add: ["octocat"],
      remove: ["hubot"],
      updated: true,
    })
  })

  it("surfaces rerun-all failure details when fallback rerun also fails", async () => {
    const primaryStderr = "run 88 cannot be rerun; This workflow run cannot be retried"
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: "",
          stderr: primaryStderr,
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "rerun all failed",
          exitCode: 1,
        }),
    }

    const result = await runCliCapability(runner, "pr.checks.rerun_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      runId: 88,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe("rerun all failed")
    expect(runner.run).toHaveBeenCalledTimes(2)
  })

  it("normalizes fallback defaults for non-object payloads across adapter capabilities", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: JSON.stringify([null]), stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: JSON.stringify([null]), stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "null", stderr: "", exitCode: 0 }),
    }

    const repoViewResult = await runCliCapability(runner, "repo.view", {
      owner: "acme",
      name: "modkit",
    })
    const labelsResult = await runCliCapability(runner, "repo.labels.list", {
      owner: "acme",
      name: "modkit",
      first: 5,
    })
    const issueTypesResult = await runCliCapability(runner, "repo.issue_types.list", {
      owner: "acme",
      name: "modkit",
      first: 5,
    })
    const issueCommentsResult = await runCliCapability(runner, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 5,
    })
    const workflowListResult = await runCliCapability(runner, "workflow.list", {
      owner: "acme",
      name: "modkit",
      first: 5,
    })
    const workflowGetResult = await runCliCapability(runner, "workflow.get", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
    })
    const workflowRunGetResult = await runCliCapability(runner, "workflow_run.get", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const artifactsResult = await runCliCapability(runner, "workflow_run.artifacts.list", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const projectOrgResult = await runCliCapability(runner, "project_v2.org.get", {
      org: "acme",
      projectNumber: 1,
    })
    const projectFieldsResult = await runCliCapability(runner, "project_v2.fields.list", {
      owner: "acme",
      projectNumber: 1,
    })

    expect(repoViewResult.ok).toBe(true)
    expect(repoViewResult.data).toEqual(
      expect.objectContaining({
        id: undefined,
        defaultBranch: null,
      }),
    )

    expect(labelsResult.ok).toBe(true)
    expect(labelsResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: null,
            name: null,
            description: null,
            color: null,
            isDefault: null,
          },
        ],
      }),
    )

    expect(issueTypesResult.ok).toBe(true)
    expect(issueTypesResult.data).toEqual({
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    })

    expect(issueCommentsResult.ok).toBe(false)
    expect(issueCommentsResult.error?.code).toBe("SERVER")

    expect(workflowListResult.ok).toBe(true)
    expect(workflowListResult.data).toEqual(
      expect.objectContaining({
        items: [
          {
            id: 0,
            name: null,
            path: null,
            state: null,
          },
        ],
      }),
    )

    expect(workflowGetResult.ok).toBe(true)
    expect(workflowGetResult.data).toEqual({
      id: 0,
      name: null,
      path: null,
      state: null,
      url: null,
    })

    expect(workflowRunGetResult.ok).toBe(true)
    expect(workflowRunGetResult.data).toEqual({
      id: 0,
      workflowName: null,
      status: null,
      conclusion: null,
      headBranch: null,
      headSha: null,
      event: null,
      createdAt: null,
      updatedAt: null,
      startedAt: null,
      url: null,
    })

    expect(artifactsResult.ok).toBe(true)
    expect(artifactsResult.data).toEqual({
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    })

    expect(projectOrgResult.ok).toBe(true)
    expect(projectOrgResult.data).toEqual({
      id: null,
      title: null,
      shortDescription: null,
      public: null,
      closed: null,
      url: null,
    })

    expect(projectFieldsResult.ok).toBe(true)
    expect(projectFieldsResult.data).toEqual({
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    })
  })
})
