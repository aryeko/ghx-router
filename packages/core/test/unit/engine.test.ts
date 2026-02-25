import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

vi.mock("@core/core/execute/execute.js", () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

vi.mock("@core/core/registry/index.js", () => ({
  getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
}))

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

  it("clears in-flight entry via .catch when probe post-processing throws", async () => {
    // runner returns success so detectCliEnvironment resolves normally
    const cliRunner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "gh version 1",
          stderr: "",
        })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
        // second executeTask call needs two more runner responses
        .mockResolvedValueOnce({ exitCode: 0, stdout: "gh version 1", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" }),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const nowSpy = vi.spyOn(Date, "now")
    try {
      // 1st call: startMs = Date.now() in executeTask → ok
      // 2nd call: const now = Date.now() in detectCliEnvironmentCached → ok
      // 3rd call: Date.now() + CLI_ENV_CACHE_TTL_MS inside .then → throws, triggering .catch
      nowSpy
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(0)
        .mockImplementationOnce(() => {
          throw new Error("clock unavailable")
        })
        .mockReturnValue(0)

      const { executeTask } = await import("@core/core/routing/engine.js")

      // First call: .then throws → .catch fires (lines 105-106) → probe rejects → executeTask rejects
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

      // Second call: in-flight was cleared by .catch so a new probe is created → succeeds
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
    } finally {
      nowSpy.mockRestore()
    }
  })
})

describe("executeTasks chaining", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("1-item chain delegates to executeTask path", async () => {
    executeMock.mockResolvedValue({ ok: true, data: { id: "test" } })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({
      task: "repo.view",
      ok: true,
      data: { id: "test" },
    })
  })

  it("pre-flight rejects whole chain if card not found", async () => {
    getOperationCardMock.mockReturnValue(null)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "unknown.task", input: {} },
        { task: "repo.view", input: {} },
      ],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    const firstResult = result.results[0]
    expect(firstResult).toBeDefined()
    expect(firstResult?.ok).toBe(false)
    expect(firstResult?.error?.code).toBe("VALIDATION")
  })

  it("pre-flight rejects whole chain if card has neither graphql nor cli config", async () => {
    const cardWithoutAnyRoute = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: undefined,
    }
    getOperationCardMock.mockReturnValue(cardWithoutAnyRoute)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results.every((r) => !r.ok)).toBe(true)
    expect(result.results[0]?.error?.message).toContain("no supported route")
  })

  it("pre-flight correctly attributes errors when same capability appears twice and only one fails", async () => {
    // step 0: card not found (preflight fails); step 1: valid card
    getOperationCardMock.mockReturnValueOnce(undefined).mockReturnValueOnce({
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    const r0 = result.results[0]
    const r1 = result.results[1]
    // step 0 gets the real "Invalid task" error
    expect(r0?.ok).toBe(false)
    expect(r0?.error?.message).toContain("Invalid task")
    // step 1 should NOT inherit the same error — it gets the generic "pre-flight failed" fallback
    expect(r1?.ok).toBe(false)
    expect(r1?.error?.message).not.toContain("Invalid task")
  })

  it("pre-flight rejects step when resolution lookup var is missing from input", async () => {
    const cardNoResolution = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithResolution)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      // step 1 is missing "name" from input
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { owner: "acme" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    const r1 = result.results[1]
    expect(r1?.ok).toBe(false)
    expect(r1?.error?.message).toMatch(/name/)
  })
})

describe("executeTask — preflight branches", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("forwards githubToken to preflight when provided", async () => {
    executeMock.mockImplementation(
      async (options: { preflight: (route: string) => Promise<unknown> }) => {
        return options.preflight("graphql")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        githubToken: "ghp_test123",
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routingContext: expect.objectContaining({ githubTokenPresent: true }),
      }),
    )
  })

  it("preflight for non-CLI route skips CLI detection entirely", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "ok", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: string) => Promise<unknown> }) => {
        return options.preflight("graphql")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
  })

  it("uses provided ghCliAvailable and ghAuthenticated without probing", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "ok", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<unknown> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
        ghAuthenticated: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
  })

  it("probes when ghCliAvailable is provided but ghAuthenticated is not", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "gh version 1", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
      },
    )

    expect(cliRunner.run).toHaveBeenCalled()
  })

  it("skipGhPreflight fills only missing fields, preserves provided ghCliAvailable", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
        skipGhPreflight: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it("uses custom reason code when provided in deps", async () => {
    getOperationCardMock.mockReturnValue(null)

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "unknown.task", input: {} },
      {
        githubClient: createGithubClient(),
        reason: "CARD_PREFERRED",
      },
    )

    expect(result.ok).toBe(false)
    expect(result.meta.reason).toBe("CARD_PREFERRED")
  })
})

describe("executeTasks — 1-item chain error paths", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("1-item chain returns failed status when executeTask returns ok: false", async () => {
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: { code: "NOT_FOUND", message: "Not found", retryable: false },
      meta: { route_used: "graphql" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.code).toBe("NOT_FOUND")
    expect(result.meta.succeeded).toBe(0)
    expect(result.meta.failed).toBe(1)
  })

  it("1-item chain uses Unknown error when result.error is null", async () => {
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: null,
      meta: { route_used: "cli" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.code).toBe("UNKNOWN")
    expect(result.meta.route_used).toBe("cli")
  })

  it("1-item chain with undefined element returns failed status (dead-code guard)", async () => {
    // This exercises the defensive `if (req === undefined)` guard at lines 246-261
    // which TypeScript needs even though it can never fire with well-typed callers.
    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      // Cast to bypass TypeScript's type check
      [undefined] as unknown as Array<{ task: string; input: Record<string, unknown> }>,
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(0)
    expect(result.meta.total).toBe(0)
    expect(result.meta.succeeded).toBe(0)
    expect(result.meta.failed).toBe(0)
  })
})
