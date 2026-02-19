import { runCliCapability } from "@core/core/execution/adapters/cli-capability-adapter.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { describe, expect, it, vi } from "vitest"

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

  it("supports issue.view and pr.view success paths with body and labels", async () => {
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
            body: "Issue body text",
            labels: [{ id: "l1", name: "bug", description: "", color: "d73a4a" }],
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            id: "pr-id",
            number: 9,
            title: "PR",
            state: "OPEN",
            url: "u",
            body: "PR body text",
            labels: [{ id: "l2", name: "enhancement", description: "", color: "a2eeef" }],
          }),
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
    expect(issueResult.data).toEqual(
      expect.objectContaining({
        id: "issue-id",
        body: "Issue body text",
        labels: ["bug"],
      }),
    )
    expect(prResult.ok).toBe(true)
    expect(prResult.data).toEqual(
      expect.objectContaining({
        id: "pr-id",
        body: "PR body text",
        labels: ["enhancement"],
      }),
    )
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

  it("normalizes pr.checks.list from gh pr checks output", async () => {
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

    const result = await runCliCapability(runner, "pr.checks.list", {
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

  it("filters failed checks for pr.checks.failed", async () => {
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

    const result = await runCliCapability(runner, "pr.checks.failed", {
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

  it("normalizes mergeability fields for pr.merge.status", async () => {
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

    const result = await runCliCapability(runner, "pr.merge.status", {
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

  it("executes pr.update (draft status change) through gh pr ready", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      draft: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      number: 10,
      url: "https://github.com/acme/modkit/pull/10",
      title: "",
      state: "OPEN",
      draft: false,
    })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "ready", "10", "--repo", "acme/modkit"],
      10_000,
    )
  })

  it("executes PR operations: review.submit (APPROVE/REQUEST_CHANGES/COMMENT), merge, and branch updates", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const approve = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "APPROVE",
      body: "Ship it",
    })
    const requestChanges = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "REQUEST_CHANGES",
      body: "Please add tests",
    })
    const comment = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "COMMENT",
      body: "Looks good with one note",
    })
    const merge = await runCliCapability(runner, "pr.merge", {
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

  it("supports pr.diff.view returning raw diff text", async () => {
    const diffText =
      "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n"
    const runner = {
      run: vi.fn(async () => ({
        stdout: diffText,
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.diff.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ diff: diffText })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "diff", "42", "--repo", "acme/modkit"],
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
    const reviewers = await runCliCapability(runner, "pr.review.request", {
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

    const rerunResult = await runCliCapability(runner, "workflow.run.rerun_failed", {
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

    const invalidReviewBody = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "COMMENT",
      body: "",
    })
    const invalidMergeMethod = await runCliCapability(runner, "pr.merge", {
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
    const invalidReviewers = await runCliCapability(runner, "pr.review.request", {
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

    const result = await runCliCapability(runner, "workflow.runs.list", {
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

  it("returns bounded workflow job logs payload", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "line1\nline2",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.job.logs.raw", {
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

    const result = await runCliCapability(runner, "workflow.job.logs.get", {
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

    const checksResult = await runCliCapability(runner, "pr.checks.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
    })
    const mergeabilityResult = await runCliCapability(runner, "pr.merge.status", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
    })
    const readyInvalidPrResult = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
      draft: true,
    })
    const workflowListResult = await runCliCapability(runner, "workflow.runs.list", {
      owner: "acme",
      name: "modkit",
      first: 0,
    })

    const workflowLogsResult = await runCliCapability(runner, "workflow.job.logs.raw", {
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
    expect(readyInvalidPrResult.ok).toBe(false)
    expect(workflowListResult.ok).toBe(false)

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

    await runCliCapability(runner, "workflow.runs.list", {
      owner: "acme",
      name: "modkit",
      first: 10,
      branch: "main",
      event: "push",
      status: "completed",
    })
    await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      draft: true,
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

    const checksResult = await runCliCapability(runner, "pr.checks.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })
    const runsResult = await runCliCapability(runner, "workflow.runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1,
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

    const checksResult = await runCliCapability(runner, "pr.checks.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
    })
    const runsResult = await runCliCapability(runner, "workflow.runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1,
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

    const mergeabilityResult = await runCliCapability(runner, "pr.merge.status", {
      owner: "acme",
      name: "modkit",
      prNumber: 2,
    })
    const logsResult = await runCliCapability(runner, "workflow.job.logs.raw", {
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
    const workflowRunGet = await runCliCapability(runner, "workflow.run.view", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const rerunAll = await runCliCapability(runner, "workflow.run.rerun_all", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const cancel = await runCliCapability(runner, "workflow.run.cancel", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const artifacts = await runCliCapability(runner, "workflow.run.artifacts.list", {
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

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
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

    const dispatchResult = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "release.yml",
      ref: "main",
      inputs: {
        channel: "stable",
        force: "true",
      },
    })

    const rerunResult = await runCliCapability(runner, "workflow.run.rerun_failed", {
      owner: "acme",
      name: "modkit",
      runId: 500,
    })

    const invalidDispatchResult = await runCliCapability(runner, "workflow.dispatch.run", {
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

    const artifactsResult = await runCliCapability(runner, "workflow.run.artifacts.list", {
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
      {
        capabilityId: "pr.review.submit",
        params: { prNumber: 0, event: "APPROVE" },
        message: "prNumber",
      },
      {
        capabilityId: "pr.review.submit",
        params: { owner: "acme", name: "modkit", prNumber: 1, event: "COMMENT" },
        message: "body",
      },
      { capabilityId: "pr.merge", params: { prNumber: 0 }, message: "prNumber" },
      {
        capabilityId: "pr.merge",
        params: { prNumber: 1, method: "fast-forward" },
        message: "method",
      },
      {
        capabilityId: "pr.merge",
        params: { prNumber: 1, method: "merge", deleteBranch: "yes" },
        message: "deleteBranch",
      },
      {
        capabilityId: "pr.checks.rerun_failed",
        params: { prNumber: 0, runId: 1 },
        message: "prNumber",
      },
      {
        capabilityId: "pr.review.request",
        params: { prNumber: 0, reviewers: ["octocat"] },
        message: "prNumber",
      },
      {
        capabilityId: "pr.review.request",
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
      { capabilityId: "pr.diff.view", params: { prNumber: 0 }, message: "prNumber" },
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
        capabilityId: "workflow.run.view",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "workflow.run.rerun_all",
        params: { owner: "acme", name: "modkit", runId: 0 },
        message: "runId",
      },
      {
        capabilityId: "workflow.run.artifacts.list",
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
        capabilityId: "workflow.dispatch.run",
        params: { owner: "acme", name: "modkit", ref: "main" },
        message: "workflowId",
      },
      {
        capabilityId: "workflow.dispatch.run",
        params: { owner: "acme", name: "modkit", workflowId: "ci" },
        message: "ref",
      },
      {
        capabilityId: "workflow.dispatch.run",
        params: { owner: "acme", name: "modkit", workflowId: "ci", ref: "main", inputs: null },
        message: "inputs",
      },
      {
        capabilityId: "workflow.dispatch.run",
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
        capabilityId: "workflow.dispatch.run",
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
        capabilityId: "workflow.run.rerun_failed",
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

    const reviewersResult = await runCliCapability(runner, "pr.review.request", {
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
    const workflowRunGetResult = await runCliCapability(runner, "workflow.run.view", {
      owner: "acme",
      name: "modkit",
      runId: 123,
    })
    const artifactsResult = await runCliCapability(runner, "workflow.run.artifacts.list", {
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
      jobs: [],
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

  it("executes pr.create with title, head, and optional body/base/draft parameters", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "https://github.com/acme/modkit/pull/99\n",
        stderr: "",
        exitCode: 0,
      })),
    }

    const basicResult = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Add feature",
      head: "feature-branch",
    })

    const fullResult = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Add feature",
      head: "feature-branch",
      body: "This adds the new feature",
      base: "develop",
      draft: true,
    })

    expect(basicResult.ok).toBe(true)
    expect(basicResult.data).toEqual({
      number: 99,
      url: "https://github.com/acme/modkit/pull/99",
      title: "Add feature",
      state: "OPEN",
      draft: false,
    })

    expect(fullResult.ok).toBe(true)
    expect(fullResult.data).toEqual({
      number: 99,
      url: "https://github.com/acme/modkit/pull/99",
      title: "Add feature",
      state: "OPEN",
      draft: true,
    })

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "create",
        "--title",
        "Add feature",
        "--head",
        "feature-branch",
      ]),
    )
    expect(calls[0]?.[1]).not.toContain("--body")
    expect(calls[0]?.[1]).not.toContain("--base")
    expect(calls[0]?.[1]).not.toContain("--draft")

    expect(calls[1]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "create",
        "--title",
        "Add feature",
        "--head",
        "feature-branch",
        "--body",
        "This adds the new feature",
        "--base",
        "develop",
        "--draft",
      ]),
    )
  })

  it("validates pr.create requires title and head parameters", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw new Error("runner should not be invoked for validation failures")
      }),
    }

    const missingTitle = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      head: "feature-branch",
    })

    const missingHead = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Add feature",
    })

    const emptyTitle = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "  ",
      head: "feature-branch",
    })

    expect(missingTitle.ok).toBe(false)
    expect(missingTitle.error?.message).toContain("title")
    expect(missingHead.ok).toBe(false)
    expect(missingHead.error?.message).toContain("head")
    expect(emptyTitle.ok).toBe(false)
    expect(emptyTitle.error?.message).toContain("title")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("executes pr.update with title/body edit or draft status change", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const editTitle = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      title: "Updated title",
    })

    const editBody = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      body: "Updated description",
    })

    const editBoth = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      title: "New title",
      body: "New body",
    })

    expect(editTitle.ok).toBe(true)
    expect(editTitle.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: false,
    })

    expect(editBody.ok).toBe(true)
    expect(editBody.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: false,
    })

    expect(editBoth.ok).toBe(true)
    expect(editBoth.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: false,
    })

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "edit",
        "42",
        "--repo",
        "acme/modkit",
        "--title",
        "Updated title",
      ]),
    )
    expect(calls[1]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "edit",
        "42",
        "--repo",
        "acme/modkit",
        "--body",
        "Updated description",
      ]),
    )
    expect(calls[2]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "edit",
        "42",
        "--repo",
        "acme/modkit",
        "--title",
        "New title",
        "--body",
        "New body",
      ]),
    )
  })

  it("executes pr.update draft status change through gh pr ready --undo", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const makeDraft = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      draft: true,
    })

    const undoDraft = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      draft: false,
    })

    expect(makeDraft.ok).toBe(true)
    expect(makeDraft.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: true,
    })

    expect(undoDraft.ok).toBe(true)
    expect(undoDraft.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: false,
    })

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    expect(calls[0]?.[1]).toEqual(["pr", "ready", "42", "--repo", "acme/modkit", "--undo"])
    expect(calls[1]?.[1]).toEqual(["pr", "ready", "42", "--repo", "acme/modkit"])
  })

  it("executes pr.update with combined edit and draft status change", async () => {
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

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      title: "Updated title",
      draft: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      number: 42,
      url: "https://github.com/acme/modkit/pull/42",
      title: "",
      state: "OPEN",
      draft: false,
    })

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    expect(calls).toHaveLength(2)
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        "pr",
        "edit",
        "42",
        "--repo",
        "acme/modkit",
        "--title",
        "Updated title",
      ]),
    )
    expect(calls[1]?.[1]).toEqual(
      expect.arrayContaining(["pr", "ready", "42", "--repo", "acme/modkit"]),
    )
  })

  it("validates pr.update requires at least one of title, body, or draft", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw new Error("runner should not be invoked for validation failures")
      }),
    }

    const noParams = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
    })

    const invalidPrNumber = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
      title: "Update",
    })

    expect(noParams.ok).toBe(false)
    expect(noParams.error?.message).toContain("title, body, or draft")
    expect(invalidPrNumber.ok).toBe(false)
    expect(invalidPrNumber.error?.message).toContain("prNumber")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("executes pr.diff.files with prNumber and optional first parameter", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          { path: "src/index.ts", additions: 10, deletions: 5, changeType: "MODIFIED" },
          { path: "README.md", additions: 2, deletions: 1, changeType: "MODIFIED" },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const defaultFirst = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
    })

    const customFirst = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      first: 50,
    })

    expect(defaultFirst.ok).toBe(true)
    expect(defaultFirst.data).toEqual([
      { path: "src/index.ts", additions: 10, deletions: 5, changeType: "MODIFIED" },
      { path: "README.md", additions: 2, deletions: 1, changeType: "MODIFIED" },
    ])

    expect(customFirst.ok).toBe(true)
    expect(customFirst.data).toEqual([
      { path: "src/index.ts", additions: 10, deletions: 5, changeType: "MODIFIED" },
      { path: "README.md", additions: 2, deletions: 1, changeType: "MODIFIED" },
    ])

    const calls = runner.run.mock.calls as unknown as [string, string[], number][]
    expect(calls[0]?.[1]).toEqual(
      expect.arrayContaining(["pr", "view", "42", "--repo", "acme/modkit", "--json", "files"]),
    )
    expect(calls[1]?.[1]).toEqual(
      expect.arrayContaining(["pr", "view", "42", "--repo", "acme/modkit", "--json", "files"]),
    )
  })

  it("validates pr.diff.files requires valid prNumber and first parameters", async () => {
    const runner = {
      run: vi.fn(async () => {
        throw new Error("runner should not be invoked for validation failures")
      }),
    }

    const invalidPrNumber = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
    })

    const invalidFirst = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      first: -5,
    })

    const floatFirst = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      first: 10.5,
    })

    expect(invalidPrNumber.ok).toBe(false)
    expect(invalidPrNumber.error?.message).toContain("prNumber")
    expect(invalidFirst.ok).toBe(false)
    expect(invalidFirst.error?.message).toContain("first")
    expect(floatFirst.ok).toBe(false)
    expect(floatFirst.error?.message).toContain("first")
    expect(runner.run).not.toHaveBeenCalled()
  })

  it("normalizes pr.diff.files output with file change information", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          { path: "src/file1.ts", additions: 5, deletions: 2, changeType: "ADDED" },
          { path: "src/file2.ts", additions: 0, deletions: 10, changeType: "DELETED" },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.diff.files", {
      owner: "acme",
      name: "modkit",
      prNumber: 42,
      first: 2,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual([
      { path: "src/file1.ts", additions: 5, deletions: 2, changeType: "ADDED" },
      { path: "src/file2.ts", additions: 0, deletions: 10, changeType: "DELETED" },
    ])
  })

  it("handles pr.update edit failure with meaningful error", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "pull request not found",
        exitCode: 1,
      })),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 999,
      title: "New title",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(result.error?.message).toContain("pull request not found")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("handles pr.update draft status change failure", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "authorization failed",
        exitCode: 1,
      })),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      draft: true,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("AUTH")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("handles pr.update when both edit and draft commands are executed and edit fails", async () => {
    const runner = {
      run: vi.fn().mockResolvedValueOnce({
        stdout: "",
        stderr: "invalid title provided",
        exitCode: 1,
      }),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      title: "New title",
      draft: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("invalid title provided")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("handles pr.update when both edit and draft commands are executed and draft fails", async () => {
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
          stderr: "cannot change draft status",
          exitCode: 1,
        }),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      title: "New title",
      draft: true,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("cannot change draft status")
    expect(runner.run).toHaveBeenCalledTimes(2)
  })

  it("handles pr.update with empty body string (included as empty string)", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      title: "New title",
      body: "",
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledTimes(1)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--title")
    expect(call[1]).toContain("--body")
    expect(call[1]).toContain("")
  })

  it("handles pr.update with non-empty body string", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      body: "Updated description",
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--body")
    expect(call[1]).toContain("Updated description")
  })

  it("handles release.publish_draft when draft read check fails", async () => {
    const runner = {
      run: vi.fn().mockResolvedValueOnce({
        stdout: "",
        stderr: "release not found",
        exitCode: 1,
      }),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 999,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(runner.run).toHaveBeenCalledTimes(1)
  })

  it("handles release.publish_draft when publish command fails after draft check passes", async () => {
    const runner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ draft: true }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: "",
          stderr: "cannot publish at this time",
          exitCode: 1,
        }),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 123,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("cannot publish at this time")
    expect(runner.run).toHaveBeenCalledTimes(2)
  })

  it("handles release.publish_draft with non-object draft response", async () => {
    const runner = {
      run: vi.fn().mockResolvedValueOnce({
        stdout: "invalid response",
        stderr: "",
        exitCode: 0,
      }),
    }

    const result = await runCliCapability(runner, "release.publish_draft", {
      owner: "acme",
      name: "modkit",
      releaseId: 123,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("SERVER")
    expect(result.error?.message).toContain("Failed to parse CLI JSON output")
  })

  it("handles pr.review.submit with empty body for REQUEST_CHANGES (invalid)", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "REQUEST_CHANGES",
      body: "   ",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("Missing or invalid body")
  })

  it("handles pr.review.submit with missing body for COMMENT (invalid)", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "COMMENT",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("Missing or invalid body")
  })

  it("handles pr.review.submit with APPROVE but optional body", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "APPROVE",
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      prNumber: 10,
      event: "APPROVE",
      submitted: true,
      body: null,
    })
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--approve")
    expect(call[1]).not.toContain("--body")
  })

  it("handles pr.merge without explicit method (defaults to merge)", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.merge", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      prNumber: 10,
      method: "merge",
      queued: true,
      deleteBranch: false,
    })
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--merge")
  })

  it("handles pr.merge with invalid deleteBranch value", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.merge", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      deleteBranch: "yes",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("deleteBranch")
  })

  it("handles pr.merge with rebase method", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.merge", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      method: "rebase",
      deleteBranch: true,
    })

    expect(result.ok).toBe(true)
    expect((result.data as Record<string, unknown>)?.method).toBe("rebase")
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--rebase")
    expect(call[1]).toContain("--delete-branch")
  })

  it("handles pr.create with only required parameters", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "https://github.com/acme/modkit/pull/7\n",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Fix bug",
      head: "bugfix/issue-123",
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      number: 7,
      url: "https://github.com/acme/modkit/pull/7",
      title: "Fix bug",
      state: "OPEN",
      draft: false,
    })
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--title")
    expect(call[1]).toContain("Fix bug")
    expect(call[1]).toContain("--head")
    expect(call[1]).toContain("bugfix/issue-123")
  })

  it("handles pr.create with all optional parameters", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Feature: new API",
      head: "feature/new-api",
      body: "This PR adds a new API endpoint",
      base: "develop",
      draft: true,
    })

    expect(result.ok).toBe(true)
    expect((result.data as Record<string, unknown>)?.draft).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--body")
    expect(call[1]).toContain("This PR adds a new API endpoint")
    expect(call[1]).toContain("--base")
    expect(call[1]).toContain("develop")
    expect(call[1]).toContain("--draft")
  })

  it("handles pr.create without required title", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      head: "feature/test",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("title")
  })

  it("handles pr.create without required head", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.create", {
      owner: "acme",
      name: "modkit",
      title: "Add feature",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("head")
  })

  it("handles workflow.dispatch.run with empty inputs object", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
      ref: "main",
      inputs: {},
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1].join("/")).toContain("workflows/ci.yml/dispatches")
  })

  it("handles workflow.dispatch.run with multiple input types", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
      ref: "main",
      inputs: {
        debug: true,
        count: 5,
        name: "test",
      },
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1].join(" ")).toContain("inputs[debug]=true")
    expect(call[1].join(" ")).toContain("inputs[count]=5")
    expect(call[1].join(" ")).toContain("inputs[name]=test")
  })

  it("handles workflow.dispatch.run with invalid input value", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
      ref: "main",
      inputs: {
        config: { nested: "object" },
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.error?.message).toContain("inputs")
  })

  it("handles workflow.dispatch.run with empty input key", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
      ref: "main",
      inputs: {
        "": "value",
      },
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
  })

  it("handles workflow.dispatch.run with invalid inputs type", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.dispatch.run", {
      owner: "acme",
      name: "modkit",
      workflowId: "ci.yml",
      ref: "main",
      inputs: "not-an-object",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
  })

  it("handles project_v2.item.field.update with valueNumber (finite check)", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_kwDO123",
      itemId: "ITEM_123",
      fieldId: "FIELD_123",
      valueNumber: 42,
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--number")
    expect(call[1]).toContain("42")
  })

  it("handles project_v2.item.field.update with clear flag", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_kwDO123",
      itemId: "ITEM_123",
      fieldId: "FIELD_123",
      clear: true,
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--clear")
  })

  it("handles project_v2.item.field.update without any value", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_kwDO123",
      itemId: "ITEM_123",
      fieldId: "FIELD_123",
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("UNKNOWN")
    expect(result.error?.message).toContain("Missing field value update")
  })

  it("handles project_v2.item.field.update with Infinity value", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "project_v2.item.field.update", {
      projectId: "PVT_kwDO123",
      itemId: "ITEM_123",
      fieldId: "FIELD_123",
      valueNumber: Infinity,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("UNKNOWN")
  })

  it("handles pr.review.request with whitespace-only reviewers filtered out", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.review.request", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      reviewers: ["alice", "   ", "bob", "\t"],
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      prNumber: 10,
      reviewers: ["alice", "bob"],
      updated: true,
    })
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--add-reviewer")
    expect(call[1]).toContain("alice,bob")
  })

  it("handles pr.assignees.update with add and remove lists", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.assignees.update", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      add: ["alice"],
      remove: ["bob"],
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      prNumber: 10,
      add: ["alice"],
      remove: ["bob"],
      updated: true,
    })
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--add-assignee")
    expect(call[1]).toContain("alice")
    expect(call[1]).toContain("--remove-assignee")
    expect(call[1]).toContain("bob")
  })

  it("handles workflow.job.logs.get with zero error/warning lines", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "Build started\nCompilation successful\nTests passed",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 123,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      jobId: 123,
      truncated: false,
      summary: {
        errorCount: 0,
        warningCount: 0,
        topErrorLines: [],
      },
    })
  })

  it("handles workflow.job.logs.get with multiple error and warning lines", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: `Error: File not found
Warning: Deprecated API
Error: Type mismatch
Info: Processing complete
warning: slow operation
ERROR: Critical issue`,
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 123,
    })

    expect(result.ok).toBe(true)
    const summary = (result.data as Record<string, unknown>)?.summary as Record<string, unknown>
    expect(summary.errorCount).toBe(3)
    expect(summary.warningCount).toBe(2)
    expect(summary.topErrorLines).toHaveLength(3)
  })

  it("handles issue.comments.list with malformed pageInfo", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [],
                  pageInfo: {
                    hasNextPage: "not-a-boolean",
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
    expect(result.error?.message).toContain("malformed")
  })

  it("handles repo.issue_types.list with empty after cursor", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          data: {
            repository: {
              issueTypes: {
                nodes: [{ id: "1", name: "Bug", color: "FF0000", isEnabled: true }],
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
      first: 10,
      after: "",
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      expect.not.arrayContaining(["-f", "after="]),
      10_000,
    )
  })

  it("handles workflow.get with numeric workflowId", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          id: 123,
          name: "CI",
          path: ".github/workflows/ci.yml",
          state: "active",
          url: "https://github.com/acme/modkit/blob/main/.github/workflows/ci.yml",
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.get", {
      owner: "acme",
      name: "modkit",
      workflowId: 456,
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("456")
  })

  it("handles pr.review.submit with APPROVE and body", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "pr.review.submit", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      event: "APPROVE",
      body: "Looks great!",
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--approve")
    expect(call[1]).toContain("--body")
    expect(call[1]).toContain("Looks great!")
  })

  it("handles workflow.runs.list with optional branch, event, and status filters", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            databaseId: 1,
            workflowName: "CI",
            status: "completed",
            conclusion: "success",
            headBranch: "feature/test",
            url: "https://example.com/run/1",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.runs.list", {
      owner: "acme",
      name: "modkit",
      first: 20,
      branch: "feature/test",
      event: "push",
      status: "completed",
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--branch")
    expect(call[1]).toContain("feature/test")
    expect(call[1]).toContain("--event")
    expect(call[1]).toContain("push")
    expect(call[1]).toContain("--status")
    expect(call[1]).toContain("completed")
  })

  it("handles repo.labels.list with default first value when undefined", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([{ id: "1", name: "bug", color: "FF0000" }]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "repo.labels.list", {
      owner: "acme",
      name: "modkit",
    })

    expect(result.ok).toBe(true)
    const call = runner.run.mock.calls[0] as unknown as [string, string[], number]
    expect(call[1]).toContain("--limit")
    expect(call[1]).toContain("30")
  })

  it("handles check_run.annotations.list with partial annotation fields", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            path: "src/main.ts",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 123,
    })

    expect(result.ok).toBe(true)
    expect((result.data as Record<string, unknown[]>).items?.[0]).toEqual({
      path: "src/main.ts",
      startLine: null,
      endLine: null,
      level: null,
      message: null,
      title: null,
      details: null,
    })
  })

  it("normalizes workflow.run.view with jobs array containing various states", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({
          databaseId: 1,
          workflowName: "CI",
          status: "in_progress",
          conclusion: null,
          headBranch: "main",
          headSha: "abc123",
          url: "https://example.com/run/1",
          event: "push",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:05:00Z",
          startedAt: "2024-01-01T00:00:30Z",
          jobs: [
            {
              databaseId: 10,
              name: "build",
              status: "in_progress",
              conclusion: null,
              startedAt: "2024-01-01T00:00:30Z",
              completedAt: null,
              url: "https://example.com/job/10",
            },
            {
              databaseId: 11,
              name: "test",
              status: "queued",
              startedAt: null,
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
      })),
    }

    const result = await runCliCapability(runner, "workflow.run.view", {
      owner: "acme",
      name: "modkit",
      runId: 1,
    })

    expect(result.ok).toBe(true)
    const jobs = (result.data as Record<string, unknown[]>).jobs
    expect(jobs).toHaveLength(2)
    expect(jobs?.[0]).toEqual(
      expect.objectContaining({
        id: 10,
        name: "build",
        status: "in_progress",
        conclusion: null,
      }),
    )
    expect(jobs?.[1]).toEqual(
      expect.objectContaining({
        id: 11,
        name: "test",
        status: "queued",
        startedAt: null,
      }),
    )
  })
})
