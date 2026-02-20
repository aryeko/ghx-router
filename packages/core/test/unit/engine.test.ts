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
})
