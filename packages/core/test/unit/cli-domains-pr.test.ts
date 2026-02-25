import { handlers } from "@core/core/execution/adapters/cli/domains/pr.js"
import type { CliHandler } from "@core/core/execution/adapters/cli/helpers.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

const h = (id: string): CliHandler => {
  const fn = handlers[id]
  if (fn === undefined) throw new Error(`no handler: ${id}`)
  return fn
}

describe("pr domain handlers", () => {
  describe("pr.view", () => {
    it("returns success with title, body, labels", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "PR_1",
          number: 123,
          title: "Fix bug",
          state: "OPEN",
          url: "https://github.com/owner/repo/pull/123",
          body: "This fixes the bug",
          labels: [
            { id: "L_1", name: "bug" },
            { id: "L_2", name: "urgent" },
          ],
        }),
      )

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        number: 123,
        title: "Fix bug",
        state: "OPEN",
        body: "This fixes the bug",
        labels: ["bug", "urgent"],
      })
      expect(result.meta.capability_id).toBe("pr.view")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "pull request not found")

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("pr.view")
    })
  })

  describe("pr.list", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            id: "PR_1",
            number: 1,
            title: "First PR",
            state: "OPEN",
            url: "https://github.com/owner/repo/pull/1",
          },
          {
            id: "PR_2",
            number: 2,
            title: "Second PR",
            state: "MERGED",
            url: "https://github.com/owner/repo/pull/2",
          },
        ]),
      )

      const result = await h("pr.list")(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { number: 1, title: "First PR", state: "OPEN" },
          { number: 2, title: "Second PR", state: "MERGED" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.list")(runner, { owner: "owner", name: "repo", first: 50 }, undefined)

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "list", "--limit", "50"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.create", () => {
    it("parses URL from stdout and returns success", async () => {
      const runner = mockRunner(0, "https://github.com/owner/repo/pull/42\nPull request created")

      const result = await h("pr.create")(
        runner,
        {
          owner: "owner",
          name: "repo",
          title: "New feature",
          head: "feature-branch",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        number: 42,
        url: "https://github.com/owner/repo/pull/42",
        title: "New feature",
        state: "OPEN",
        draft: false,
      })
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "branch not found")

      const result = await h("pr.create")(
        runner,
        {
          owner: "owner",
          name: "repo",
          title: "New feature",
          head: "missing-branch",
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.update", () => {
    it("calls pr edit with title and body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, title: "Updated title", body: "New body" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "pr",
          "edit",
          "123",
          "--title",
          "Updated title",
          "--body",
          "New body",
        ]),
        expect.any(Number),
      )
    })

    it("draft-only path calls pr ready with --undo", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, draft: true },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "ready", "123", "--undo"]),
        expect.any(Number),
      )
    })

    it("with title and draft calls both pr edit and pr ready", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, title: "New title", draft: false },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledTimes(2)
      expect(runSpy).toHaveBeenNthCalledWith(
        1,
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--title", "New title"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenNthCalledWith(
        2,
        "gh",
        expect.arrayContaining(["pr", "ready", "123"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.checks.list", () => {
    it("returns all checks with summary", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            name: "test",
            state: "PASS",
            bucket: "PASS",
            workflow: "test.yml",
            link: "https://...",
          },
          {
            name: "lint",
            state: "FAIL",
            bucket: "FAIL",
            workflow: "lint.yml",
            link: "https://...",
          },
          {
            name: "build",
            state: "PENDING",
            bucket: "PENDING",
            workflow: "build.yml",
            link: "https://...",
          },
        ]),
      )

      const result = await h("pr.checks.list")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "test", state: "PASS" },
          { name: "lint", state: "FAIL" },
          { name: "build", state: "PENDING" },
        ],
        summary: { total: 3, failed: 1, pending: 1, passed: 1 },
      })
    })
  })

  describe("pr.checks.rerun.failed", () => {
    it("succeeds with runId integer and queued", async () => {
      const runner = mockRunner(0, "", "")

      const result = await h("pr.checks.rerun.failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 999,
        queued: true,
      })
    })

    it("falls back to rerun_all when stderr contains 'cannot be rerun' and 'cannot be retried'", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "the workflow run cannot be rerun because it cannot be retried",
        })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })

      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.checks.rerun.failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 999,
        queued: true,
      })
      expect(runSpy).toHaveBeenCalledTimes(2)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run not found")

      const result = await h("pr.checks.rerun.failed")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.checks.rerun.all", () => {
    it("succeeds with runId integer and queued", async () => {
      const runner = mockRunner(0, "", "")

      const result = await h("pr.checks.rerun.all")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, runId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 999,
        queued: true,
      })
    })
  })

  describe("pr.reviews.submit", () => {
    it("APPROVE with optional body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.reviews.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "APPROVE",
          body: "Looks good",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        event: "APPROVE",
        submitted: true,
        body: "Looks good",
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "review", "123", "--approve", "--body", "Looks good"]),
        expect.any(Number),
      )
    })

    it("REQUEST_CHANGES requires body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.reviews.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "REQUEST_CHANGES",
          body: "Please fix this",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "pr",
          "review",
          "123",
          "--request-changes",
          "--body",
          "Please fix this",
        ]),
        expect.any(Number),
      )
    })

    it("COMMENT requires body", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.reviews.submit")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          event: "COMMENT",
          body: "Nice work",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "review", "123", "--comment", "--body", "Nice work"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.merge", () => {
    it("succeeds with method squash and deleteBranch", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.merge")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          method: "squash",
          deleteBranch: true,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        method: "squash",
        isMethodAssumed: false,
        queued: true,
        deleteBranch: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "merge", "123", "--squash", "--delete-branch"]),
        expect.any(Number),
      )
    })

    it("defaults to merge method", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.merge")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "merge", "123", "--merge"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.reviews.request", () => {
    it("succeeds with reviewers list", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.reviews.request")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          reviewers: ["alice", "bob"],
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        reviewers: ["alice", "bob"],
        updated: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--add-reviewer", "alice,bob"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.assignees.add", () => {
    it("adds assignees", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.assignees.add")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          assignees: ["alice", "bob"],
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        added: ["alice", "bob"],
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--add-assignee", "alice,bob"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.assignees.remove", () => {
    it("removes assignees", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.assignees.remove")(
        runner,
        {
          owner: "owner",
          name: "repo",
          prNumber: 123,
          assignees: ["alice", "bob"],
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        removed: ["alice", "bob"],
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "edit", "123", "--remove-assignee", "alice,bob"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.branch.update", () => {
    it("succeeds", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.branch.update")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        prNumber: 123,
        updated: true,
      })
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["pr", "update-branch", "123"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.diff.view", () => {
    it("returns raw diff text", async () => {
      const diffText = "--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new"
      const runner = mockRunner(0, diffText)

      const result = await h("pr.diff.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        diff: diffText,
      })
    })
  })

  describe("pr.diff.files", () => {
    it("returns files list", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          files: [
            { name: "file1.ts", additions: 10, deletions: 2 },
            { name: "file2.ts", additions: 5, deletions: 1 },
          ],
        }),
      )

      const result = await h("pr.diff.files")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123, first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        files: [
          { name: "file1.ts", additions: 10, deletions: 2 },
          { name: "file2.ts", additions: 5, deletions: 1 },
        ],
      })
    })
  })

  describe("pr.merge.status", () => {
    it("returns merge status fields", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewDecision: "APPROVED",
          isDraft: false,
          state: "OPEN",
        }),
      )

      const result = await h("pr.merge.status")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: "APPROVED",
        isDraft: false,
        state: "OPEN",
      })
    })
  })

  describe("error handling", () => {
    it("returns error for pr.view on non-zero exit", async () => {
      const runner = mockRunner(1, "", "authentication failed")

      const result = await h("pr.view")(
        runner,
        { owner: "owner", name: "repo", prNumber: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.code).toBeDefined()
    })

    it("handles JSON parse errors gracefully", async () => {
      const runner = mockRunner(0, "invalid json {")

      const result = await h("pr.list")(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("validates required parameters", async () => {
      const runner = mockRunner(0, "")

      const result = await h("pr.view")(runner, { owner: "owner", name: "repo" }, undefined)

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })
  })
})

describe("pr domain handlers – additional coverage", () => {
  describe("pr.view", () => {
    it("returns error on malformed JSON", async () => {
      const result = await h("pr.view")(
        mockRunner(0, "not-json"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns success with empty body when response is a JSON array", async () => {
      const result = await h("pr.view")(
        mockRunner(0, "[1,2,3]"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as Record<string, unknown>).body).toBe("")
    })

    it("filters out non-object label items", async () => {
      const result = await h("pr.view")(
        mockRunner(
          0,
          JSON.stringify({
            id: "PR_1",
            number: 1,
            title: "T",
            state: "OPEN",
            url: "http://x",
            labels: ["string-label", null, 42],
          }),
        ),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as { labels: unknown[] }).labels).toHaveLength(0)
    })

    it("returns empty labels when labels field is not an array", async () => {
      const result = await h("pr.view")(
        mockRunner(
          0,
          JSON.stringify({
            id: "PR_1",
            number: 1,
            title: "T",
            state: "OPEN",
            url: "http://x",
            labels: "not-an-array",
          }),
        ),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as { labels: unknown[] }).labels).toEqual([])
    })
  })

  describe("pr.list", () => {
    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.list")(
        mockRunner(1, "", "api error"),
        { owner: "o", name: "r", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error for missing first param", async () => {
      const result = await h("pr.list")(
        mockRunner(0, "[]"),
        { owner: "o", name: "r", first: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("returns error on malformed JSON", async () => {
      const result = await h("pr.list")(
        mockRunner(0, "not-json"),
        { owner: "o", name: "r", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("pr.create", () => {
    it("returns error for missing title", async () => {
      const result = await h("pr.create")(
        mockRunner(0, ""),
        { owner: "o", name: "r", head: "feature" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("title")
    })

    it("returns error for missing head", async () => {
      const result = await h("pr.create")(
        mockRunner(0, ""),
        { owner: "o", name: "r", title: "PR title" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("head")
    })

    it("includes optional body, base, draft in args", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValue({ exitCode: 0, stdout: "https://github.com/o/r/pull/5", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.create")(
        runner,
        {
          owner: "o",
          name: "r",
          title: "New PR",
          head: "feature",
          body: "body text",
          base: "main",
          draft: true,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--body", "body text", "--base", "main", "--draft"]),
        expect.any(Number),
      )
    })

    it("handles stdout without URL match", async () => {
      const runner = mockRunner(0, "Pull request created successfully")

      const result = await h("pr.create")(
        runner,
        { owner: "owner", name: "repo", title: "PR title", head: "feature" },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect((result.data as Record<string, unknown>).number).toBe(1)
    })
  })

  describe("pr.update", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.update")(
        mockRunner(0, ""),
        { owner: "o", name: "r", title: "t" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error when neither fields nor draft provided", async () => {
      const result = await h("pr.update")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("draft")
    })

    it("returns error when edit call fails", async () => {
      const result = await h("pr.update")(
        mockRunner(1, "", "edit failed"),
        { owner: "o", name: "r", prNumber: 1, title: "new title" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when ready call fails", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "ready failed" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.update")(
        runner,
        { owner: "o", name: "r", prNumber: 1, title: "new title", draft: false },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.checks.list", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.checks.list")(
        mockRunner(0, "[]"),
        { owner: "o", name: "r" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.checks.list")(
        mockRunner(1, "", "checks failed"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error on malformed JSON", async () => {
      const result = await h("pr.checks.list")(
        mockRunner(0, "not-json"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("pr.merge.status", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.merge.status")(
        mockRunner(0, "{}"),
        { owner: "o", name: "r" },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.merge.status")(
        mockRunner(1, "", "not found"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error on malformed JSON", async () => {
      const result = await h("pr.merge.status")(
        mockRunner(0, "not-json"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("pr.reviews.submit", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.reviews.submit")(
        mockRunner(0, ""),
        { owner: "o", name: "r", event: "APPROVE" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for invalid event", async () => {
      const result = await h("pr.reviews.submit")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, event: "INVALID" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("event")
    })

    it("returns error for REQUEST_CHANGES without body", async () => {
      const result = await h("pr.reviews.submit")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, event: "REQUEST_CHANGES" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("body")
    })

    it("returns error for COMMENT without body", async () => {
      const result = await h("pr.reviews.submit")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, event: "COMMENT" },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("APPROVE without body does not include --body flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await h("pr.reviews.submit")(
        runner,
        { owner: "o", name: "r", prNumber: 1, event: "APPROVE" },
        undefined,
      )

      const args = runSpy.mock.calls[0]?.[1] as string[]
      expect(args).toContain("--approve")
      expect(args).not.toContain("--body")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.reviews.submit")(
        mockRunner(1, "", "review failed"),
        { owner: "o", name: "r", prNumber: 1, event: "APPROVE" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.merge", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.merge")(mockRunner(0, ""), { owner: "o", name: "r" }, undefined)
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for invalid method", async () => {
      const result = await h("pr.merge")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, method: "fast-forward" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("method")
    })

    it("returns error for non-boolean deleteBranch", async () => {
      const result = await h("pr.merge")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, deleteBranch: "yes" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("deleteBranch")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.merge")(
        mockRunner(1, "", "merge conflict"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("succeeds with rebase method", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.merge")(
        runner,
        { owner: "o", name: "r", prNumber: 1, method: "rebase" },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect((result.data as Record<string, unknown>).method).toBe("rebase")
      expect((result.data as Record<string, unknown>).isMethodAssumed).toBe(false)
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--rebase"]),
        expect.any(Number),
      )
    })
  })

  describe("pr.checks.rerun.failed", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.checks.rerun.failed")(
        mockRunner(0, ""),
        { owner: "o", name: "r", runId: 999 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for missing runId", async () => {
      const result = await h("pr.checks.rerun.failed")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("runId")
    })

    it("returns error when fallback-to-all also fails", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "the workflow run cannot be rerun because it cannot be retried",
        })
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "rerun all failed" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await h("pr.checks.rerun.failed")(
        runner,
        { owner: "o", name: "r", prNumber: 1, runId: 999 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(runSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe("pr.checks.rerun.all", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.checks.rerun.all")(
        mockRunner(0, ""),
        { owner: "o", name: "r", runId: 999 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for missing runId", async () => {
      const result = await h("pr.checks.rerun.all")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("runId")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.checks.rerun.all")(
        mockRunner(1, "", "rerun failed"),
        { owner: "o", name: "r", prNumber: 1, runId: 999 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.reviews.request", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.reviews.request")(
        mockRunner(0, ""),
        { owner: "o", name: "r", reviewers: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for empty reviewers", async () => {
      const result = await h("pr.reviews.request")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, reviewers: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("reviewers")
    })

    it("returns error when reviewers is not an array", async () => {
      const result = await h("pr.reviews.request")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, reviewers: "alice" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("reviewers")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.reviews.request")(
        mockRunner(1, "", "reviewer not found"),
        { owner: "o", name: "r", prNumber: 1, reviewers: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.assignees.add", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.assignees.add")(
        mockRunner(0, ""),
        { owner: "o", name: "r", assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for empty assignees", async () => {
      const result = await h("pr.assignees.add")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, assignees: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error when assignees is not an array", async () => {
      const result = await h("pr.assignees.add")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, assignees: "alice" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.assignees.add")(
        mockRunner(1, "", "assignee error"),
        { owner: "o", name: "r", prNumber: 1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("timeout")),
      } as unknown as CliCommandRunner

      const result = await h("pr.assignees.add")(
        runner,
        { owner: "o", name: "r", prNumber: 1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("timeout")
    })
  })

  describe("pr.assignees.remove", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.assignees.remove")(
        mockRunner(0, ""),
        { owner: "o", name: "r", assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for empty assignees", async () => {
      const result = await h("pr.assignees.remove")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, assignees: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error when assignees is not an array", async () => {
      const result = await h("pr.assignees.remove")(
        mockRunner(0, ""),
        { owner: "o", name: "r", prNumber: 1, assignees: "alice" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.assignees.remove")(
        mockRunner(1, "", "assignee error"),
        { owner: "o", name: "r", prNumber: 1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("timeout")),
      } as unknown as CliCommandRunner

      const result = await h("pr.assignees.remove")(
        runner,
        { owner: "o", name: "r", prNumber: 1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("timeout")
    })
  })

  describe("pr.branch.update", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.branch.update")(
        mockRunner(0, ""),
        { owner: "o", name: "r" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.branch.update")(
        mockRunner(1, "", "update failed"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.diff.view", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.diff.view")(
        mockRunner(0, ""),
        { owner: "o", name: "r" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.diff.view")(
        mockRunner(1, "", "diff failed"),
        { owner: "o", name: "r", prNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("pr.diff.files", () => {
    it("returns error for missing prNumber", async () => {
      const result = await h("pr.diff.files")(
        mockRunner(0, "{}"),
        { owner: "o", name: "r", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("prNumber")
    })

    it("returns error for missing first", async () => {
      const result = await h("pr.diff.files")(
        mockRunner(0, "{}"),
        { owner: "o", name: "r", prNumber: 1, first: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("returns error on non-zero exit code", async () => {
      const result = await h("pr.diff.files")(
        mockRunner(1, "", "diff files failed"),
        { owner: "o", name: "r", prNumber: 1, first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error on malformed JSON", async () => {
      const result = await h("pr.diff.files")(
        mockRunner(0, "not-json"),
        { owner: "o", name: "r", prNumber: 1, first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })
})

describe("pr domain handlers – null owner/name ?? branch coverage", () => {
  const nr = () => mockRunner(1, "", "err")

  it("pr.view covers owner/name null branches", async () => {
    const result = await h("pr.view")(nr(), { owner: null, name: null, prNumber: 1 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("pr.list covers owner/name null branches", async () => {
    const result = await h("pr.list")(nr(), { owner: null, name: null, first: 30 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("pr.create covers owner/name null branches", async () => {
    const result = await h("pr.create")(
      nr(),
      { owner: null, name: null, title: "T", head: "b" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.update covers owner/name null branches", async () => {
    const result = await h("pr.update")(nr(), { owner: null, name: null, prNumber: 1 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("pr.checks.list covers owner/name null branches", async () => {
    const result = await h("pr.checks.list")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.merge.status covers owner/name null branches", async () => {
    const result = await h("pr.merge.status")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.reviews.submit covers owner/name null branches", async () => {
    const result = await h("pr.reviews.submit")(
      nr(),
      { owner: null, name: null, prNumber: 1, event: "APPROVE" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.merge covers owner/name null branches", async () => {
    const result = await h("pr.merge")(nr(), { owner: null, name: null, prNumber: 1 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("pr.checks.rerun.failed covers owner/name null branches", async () => {
    const result = await h("pr.checks.rerun.failed")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.checks.rerun.all covers owner/name null branches", async () => {
    const result = await h("pr.checks.rerun.all")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.reviews.request covers owner/name null branches", async () => {
    const result = await h("pr.reviews.request")(
      nr(),
      { owner: null, name: null, prNumber: 1, reviewers: ["alice"] },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.assignees.add covers owner/name null branches", async () => {
    const result = await h("pr.assignees.add")(
      nr(),
      { owner: null, name: null, prNumber: 1, assignees: ["alice"] },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.assignees.remove covers owner/name null branches", async () => {
    const result = await h("pr.assignees.remove")(
      nr(),
      { owner: null, name: null, prNumber: 1, assignees: ["alice"] },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.branch.update covers owner/name null branches", async () => {
    const result = await h("pr.branch.update")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.diff.view covers owner/name null branches", async () => {
    const result = await h("pr.diff.view")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("pr.diff.files covers owner/name null branches", async () => {
    const result = await h("pr.diff.files")(
      nr(),
      { owner: null, name: null, prNumber: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })
})
