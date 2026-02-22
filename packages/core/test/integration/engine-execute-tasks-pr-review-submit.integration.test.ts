/**
 * Integration tests for executeTasks with pr.reviews.submit.
 *
 * Validates the Phase 1 → Phase 2 resolution path for pr.reviews.submit:
 *   Phase 1: PrNodeId lookup → extracts repository.pullRequest.id
 *   Inject:  pullRequestId ← scalar from repository.pullRequest.id
 *   Phase 2: PrReviewSubmit mutation with injected pullRequestId
 *
 * Note: executeTasks with a single request delegates to executeTask (typed client
 * methods, no batch resolution). Tests use ≥2 requests to exercise the batch path.
 */
import { executeTasks } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("executeTasks – pr.reviews.submit resolution (Phase 1 → Phase 2)", () => {
  it("resolves pullRequestId from PrNodeId lookup and injects into PrReviewSubmit mutation", async () => {
    // Phase 1: batch query returning PrNodeId lookup result aliased as step0
    const queryFn = vi.fn(async <TData>(_doc: unknown, _vars: unknown) => {
      return {
        step0: { repository: { pullRequest: { id: "PR_xyz789" } } },
      } as TData
    })

    // Phase 2: capture variables to verify pullRequestId was resolved and injected
    const queryRawFn = vi.fn(async <TData>(_doc: unknown, _vars: unknown) => {
      return {
        data: {
          step0: {
            addPullRequestReview: {
              pullRequestReview: {
                id: "review-id-1",
                state: "COMMENTED",
                url: "https://github.com/o/r/pull/5#pullrequestreview-1",
                body: "Reviewed atomically.",
              },
            },
          },
          step1: {
            closeIssue: { issue: { id: "I_abc", number: 10, state: "CLOSED" } },
          },
        } as TData,
        errors: undefined,
      }
    })

    const githubClient = {
      query: queryFn,
      queryRaw: queryRawFn,
    } as unknown as GithubClient

    const result = await executeTasks(
      [
        {
          task: "pr.reviews.submit",
          input: {
            owner: "octocat",
            name: "hello-world",
            prNumber: 5,
            event: "COMMENT",
            body: "Reviewed atomically.",
          },
        },
        // Second step forces the batch path (≥2 requests)
        { task: "issue.close", input: { issueId: "I_abc" } },
      ],
      { githubClient, githubToken: "test-token" },
    )

    // Overall result
    expect(result.status).toBe("success")
    expect(result.meta.total).toBe(2)
    expect(result.meta.succeeded).toBe(2)
    expect(result.meta.failed).toBe(0)
    expect(result.results).toHaveLength(2)

    // PR review step
    expect(result.results[0]).toMatchObject({
      task: "pr.reviews.submit",
      ok: true,
      data: {
        addPullRequestReview: {
          pullRequestReview: { state: "COMMENTED" },
        },
      },
    })

    // Issue close step
    expect(result.results[1]).toMatchObject({
      task: "issue.close",
      ok: true,
    })

    // Phase 1 ran exactly once (only pr.reviews.submit has a resolution lookup)
    expect(queryFn).toHaveBeenCalledOnce()

    // Phase 2 ran exactly once (batch mutation for both steps)
    expect(queryRawFn).toHaveBeenCalledOnce()

    // Verify the resolved pullRequestId was injected into the batch mutation variables.
    // buildBatchMutation prefixes each step's variables with its alias (step0_*, step1_*, ...)
    const mutVars = queryRawFn.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutVars).toBeDefined()
    expect(mutVars?.["step0_pullRequestId"]).toBe("PR_xyz789")
  })

  it("returns partial status when PrNodeId lookup returns null pullRequest (bad inject path)", async () => {
    // Phase 1: returns null pullRequest → applyInject throws for pullRequestId
    const queryFn = vi.fn(async <TData>() => {
      return {
        step0: { repository: { pullRequest: null } },
      } as TData
    })

    // Phase 2: only step1 (issue.close) reaches the batch; step0 failed in Phase 2 prep
    const queryRawFn = vi.fn(async <TData>() => {
      return {
        data: {
          step1: {
            closeIssue: { issue: { id: "I_abc", number: 10, state: "CLOSED" } },
          },
        } as TData,
        errors: undefined,
      }
    })

    const githubClient = {
      query: queryFn,
      queryRaw: queryRawFn,
    } as unknown as GithubClient

    const result = await executeTasks(
      [
        {
          task: "pr.reviews.submit",
          input: {
            owner: "octocat",
            name: "hello-world",
            prNumber: 5,
            event: "COMMENT",
            body: "Test.",
          },
        },
        { task: "issue.close", input: { issueId: "I_abc" } },
      ],
      { githubClient, githubToken: "test-token" },
    )

    // step0 (pr.reviews.submit) fails due to resolution error; step1 (issue.close) succeeds
    expect(result.status).toBe("partial")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]).toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: expect.stringContaining("pullRequestId") }),
    })
    expect(result.results[1]?.ok).toBe(true)
  })
})
