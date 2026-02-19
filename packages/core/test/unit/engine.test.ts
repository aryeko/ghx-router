import { beforeEach, describe, expect, it, vi } from "vitest"

import type { OperationCard } from "../../src/core/registry/types.js"

const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

vi.mock("../../src/core/execute/execute.js", () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

vi.mock("../../src/core/registry/index.js", () => ({
  getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
}))

const baseCard: OperationCard = {
  capability_id: "repo.view",
  version: "1.0.0",
  description: "Fetch repository",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  routing: {
    preferred: "graphql",
    fallbacks: ["cli"],
  },
}

const compositeCard: OperationCard = {
  capability_id: "pr.threads.composite",
  version: "1.0.0",
  description: "Composite review thread operations",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  routing: {
    preferred: "graphql",
    fallbacks: [],
  },
  composite: {
    steps: [
      {
        capability_id: "pr.thread.reply",
        foreach: "threads",
        params_map: { threadId: "threadId", body: "body" },
      },
    ],
    output_strategy: "array",
  },
}

describe("executeTask engine wiring", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("exposes REST fallback envelope via execute route callbacks", async () => {
    executeMock.mockImplementation(
      async (options: {
        routes: { rest: (params: Record<string, unknown>) => Promise<unknown> }
      }) => {
        return options.routes.rest({})
      },
    )

    const { executeTask } = await import("../../src/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: {
          fetchRepoView: vi.fn(),
          fetchIssueCommentsList: vi.fn(),
          fetchIssueList: vi.fn(),
          fetchIssueView: vi.fn(),
          fetchPrList: vi.fn(),
          fetchPrView: vi.fn(),
          fetchPrCommentsList: vi.fn(),
          fetchPrReviewsList: vi.fn(),
          fetchPrDiffListFiles: vi.fn(),
          fetchPrMergeStatus: vi.fn(),
          replyToReviewThread: vi.fn(),
          resolveReviewThread: vi.fn(),
          unresolveReviewThread: vi.fn(),
          submitPrReview: vi.fn(),
        },
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        card: baseCard,
        params: { owner: "acme", name: "modkit" },
        preflight: expect.any(Function),
        routes: expect.objectContaining({
          graphql: expect.any(Function),
          cli: expect.any(Function),
          rest: expect.any(Function),
        }),
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(result.meta.route_used).toBe("rest")
    expect(result.meta.reason).toBe("DEFAULT_POLICY")
  })

  it("skips cli preflight probes when skipGhPreflight is true", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
      })),
    }

    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("../../src/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: {
          fetchRepoView: vi.fn(),
          fetchIssueCommentsList: vi.fn(),
          fetchIssueList: vi.fn(),
          fetchIssueView: vi.fn(),
          fetchPrList: vi.fn(),
          fetchPrView: vi.fn(),
          fetchPrCommentsList: vi.fn(),
          fetchPrReviewsList: vi.fn(),
          fetchPrDiffListFiles: vi.fn(),
          fetchPrMergeStatus: vi.fn(),
          replyToReviewThread: vi.fn(),
          resolveReviewThread: vi.fn(),
          unresolveReviewThread: vi.fn(),
          submitPrReview: vi.fn(),
        },
        cliRunner,
        skipGhPreflight: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it("uses execute() pipeline for composite cards", async () => {
    getOperationCardMock.mockReturnValue(compositeCard)
    executeMock.mockResolvedValue({ ok: true })

    const { executeTask } = await import("../../src/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: {
          fetchRepoView: vi.fn(),
          fetchIssueCommentsList: vi.fn(),
          fetchIssueList: vi.fn(),
          fetchIssueView: vi.fn(),
          fetchPrList: vi.fn(),
          fetchPrView: vi.fn(),
          fetchPrCommentsList: vi.fn(),
          fetchPrReviewsList: vi.fn(),
          fetchPrDiffListFiles: vi.fn(),
          fetchPrMergeStatus: vi.fn(),
          replyToReviewThread: vi.fn(),
          resolveReviewThread: vi.fn(),
          unresolveReviewThread: vi.fn(),
          submitPrReview: vi.fn(),
          query: vi.fn(),
        },
        skipGhPreflight: true,
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })
})
