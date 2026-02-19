import type { OperationCard } from "@core/core/registry/types.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

vi.mock("@core/core/execute/execute.js", () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

vi.mock("@core/core/registry/index.js", () => ({
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
        actions: ["reply"],
        params_map: { threadId: "threadId", body: "body" },
      },
    ],
    output_strategy: "array",
  },
}

function createGithubClient(overrides?: Partial<GithubClient>): GithubClient {
  return {
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
    ...overrides,
  } as unknown as GithubClient
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

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
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

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
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

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient(),
        skipGhPreflight: true,
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })

  it("detects missing CLI and returns cli preflight failure", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
      })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(cliRunner.run).toHaveBeenCalledWith("gh", ["--version"], 1_500)
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "ADAPTER_UNSUPPORTED",
      }),
    )
  })

  it("handles CLI detection runner errors as unavailable", async () => {
    const cliRunner = {
      run: vi.fn(async () => {
        throw new Error("spawn failed")
      }),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "ADAPTER_UNSUPPORTED",
      }),
    )
  })

  it("aggregates composite graphql result using merge strategy", async () => {
    getOperationCardMock.mockReturnValue({
      ...compositeCard,
      composite: {
        ...compositeCard.composite,
        output_strategy: "merge",
      },
    })

    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient({
          query: vi.fn().mockResolvedValue({
            pr_thread_reply_0: { comment: { id: "c1" } },
          }),
        }),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: "c1" })
  })

  it("aggregates composite graphql result using last strategy", async () => {
    getOperationCardMock.mockReturnValue({
      ...compositeCard,
      composite: {
        ...compositeCard.composite,
        output_strategy: "last",
      },
    })

    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient({
          query: vi.fn().mockResolvedValue({
            pr_thread_reply_0: { comment: { id: "c1" } },
          }),
        }),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: "c1" })
  })

  it("normalizes composite graphql mapping failures", async () => {
    getOperationCardMock.mockReturnValue(compositeCard)

    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient({
          query: vi.fn().mockResolvedValue({
            pr_thread_reply_0: {},
          }),
        }),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("Review thread mutation failed")
    expect(result.meta.route_used).toBe("graphql")
  })

  it("returns explicit validation error when an operation alias is missing from batch response", async () => {
    getOperationCardMock.mockReturnValue(compositeCard)

    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient({
          query: vi.fn().mockResolvedValue({}),
        }),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('Missing result for alias "pr_thread_reply_0"')
  })

  it("returns validation error when composite receives unknown action", async () => {
    getOperationCardMock.mockReturnValue(compositeCard)
    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "invalid_action", body: "x" }] },
      },
      {
        githubClient: createGithubClient({
          query: vi.fn(),
        }),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('Invalid action "invalid_action"')
  })

  it("handles cached CLI probe post-processing errors by clearing in-flight entry", async () => {
    const cliRunner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: "gh version 1", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" }),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockImplementationOnce(() => {
      throw new Error("clock unavailable")
    })
    nowSpy.mockImplementation(() => 0)

    const { executeTask } = await import("@core/core/routing/engine.js")

    await expect(
      executeTask(
        {
          task: "repo.view",
          input: { owner: "acme", name: "modkit" },
        },
        {
          githubClient: createGithubClient(),
          cliRunner,
        },
      ),
    ).rejects.toThrow("clock unavailable")

    await expect(
      executeTask(
        {
          task: "repo.view",
          input: { owner: "acme", name: "modkit" },
        },
        {
          githubClient: createGithubClient(),
          cliRunner,
        },
      ),
    ).resolves.toEqual({ ok: true })

    nowSpy.mockRestore()
  })

  it("defensively handles cards that lose composite config after routing check", async () => {
    const proxyCard = {
      ...compositeCard,
      get composite() {
        this.__reads = (this.__reads ?? 0) + 1
        return this.__reads === 1 ? compositeCard.composite : undefined
      },
      __reads: 0,
    } as OperationCard & { __reads: number }
    getOperationCardMock.mockReturnValue(proxyCard)

    executeMock.mockImplementation(
      async (options: { routes: { graphql: () => Promise<unknown> } }) => options.routes.graphql(),
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "pr.threads.composite",
        input: { threads: [{ threadId: "T", action: "reply", body: "x" }] },
      },
      {
        githubClient: createGithubClient(),
        githubToken: "token",
        skipGhPreflight: true,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("Card does not have composite config")
  })
})
