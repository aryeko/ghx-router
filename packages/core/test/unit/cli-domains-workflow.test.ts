import {
  handleWorkflowDispatchRun,
  handleWorkflowGet,
  handleWorkflowJobLogsGet,
  handleWorkflowJobLogsRaw,
  handleWorkflowList,
  handleWorkflowRunArtifactsList,
  handleWorkflowRunCancel,
  handleWorkflowRunRerunAll,
  handleWorkflowRunRerunFailed,
  handleWorkflowRunsList,
  handleWorkflowRunView,
} from "@core/core/execution/adapters/cli/domains/workflow.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

describe("workflow domain handlers", () => {
  describe("handleWorkflowRunsList", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            databaseId: 123456,
            workflowName: "CI",
            status: "completed",
            conclusion: "success",
            headBranch: "main",
            url: "https://github.com/owner/repo/actions/runs/123456",
          },
          {
            databaseId: 123457,
            workflowName: "CD",
            status: "in_progress",
            conclusion: null,
            headBranch: "develop",
            url: "https://github.com/owner/repo/actions/runs/123457",
          },
        ]),
      )

      const result = await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { id: 123456, workflowName: "CI", status: "completed", conclusion: "success" },
          { id: 123457, workflowName: "CD", status: "in_progress", conclusion: null },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("workflow.runs.list")
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowRunsList(runner, { owner: "owner", name: "repo", first: 50 }, undefined)

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["run", "list", "--limit", "50"]),
        expect.any(Number),
      )
    })

    it("includes optional branch filter", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30, branch: "main" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--branch", "main"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "permission denied")

      const result = await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("workflow.runs.list")
    })

    it("returns error when owner/name missing", async () => {
      const runner = mockRunner(0, "[]")

      const result = await handleWorkflowRunsList(runner, { first: 30 }, undefined)

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowJobLogsRaw", () => {
    it("returns success with raw log content", async () => {
      const logContent = "Line 1\nLine 2\nLine 3\n"
      const runner = mockRunner(0, logContent)

      const result = await handleWorkflowJobLogsRaw(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        jobId: 999,
        log: logContent,
        truncated: false,
      })
      expect(result.meta.capability_id).toBe("workflow.job.logs.raw")
    })

    it("marks log as truncated when exceeding MAX_WORKFLOW_JOB_LOG_CHARS", async () => {
      const largeLog = "x".repeat(51_000)
      const runner = mockRunner(0, largeLog)

      const result = await handleWorkflowJobLogsRaw(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        jobId: 999,
        truncated: true,
      })
      expect((result.data as Record<string, unknown>).log).toHaveLength(50_000)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "job not found")

      const result = await handleWorkflowJobLogsRaw(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error for invalid jobId", async () => {
      const runner = mockRunner(0, "log")

      const result = await handleWorkflowJobLogsRaw(
        runner,
        { owner: "owner", name: "repo", jobId: "not-a-number" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowJobLogsGet", () => {
    it("returns success with error/warning summary", async () => {
      const logContent = `Starting job
Error: Something went wrong
Warning: Check this out
More content
Error: Another problem
Info: All good
Warning: Be careful
Final line`
      const runner = mockRunner(0, logContent)

      const result = await handleWorkflowJobLogsGet(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.jobId).toBe(999)
      expect(data.truncated).toBe(false)
      const summary = data.summary as Record<string, unknown>
      expect(summary.errorCount).toBe(2)
      expect(summary.warningCount).toBe(2)
      expect(Array.isArray(summary.topErrorLines)).toBe(true)
      expect((summary.meta as Record<string, unknown> | undefined)?.capability_id).toBeUndefined()
    })

    it("includes up to 10 error lines in topErrorLines", async () => {
      const errorLines = Array.from({ length: 15 }, (_, i) => `Error: line ${i}`).join("\n")
      const runner = mockRunner(0, errorLines)

      const result = await handleWorkflowJobLogsGet(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const data = result.data as Record<string, unknown>
      const summary = data.summary as Record<string, unknown>
      expect(summary.errorCount).toBe(15)
      expect((summary.topErrorLines as unknown[]).length).toBe(10)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "job failed")

      const result = await handleWorkflowJobLogsGet(
        runner,
        { owner: "owner", name: "repo", jobId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowList", () => {
    it("returns success with normalized workflow items", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            id: 111,
            name: "CI",
            path: ".github/workflows/ci.yml",
            state: "active",
          },
          {
            id: 222,
            name: "Release",
            path: ".github/workflows/release.yml",
            state: "disabled",
          },
        ]),
      )

      const result = await handleWorkflowList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { id: 111, name: "CI", path: ".github/workflows/ci.yml", state: "active" },
          { id: 222, name: "Release", path: ".github/workflows/release.yml", state: "disabled" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("workflow.list")
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowList(runner, { owner: "owner", name: "repo", first: 20 }, undefined)

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["workflow", "list", "--limit", "20"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "access denied")

      const result = await handleWorkflowList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowGet", () => {
    it("returns success with workflow details including url", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 111,
          name: "CI",
          path: ".github/workflows/ci.yml",
          state: "active",
          url: "https://github.com/owner/repo/blob/main/.github/workflows/ci.yml",
        }),
      )

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: 111 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: 111,
        name: "CI",
        path: ".github/workflows/ci.yml",
        state: "active",
        url: "https://github.com/owner/repo/blob/main/.github/workflows/ci.yml",
      })
      expect(result.meta.capability_id).toBe("workflow.view")
    })

    it("accepts workflowId as number", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 111,
          name: "CI",
          path: "ci.yml",
          state: "active",
          url: "http://example.com",
        }),
      )

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: 111 },
        undefined,
      )

      expect(result.ok).toBe(true)
    })

    it("accepts workflowId as string", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 111,
          name: "CI",
          path: "ci.yml",
          state: "active",
          url: "http://example.com",
        }),
      )

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: "ci.yml" },
        undefined,
      )

      expect(result.ok).toBe(true)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "not found")

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: 999 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowRunView", () => {
    it("returns success with run details and jobs array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          databaseId: 123456,
          workflowName: "CI",
          status: "completed",
          conclusion: "success",
          headBranch: "main",
          headSha: "abc123",
          url: "https://github.com/owner/repo/actions/runs/123456",
          event: "push",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T01:00:00Z",
          startedAt: "2024-01-01T00:01:00Z",
          jobs: [
            {
              databaseId: 456789,
              name: "build",
              status: "completed",
              conclusion: "success",
              startedAt: "2024-01-01T00:01:00Z",
              completedAt: "2024-01-01T00:50:00Z",
              url: "https://github.com/owner/repo/actions/runs/123456/jobs/456789",
            },
            {
              databaseId: 456790,
              name: "test",
              status: "completed",
              conclusion: "success",
              startedAt: "2024-01-01T00:52:00Z",
              completedAt: "2024-01-01T01:00:00Z",
              url: "https://github.com/owner/repo/actions/runs/123456/jobs/456790",
            },
          ],
        }),
      )

      const result = await handleWorkflowRunView(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.id).toBe(123456)
      expect(data.workflowName).toBe("CI")
      expect(data.status).toBe("completed")
      expect(Array.isArray(data.jobs)).toBe(true)
      expect((data.jobs as unknown[]).length).toBe(2)
      const firstJob = (data.jobs as unknown[] as Record<string, unknown>[])[0]
      expect(firstJob?.id).toBe(456789)
      expect(firstJob?.name).toBe("build")
      expect(result.meta.capability_id).toBe("workflow.run.view")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run not found")

      const result = await handleWorkflowRunView(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error for invalid runId", async () => {
      const runner = mockRunner(0, "{}")

      const result = await handleWorkflowRunView(
        runner,
        { owner: "owner", name: "repo", runId: "invalid" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowRunRerunAll", () => {
    it("returns success with status requested", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowRunRerunAll(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 123456,
        queued: true,
      })
      expect(result.meta.capability_id).toBe("workflow.run.rerun.all")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "cannot rerun")

      const result = await handleWorkflowRunRerunAll(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error for invalid runId", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowRunRerunAll(
        runner,
        { owner: "owner", name: "repo", runId: "not-a-number" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowRunCancel", () => {
    it("returns success with status cancel_requested", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowRunCancel(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 123456,
        status: "cancel_requested",
      })
      expect(result.meta.capability_id).toBe("workflow.run.cancel")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run already completed")

      const result = await handleWorkflowRunCancel(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowRunArtifactsList", () => {
    it("returns success with artifacts array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          artifacts: [
            {
              id: "A_1",
              name: "build-output",
              sizeInBytes: 5242880,
              archiveDownloadUrl: "https://github.com/owner/repo/suites/123/artifacts/A_1/download",
            },
            {
              id: "A_2",
              name: "test-reports",
              sizeInBytes: 1048576,
              archiveDownloadUrl: "https://github.com/owner/repo/suites/123/artifacts/A_2/download",
            },
          ],
        }),
      )

      const result = await handleWorkflowRunArtifactsList(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "build-output", sizeInBytes: 5242880 },
          { name: "test-reports", sizeInBytes: 1048576 },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("workflow.run.artifacts.list")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run not found")

      const result = await handleWorkflowRunArtifactsList(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowDispatchRun", () => {
    it("returns success with dispatched flag", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowDispatchRun(
        runner,
        {
          owner: "owner",
          name: "repo",
          workflowId: "ci.yml",
          ref: "main",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        workflowId: "ci.yml",
        ref: "main",
        dispatched: true,
      })
      expect(result.meta.capability_id).toBe("workflow.dispatch")
    })

    it("includes inputs in api call", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowDispatchRun(
        runner,
        {
          owner: "owner",
          name: "repo",
          workflowId: "deploy.yml",
          ref: "main",
          inputs: {
            environment: "production",
            version: "1.0.0",
            dryRun: true,
          },
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "api",
          expect.stringContaining("repos/owner/repo/actions/workflows/deploy.yml/dispatches"),
          "--method",
          "POST",
          "-f",
          "ref=main",
          "-f",
          "inputs[environment]=production",
          "-f",
          "inputs[version]=1.0.0",
          "-f",
          "inputs[dryRun]=true",
        ]),
        expect.any(Number),
      )
    })

    it("returns error when owner/name missing", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowDispatchRun(
        runner,
        { workflowId: "ci.yml", ref: "main" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })

    it("returns error when ref missing", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowDispatchRun(
        runner,
        { owner: "owner", name: "repo", workflowId: "ci.yml" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "workflow not found")

      const result = await handleWorkflowDispatchRun(
        runner,
        { owner: "owner", name: "repo", workflowId: "ci.yml", ref: "main" },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowRunRerunFailed", () => {
    it("returns success with rerunFailed flag", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowRunRerunFailed(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        runId: 123456,
        queued: true,
      })
      expect(result.meta.capability_id).toBe("workflow.run.rerun.failed")
    })

    it("uses api call with repos path", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowRunRerunFailed(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining([
          "api",
          "repos/owner/repo/actions/runs/123456/rerun-failed-jobs",
          "--method",
          "POST",
        ]),
        expect.any(Number),
      )
    })

    it("returns error when owner/name missing", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowRunRerunFailed(runner, { runId: 123456 }, undefined)

      expect(result.ok).toBe(false)
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "run not found")

      const result = await handleWorkflowRunRerunFailed(
        runner,
        { owner: "owner", name: "repo", runId: 123456 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleWorkflowRunsList – additional coverage", () => {
    it("includes optional event filter", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30, event: "push" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--event", "push"]),
        expect.any(Number),
      )
    })

    it("includes optional status filter", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30, status: "completed" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["--status", "completed"]),
        expect.any(Number),
      )
    })

    it("handles non-object run item gracefully", async () => {
      const runner = mockRunner(0, JSON.stringify([null, "bad", 42]))

      const result = await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const items = (result.data as { items: unknown[] }).items
      expect(items).toHaveLength(3)
      expect(items[0]).toMatchObject({ id: 0, workflowName: null })
    })

    it("returns error on SyntaxError from malformed JSON", async () => {
      const runner = mockRunner(0, "not-json")

      const result = await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error when first is invalid", async () => {
      const runner = mockRunner(0, "[]")

      const result = await handleWorkflowRunsList(
        runner,
        { owner: "owner", name: "repo", first: 0 },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowList – additional coverage", () => {
    it("returns error on SyntaxError from malformed JSON", async () => {
      const runner = mockRunner(0, "not-json")

      const result = await handleWorkflowList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error when first is invalid", async () => {
      const runner = mockRunner(0, "[]")

      const result = await handleWorkflowList(
        runner,
        { owner: "owner", name: "repo", first: 0 },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowGet – additional coverage", () => {
    it("accepts numeric workflowId", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          id: 99,
          name: "CI",
          path: ".github/workflows/ci.yml",
          state: "active",
          url: "https://github.com",
        }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: 99 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(runSpy).toHaveBeenCalledWith("gh", expect.arrayContaining(["99"]), expect.any(Number))
    })

    it("returns error on SyntaxError from malformed JSON", async () => {
      const runner = mockRunner(0, "not-json")

      const result = await handleWorkflowGet(
        runner,
        { owner: "owner", name: "repo", workflowId: "ci.yml" },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("handleWorkflowRunView – additional coverage", () => {
    it("handles non-object job item gracefully", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          databaseId: 1,
          workflowName: "CI",
          status: "completed",
          conclusion: "success",
          headBranch: "main",
          headSha: "abc",
          event: "push",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          startedAt: "2024-01-01",
          url: "https://github.com",
          jobs: [null, "bad"],
        }),
      )

      const result = await handleWorkflowRunView(
        runner,
        { owner: "owner", name: "repo", runId: 1 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const jobs = (result.data as { jobs: unknown[] }).jobs
      expect(jobs).toHaveLength(2)
      expect(jobs[0]).toMatchObject({ id: 0, name: null })
    })

    it("returns error on SyntaxError from malformed JSON", async () => {
      const runner = mockRunner(0, "not-json")

      const result = await handleWorkflowRunView(
        runner,
        { owner: "owner", name: "repo", runId: 1 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("handleWorkflowRunArtifactsList – additional coverage", () => {
    it("handles non-object artifact item gracefully", async () => {
      const runner = mockRunner(0, JSON.stringify({ artifacts: [null, "bad"] }))

      const result = await handleWorkflowRunArtifactsList(
        runner,
        { owner: "owner", name: "repo", runId: 1 },
        undefined,
      )

      expect(result.ok).toBe(true)
      const items = (result.data as { items: unknown[] }).items
      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({ id: null, name: null })
    })

    it("returns error on SyntaxError from malformed JSON", async () => {
      const runner = mockRunner(0, "not-json")

      const result = await handleWorkflowRunArtifactsList(
        runner,
        { owner: "owner", name: "repo", runId: 1 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error when runId is missing", async () => {
      const runner = mockRunner(0, "{}")

      const result = await handleWorkflowRunArtifactsList(
        runner,
        { owner: "owner", name: "repo" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleWorkflowJobLogsGet – additional coverage", () => {
    it("returns error when jobId is missing", async () => {
      const result = await handleWorkflowJobLogsGet(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", jobId: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("jobId")
    })
  })

  describe("handleWorkflowList – missing owner coverage", () => {
    it("returns error when owner is missing", async () => {
      const result = await handleWorkflowList(
        mockRunner(0, "[]"),
        { owner: "", name: "repo", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Missing owner/name")
    })
  })

  describe("handleWorkflowRunCancel – additional coverage", () => {
    it("returns error when runId is missing", async () => {
      const result = await handleWorkflowRunCancel(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", runId: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("runId")
    })
  })

  describe("handleWorkflowDispatchRun – additional coverage", () => {
    it("returns error when inputs is a non-object value", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowDispatchRun(
        runner,
        { owner: "owner", name: "repo", workflowId: "ci.yml", ref: "main", inputs: "bad" },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("inputs")
    })

    it("returns error when inputs contains invalid value type", async () => {
      const runner = mockRunner(0, "")

      const result = await handleWorkflowDispatchRun(
        runner,
        {
          owner: "owner",
          name: "repo",
          workflowId: "ci.yml",
          ref: "main",
          inputs: { key: { nested: "object" } },
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("inputs")
    })
  })
})

describe("workflow domain handlers – null owner/name ?? branch coverage", () => {
  const nr = () => mockRunner(1, "", "err")

  it("handleWorkflowRunsList covers owner/name null branches", async () => {
    const result = await handleWorkflowRunsList(
      nr(),
      { owner: null, name: null, first: 30 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowJobLogsRaw covers owner/name null branches", async () => {
    const result = await handleWorkflowJobLogsRaw(
      nr(),
      { owner: null, name: null, jobId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowJobLogsGet covers owner/name null branches", async () => {
    const result = await handleWorkflowJobLogsGet(
      nr(),
      { owner: null, name: null, jobId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowList covers owner/name null branches", async () => {
    const result = await handleWorkflowList(nr(), { owner: null, name: null, first: 30 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowGet covers owner/name null branches", async () => {
    const result = await handleWorkflowGet(
      nr(),
      { owner: null, name: null, workflowId: "ci.yml" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowRunView covers owner/name null branches", async () => {
    const result = await handleWorkflowRunView(
      nr(),
      { owner: null, name: null, runId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowRunRerunAll covers owner/name null branches", async () => {
    const result = await handleWorkflowRunRerunAll(
      nr(),
      { owner: null, name: null, runId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowRunCancel covers owner/name null branches", async () => {
    const result = await handleWorkflowRunCancel(
      nr(),
      { owner: null, name: null, runId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowRunArtifactsList covers owner/name null branches", async () => {
    const result = await handleWorkflowRunArtifactsList(
      nr(),
      { owner: null, name: null, runId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowDispatchRun covers owner/name null branches", async () => {
    const result = await handleWorkflowDispatchRun(
      nr(),
      { owner: null, name: null, workflowId: "ci.yml" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleWorkflowRunRerunFailed covers owner/name null branches", async () => {
    const result = await handleWorkflowRunRerunFailed(
      nr(),
      { owner: null, name: null, runId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })
})
