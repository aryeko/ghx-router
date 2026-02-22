/**
 * Integration tests for executeTasks with no-resolution mutations.
 *
 * Note: executeTasks with a single request delegates to executeTask (uses typed client
 * methods). These tests use ≥2 requests to exercise the Phase 2 batch mutation path
 * where queryRaw is called directly.
 */
import { executeTasks } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("executeTasks – no-resolution mutations (batch Phase 2 path)", () => {
  it("succeeds for two no-resolution steps batched in a single mutation", async () => {
    const queryRawFn = vi.fn(async <TData>(_doc: unknown) => {
      return {
        data: {
          step0: {
            closeIssue: { issue: { id: "I_abc123", number: 10, state: "CLOSED" } },
          },
          step1: {
            addComment: {
              commentEdge: {
                node: {
                  id: "IC_comment1",
                  body: "Closing comment.",
                  url: "https://github.com/o/r/issues/10#issuecomment-1",
                },
              },
            },
          },
        } as TData,
        errors: undefined,
      }
    })

    const githubClient = {
      query: async () => {
        throw new Error("Phase 1 query not expected: neither step has resolution config")
      },
      queryRaw: queryRawFn,
    } as unknown as GithubClient

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I_abc123" } },
        { task: "issue.comments.create", input: { issueId: "I_abc123", body: "Closing comment." } },
      ],
      { githubClient, githubToken: "test-token" },
    )

    expect(result.status).toBe("success")
    expect(result.meta.total).toBe(2)
    expect(result.meta.succeeded).toBe(2)
    expect(result.meta.failed).toBe(0)
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({
      task: "issue.close",
      ok: true,
      data: { closeIssue: { issue: { state: "CLOSED" } } },
    })
    expect(result.results[1]).toMatchObject({
      task: "issue.comments.create",
      ok: true,
    })

    const calledDoc = String(queryRawFn.mock.calls[0]?.[0])
    expect(calledDoc).toContain("closeIssue")
    expect(calledDoc).toContain("addComment")
    expect(queryRawFn).toHaveBeenCalledOnce()
  })

  it("returns failed status when queryRaw throws a transport error for all steps", async () => {
    const githubClient = {
      query: async () => {
        throw new Error("Phase 1 query not expected")
      },
      queryRaw: async () => {
        throw new Error("network failure")
      },
    } as unknown as GithubClient

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I_abc123" } },
        { task: "issue.comments.create", input: { issueId: "I_abc123", body: "Closing comment." } },
      ],
      { githubClient, githubToken: "test-token" },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})
