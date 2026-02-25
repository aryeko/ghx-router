import { describe, expect, it, vi } from "vitest"

const executeTasksMock = vi.fn()

vi.mock("@core/core/routing/engine/index.js", () => ({
  executeTasks: (...args: unknown[]) => executeTasksMock(...args),
}))

vi.mock("@core/gql/github-client.js", () => ({
  createGithubClient: (transport: unknown) => transport,
}))

describe("chainCommand parsing", () => {
  it("returns 1 with usage when called with no arguments", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const exitCode = await chainCommand([])
    expect(exitCode).toBe(1)
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"))
    stdoutSpy.mockRestore()
  })

  it("returns 1 with usage when called without args (default)", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const exitCode = await chainCommand()
    expect(exitCode).toBe(1)
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"))
    stdoutSpy.mockRestore()
  })

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

  it("chainCommand returns 1 when --steps is not an array", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "tok")

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitCode = await chainCommand(["--steps", '{"task":"foo"}'])
    expect(exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("must be a JSON array"))
    stderrSpy.mockRestore()
  })

  it("chainCommand returns 1 when step items have invalid shape", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "tok")

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const exitCode = await chainCommand(["--steps", '[{"bad":"shape"}]'])
    expect(exitCode).toBe(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("task"))
    stderrSpy.mockRestore()
  })

  it("parseChainFlags handles --steps= inline format", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(['--steps=[{"task":"a","input":{}}]'])
    expect(flags.stepsSource).toEqual({ raw: '[{"task":"a","input":{}}]' })
  })

  it("parseChainFlags throws when --steps is missing", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    expect(() => parseChainFlags(["--other-flag"])).toThrow("Missing --steps JSON")
  })

  it("parseChainFlags sets verbose true when --verbose is present", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
      "--verbose",
    ])
    expect(flags.verbose).toBe(true)
  })

  it("parseChainFlags sets verbose false when --verbose is absent", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(["--steps", '[{"task":"issue.close","input":{"issueId":"I_1"}}]'])
    expect(flags.verbose).toBe(false)
  })

  it("chainCommand default output is compact — no meta key", async () => {
    executeTasksMock.mockResolvedValue({
      status: "success",
      results: [
        { task: "issue.labels.remove", ok: true, data: { labelable: { id: "I_1" } } },
        {
          task: "issue.comments.create",
          ok: true,
          data: { commentEdge: { node: { url: "https://github.com/c/1" } } },
        },
      ],
      meta: { route_used: "graphql", total: 2, succeeded: 2, failed: 0 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    let captured = ""
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured += chunk
      return true
    })

    await chainCommand([
      "--steps",
      '[{"task":"issue.labels.remove","input":{"issueId":"I_1","labelId":"L_1"}},{"task":"issue.comments.create","input":{"issueId":"I_1","body":"done"}}]',
    ])

    stdoutSpy.mockRestore()

    const parsed = JSON.parse(captured)
    expect(parsed).not.toHaveProperty("meta")
  })

  it("chainCommand with --verbose outputs full envelope with meta key", async () => {
    executeTasksMock.mockResolvedValue({
      status: "success",
      results: [
        { task: "issue.labels.remove", ok: true, data: { labelable: { id: "I_1" } } },
        {
          task: "issue.comments.create",
          ok: true,
          data: { commentEdge: { node: { url: "https://github.com/c/1" } } },
        },
      ],
      meta: { route_used: "graphql", total: 2, succeeded: 2, failed: 0 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    let captured = ""
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured += chunk
      return true
    })

    await chainCommand([
      "--steps",
      '[{"task":"issue.labels.remove","input":{"issueId":"I_1","labelId":"L_1"}},{"task":"issue.comments.create","input":{"issueId":"I_1","body":"done"}}]',
      "--verbose",
    ])

    stdoutSpy.mockRestore()

    const parsed = JSON.parse(captured)
    expect(parsed).toHaveProperty("meta")
  })

  it("chainCommand compact ok steps have shape { task, ok: true } — no data", async () => {
    executeTasksMock.mockResolvedValue({
      status: "success",
      results: [{ task: "issue.labels.remove", ok: true, data: { labelable: { id: "I_1" } } }],
      meta: { route_used: "graphql", total: 1, succeeded: 1, failed: 0 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    let captured = ""
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured += chunk
      return true
    })

    await chainCommand([
      "--steps",
      '[{"task":"issue.labels.remove","input":{"issueId":"I_1","labelId":"L_1"}}]',
    ])

    stdoutSpy.mockRestore()

    const parsed = JSON.parse(captured)
    expect(parsed.results[0]).toEqual({ task: "issue.labels.remove", ok: true })
    expect(parsed.results[0]).not.toHaveProperty("data")
  })

  it("chainCommand compact failed steps have shape { task, ok: false, error: { code, message } } — no retryable", async () => {
    executeTasksMock.mockResolvedValue({
      status: "failed",
      results: [
        {
          task: "issue.close",
          ok: false,
          error: { code: "VALIDATION", message: "invalid input", retryable: false, details: "x" },
        },
      ],
      meta: { route_used: "graphql", total: 1, succeeded: 0, failed: 1 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    let captured = ""
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      captured += chunk
      return true
    })

    await chainCommand(["--steps", '[{"task":"issue.close","input":{"issueId":"I_1"}}]'])

    stdoutSpy.mockRestore()

    const parsed = JSON.parse(captured)
    expect(parsed.results[0]).toEqual({
      task: "issue.close",
      ok: false,
      error: { code: "VALIDATION", message: "invalid input" },
    })
    expect(parsed.results[0].error).not.toHaveProperty("retryable")
    expect(parsed.results[0].error).not.toHaveProperty("details")
  })
})

describe("chainCommand — executeRawGraphqlRequest path", () => {
  it("provides executeRaw transport that returns settled results", async () => {
    vi.resetModules()

    let capturedTransport: { executeRaw?: (q: string) => Promise<unknown> } | undefined
    vi.doMock("@core/core/routing/engine/index.js", () => ({
      executeTasks: vi
        .fn()
        .mockImplementation(
          async (
            _steps: unknown,
            opts: { githubClient: { executeRaw?: (q: string) => Promise<unknown> } },
          ) => {
            capturedTransport = opts.githubClient
            const raw = await opts.githubClient.executeRaw?.("mutation {}")
            return {
              status: "success",
              results: [],
              meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
              _rawForTest: raw,
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
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: { step0: { id: "I_1" } },
          errors: [{ message: "partial", path: ["step1"] }],
        }),
      }),
    )
    vi.stubEnv("GITHUB_TOKEN", "tok")

    const { chainCommand } = await import("@core/cli/commands/chain.js")
    await chainCommand(["--steps", '[{"task":"issue.close","input":{"issueId":"I1"}}]'])

    expect(capturedTransport?.executeRaw).toBeDefined()
    vi.unstubAllGlobals()
  })

  it("handles GH_TOKEN fallback", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine/index.js", () => ({
      executeTasks: vi.fn().mockResolvedValue({
        status: "success",
        results: [],
        meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
      }),
    }))
    vi.doMock("@core/gql/github-client.js", () => ({
      createGithubClient: (transport: unknown) => transport,
    }))

    vi.stubEnv("GITHUB_TOKEN", undefined)
    vi.stubEnv("GH_TOKEN", "gh-token")

    const { chainCommand } = await import("@core/cli/commands/chain.js")
    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I1"}}]',
    ])
    expect(exitCode).toBe(0)
  })

  it("handles HTTP error from fetchGqlPayload when response has JSON message", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine/index.js", () => ({
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
        status: 403,
        json: vi.fn().mockResolvedValue({ message: "API rate limit exceeded" }),
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
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("rate limit"))
    stderrSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("handles GraphQL errors in execute path", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine/index.js", () => ({
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
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ errors: [{ message: "Field 'bad' doesn't exist" }] }),
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
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("doesn't exist"))
    stderrSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it("handles missing data in execute path", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine/index.js", () => ({
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
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
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
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("missing data"))
    stderrSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

describe("chainCommand — executeGraphqlRequest fetch behaviour", () => {
  it("passes AbortSignal to fetch", async () => {
    vi.resetModules()

    vi.doMock("@core/core/routing/engine/index.js", () => ({
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

    vi.doMock("@core/core/routing/engine/index.js", () => ({
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
