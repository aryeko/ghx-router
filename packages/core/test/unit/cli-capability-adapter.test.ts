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

  it("uses card-provided CLI command and json fields when available", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify({ id: "repo-id", name: "modkit", nameWithOwner: "acme/modkit", isPrivate: false, url: "u" }),
        stderr: "",
        exitCode: 0
      }))
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
        jsonFields: ["id", "name", "nameWithOwner", "isPrivate", "url"]
      }
    } as unknown as OperationCard

    await runCliCapability(runner, "repo.view", { owner: "acme", name: "modkit" }, card)

    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["repo", "view", "acme/modkit", "--json", "id,name,nameWithOwner,isPrivate,url"],
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

  it("normalizes pr.status.checks from gh pr checks output", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: JSON.stringify([
          {
            name: "unit-tests",
            state: "SUCCESS",
            bucket: "pass",
            workflow: "ci",
            link: "https://example.com/check/1"
          },
          {
            name: "lint",
            state: "FAILURE",
            bucket: "fail",
            workflow: "ci",
            link: "https://example.com/check/2"
          }
        ]),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 10
    })

    expect(result.ok).toBe(true)
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "checks", "10", "--repo", "acme/modkit", "--json", "name,state,bucket,workflow,link"],
      10_000
    )
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ name: "unit-tests" }), expect.objectContaining({ name: "lint" })],
        summary: expect.objectContaining({ total: 2, failed: 1, passed: 1 })
      })
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
            link: "https://example.com/check/1"
          },
          {
            name: "lint",
            state: "FAILURE",
            bucket: "fail",
            workflow: "ci",
            link: "https://example.com/check/2"
          }
        ]),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "pr.checks.get_failed", {
      owner: "acme",
      name: "modkit",
      prNumber: 10
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ name: "lint", state: "FAILURE" })],
        summary: expect.objectContaining({ total: 2, failed: 1 })
      })
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
          state: "OPEN"
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 10
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      reviewDecision: "APPROVED",
      isDraft: false,
      state: "OPEN"
    })
  })

  it("executes ready-for-review mutation through gh pr ready", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      ready: true
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ prNumber: 10, isDraft: false })
    expect(runner.run).toHaveBeenCalledWith(
      "gh",
      ["pr", "ready", "10", "--repo", "acme/modkit"],
      10_000
    )
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
            raw_details: "no-explicit-any"
          }
        ]),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 100
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: "src/index.ts", level: "failure" })]
      })
    )
  })

  it("returns validation error when check run annotations owner/name is missing", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "",
      name: "",
      checkRunId: 100
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
            url: "https://example.com/run/1"
          }
        ]),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 1, workflowName: "CI" })]
      })
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
              url: "https://example.com/job/11"
            }
          ]
        }),
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 200
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 11, name: "build" })]
      })
    )
  })

  it("returns bounded workflow job logs payload", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "line1\nline2",
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 300
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      jobId: 300,
      log: "line1\nline2",
      truncated: false
    })
  })

  it("analyzes workflow job logs into structured summary", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "ERROR test failed\nwarning: flaky\nError: compile failed",
        stderr: "",
        exitCode: 0
      }))
    }

    const result = await runCliCapability(runner, "workflow_job.logs.analyze", {
      owner: "acme",
      name: "modkit",
      jobId: 300
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        jobId: 300,
        summary: expect.objectContaining({
          errorCount: 2,
          warningCount: 1,
          topErrorLines: expect.arrayContaining(["ERROR test failed", "Error: compile failed"])
        })
      })
    )
  })

  it("validates PR and workflow numeric inputs", async () => {
    const runner = {
      run: vi.fn(async () => ({
        stdout: "[]",
        stderr: "",
        exitCode: 0
      }))
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 0
    })
    const mergeabilityResult = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 0
    })
    const readyResult = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      ready: "yes"
    })
    const readyInvalidPrResult = await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 0,
      ready: true
    })
    const workflowListResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 0
    })
    const workflowJobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 0
    })
    const workflowLogsResult = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 0
    })
    const checkRunInvalidIdResult = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 0
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
            exitCode: 0
          }
        }

        return {
          stdout: "{}",
          stderr: "",
          exitCode: 0
        }
      })
    }

    await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 10,
      branch: "main",
      event: "push",
      status: "completed"
    })
    await runCliCapability(runner, "pr.ready_for_review.set", {
      owner: "acme",
      name: "modkit",
      prNumber: 10,
      ready: false
    })

    const workflowRunCall = runner.run.mock.calls.find((call) => call[1][0] === "run" && call[1][1] === "list")
    expect(workflowRunCall?.[1]).toEqual(
      expect.arrayContaining(["--branch", "main", "--event", "push", "--status", "completed"])
    )

    const readyCall = runner.run.mock.calls.find((call) => call[1][0] === "pr" && call[1][1] === "ready")
    expect(readyCall?.[1]).toEqual(expect.arrayContaining(["--undo"]))
  })

  it("normalizes fallback defaults for check, run, job, and annotation payloads", async () => {
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "pr" && args[1] === "checks") {
          return {
            stdout: JSON.stringify([null, { state: 42 }]),
            stderr: "",
            exitCode: 0
          }
        }
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([null]),
            stderr: "",
            exitCode: 0
          }
        }
        if (args[0] === "run" && args[1] === "view" && args.includes("--json")) {
          return {
            stdout: JSON.stringify({ jobs: [null] }),
            stderr: "",
            exitCode: 0
          }
        }

        return {
          stdout: JSON.stringify([null]),
          stderr: "",
          exitCode: 0
        }
      })
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 1
    })
    const runsResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1
    })
    const jobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 1
    })
    const annotationsResult = await runCliCapability(runner, "check_run.annotations.list", {
      owner: "acme",
      name: "modkit",
      checkRunId: 1
    })

    expect(checksResult.ok).toBe(true)
    expect(checksResult.data).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({ name: null, state: null, bucket: null, workflow: null, link: null }),
          expect.objectContaining({ name: null, state: null, bucket: null, workflow: null, link: null })
        ]
      })
    )
    expect(runsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 0, workflowName: null, status: null })]
      })
    )
    expect(jobsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 0, name: null, status: null })]
      })
    )
    expect(annotationsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: null, level: null, message: null })]
      })
    )
  })

  it("normalizes non-array checks and non-object workflow payloads", async () => {
    const runner = {
      run: vi.fn(async (_command: string, args: string[]) => {
        if (args[0] === "pr" && args[1] === "checks") {
          return {
            stdout: JSON.stringify({ unexpected: true }),
            stderr: "",
            exitCode: 0
          }
        }
        if (args[0] === "run" && args[1] === "list") {
          return {
            stdout: JSON.stringify([{
              databaseId: "x",
              workflowName: 1,
              status: 2,
              conclusion: 3,
              headBranch: 4,
              url: 5
            }]),
            stderr: "",
            exitCode: 0
          }
        }
        if (args[0] === "run" && args[1] === "view" && args.includes("--json")) {
          return {
            stdout: JSON.stringify(null),
            stderr: "",
            exitCode: 0
          }
        }

        return {
          stdout: "null",
          stderr: "",
          exitCode: 0
        }
      })
    }

    const checksResult = await runCliCapability(runner, "pr.status.checks", {
      owner: "acme",
      name: "modkit",
      prNumber: 1
    })
    const runsResult = await runCliCapability(runner, "workflow_runs.list", {
      owner: "acme",
      name: "modkit",
      first: 1
    })
    const jobsResult = await runCliCapability(runner, "workflow_run.jobs.list", {
      owner: "acme",
      name: "modkit",
      runId: 1
    })

    expect(checksResult.data).toEqual(
      expect.objectContaining({
        items: [],
        summary: expect.objectContaining({ total: 0, failed: 0, pending: 0, passed: 0 })
      })
    )
    expect(runsResult.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 0, workflowName: null, status: null, conclusion: null, headBranch: null, url: null })]
      })
    )
    expect(jobsResult.data).toEqual(
      expect.objectContaining({
        items: []
      })
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
            exitCode: 0
          }
        }

        return {
          stdout: longLog,
          stderr: "",
          exitCode: 0
        }
      })
    }

    const mergeabilityResult = await runCliCapability(runner, "pr.mergeability.view", {
      owner: "acme",
      name: "modkit",
      prNumber: 2
    })
    const logsResult = await runCliCapability(runner, "workflow_job.logs.get", {
      owner: "acme",
      name: "modkit",
      jobId: 2
    })

    expect(mergeabilityResult.ok).toBe(true)
    expect(mergeabilityResult.data).toEqual(
      expect.objectContaining({
        mergeable: null,
        mergeStateStatus: null,
        reviewDecision: null,
        isDraft: false,
        state: "UNKNOWN"
      })
    )
    expect(logsResult.ok).toBe(true)
    expect((logsResult.data as { truncated: boolean }).truncated).toBe(true)
    expect((logsResult.data as { log: string }).log.length).toBe(50_000)
  })
})
