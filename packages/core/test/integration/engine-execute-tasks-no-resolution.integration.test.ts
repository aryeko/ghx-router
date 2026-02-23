/**
 * Integration tests for executeTasks with no-resolution mutations.
 *
 * Note: executeTasks with a single request delegates to executeTask (uses typed client
 * methods). These tests use ≥2 requests to exercise the Phase 2 batch mutation path
 * where queryRaw is called directly.
 *
 * Uses issue.relations.blocked_by.add and issue.relations.blocked_by.remove which
 * accept raw node IDs and have no resolution block, exercising pure Phase 2 batching.
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
            addBlockedBy: {
              issue: { id: "I_abc123" },
              blockingIssue: { id: "I_blocker" },
            },
          },
          step1: {
            removeBlockedBy: {
              issue: { id: "I_abc123" },
              blockingIssue: { id: "I_blocker" },
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
        {
          task: "issue.relations.blocked_by.add",
          input: { issueId: "I_abc123", blockedByIssueId: "I_blocker" },
        },
        {
          task: "issue.relations.blocked_by.remove",
          input: { issueId: "I_abc123", blockedByIssueId: "I_blocker" },
        },
      ],
      { githubClient, githubToken: "test-token" },
    )

    expect(result.status).toBe("success")
    expect(result.meta.total).toBe(2)
    expect(result.meta.succeeded).toBe(2)
    expect(result.meta.failed).toBe(0)
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({
      task: "issue.relations.blocked_by.add",
      ok: true,
    })
    expect(result.results[1]).toMatchObject({
      task: "issue.relations.blocked_by.remove",
      ok: true,
    })

    const calledDoc = String(queryRawFn.mock.calls[0]?.[0])
    expect(calledDoc).toContain("addBlockedBy")
    expect(calledDoc).toContain("removeBlockedBy")
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
        {
          task: "issue.relations.blocked_by.add",
          input: { issueId: "I_abc123", blockedByIssueId: "I_blocker" },
        },
        {
          task: "issue.relations.blocked_by.remove",
          input: { issueId: "I_abc123", blockedByIssueId: "I_blocker" },
        },
      ],
      { githubClient, githubToken: "test-token" },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})
