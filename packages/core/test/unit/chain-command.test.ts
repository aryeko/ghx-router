import { describe, expect, it, vi } from "vitest"

const executeTasksMock = vi.fn()

vi.mock("@core/core/routing/engine.js", () => ({
  executeTasks: (...args: unknown[]) => executeTasksMock(...args),
}))

vi.mock("@core/gql/github-client.js", () => ({
  createGithubClient: (transport: unknown) => transport,
}))

describe("chainCommand parsing", () => {
  it("parseChainFlags extracts inline --steps", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(["--steps", '[{"task":"issue.close","input":{"issueId":"I_1"}}]'])
    expect(flags.stepsSource).toEqual({
      raw: '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    })
    expect(flags.skipGhPreflight).toBe(true)
  })

  it("parseChainFlags detects --steps - for stdin", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(["--steps", "-"])
    expect(flags.stepsSource).toBe("stdin")
    expect(flags.skipGhPreflight).toBe(true)
  })

  it("parseChainFlags respects --check-gh-preflight", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
      "--check-gh-preflight",
    ])
    expect(flags.skipGhPreflight).toBe(false)
  })

  it("chainCommand returns 0 on success status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "success",
      results: [{ task: "issue.close", ok: true }],
      meta: { route_used: "graphql", total: 1, succeeded: 1, failed: 0 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    ])

    expect(exitCode).toBe(0)
  })

  it("chainCommand returns 0 on partial status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "partial",
      results: [
        { task: "issue.close", ok: true },
        {
          task: "issue.close",
          ok: false,
          error: { code: "UNKNOWN", message: "failed", retryable: false },
        },
      ],
      meta: { route_used: "graphql", total: 2, succeeded: 1, failed: 1 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}},{"task":"issue.close","input":{"issueId":"I_2"}}]',
    ])

    expect(exitCode).toBe(0)
  })

  it("chainCommand returns 1 on failed status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "failed",
      results: [
        {
          task: "issue.close",
          ok: false,
          error: { code: "VALIDATION", message: "invalid", retryable: false },
        },
      ],
      meta: { route_used: "graphql", total: 1, succeeded: 0, failed: 1 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    ])

    expect(exitCode).toBe(1)
  })

  it("chainCommand returns 1 and writes to stderr when GITHUB_TOKEN missing", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", undefined)
    vi.stubEnv("GH_TOKEN", undefined)

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    ])
    expect(exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("GITHUB_TOKEN"))
    stderrSpy.mockRestore()
  })

  it("chainCommand returns 1 and writes to stderr when --steps JSON is invalid", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "tok")

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitCode = await chainCommand(["--steps", "not-valid-json"])
    expect(exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid JSON"))
    stderrSpy.mockRestore()
  })
})

describe("chainCommand — executeGraphqlRequest fetch behaviour", () => {
  it("passes AbortSignal to fetch", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine.js", () => ({
      executeTasks: vi
        .fn()
        .mockImplementation(
          async (
            _steps: unknown,
            opts: { githubClient: { execute: (q: string) => Promise<unknown> } },
          ) => {
            await opts.githubClient.execute("query {}")
            return {
              status: "success",
              results: [],
              meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
            }
          },
        ),
    }))
    vi.doMock("@core/gql/github-client.js", () => ({
      createGithubClient: (transport: unknown) => transport,
    }))

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: {} }),
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("GITHUB_TOKEN", "tok")

    const { chainCommand } = await import("@core/cli/commands/chain.js")
    await chainCommand(["--steps", '[{"task":"issue.close","input":{"issueId":"I1"}}]'])

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    vi.unstubAllGlobals()
  })

  it("returns exit code 1 with message when response.json() throws (non-JSON body)", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine.js", () => ({
      executeTasks: vi
        .fn()
        .mockImplementation(
          async (
            _steps: unknown,
            opts: { githubClient: { execute: (q: string) => Promise<unknown> } },
          ) => {
            await opts.githubClient.execute("query {}")
            return {
              status: "success",
              results: [],
              meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
            }
          },
        ),
    }))
    vi.doMock("@core/gql/github-client.js", () => ({
      createGithubClient: (transport: unknown) => transport,
    }))

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token < in JSON")),
      }),
    )
    vi.stubEnv("GITHUB_TOKEN", "tok")

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const { chainCommand } = await import("@core/cli/commands/chain.js")
    const code = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I1"}}]',
    ])
    expect(code).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("non-JSON"))
    stderrSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
