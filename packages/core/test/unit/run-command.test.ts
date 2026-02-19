import { Readable } from "node:stream"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createGithubClientMock = vi.fn()
const executeTaskMock = vi.fn()

vi.mock("@core/gql/github-client.js", () => ({
  createGithubClient: (...args: unknown[]) => createGithubClientMock(...args),
}))

vi.mock("@core/core/routing/engine.js", () => ({
  executeTask: (...args: unknown[]) => executeTaskMock(...args),
}))

import { readStdin, runCommand } from "@core/cli/commands/run.js"

function mockStdin(content: string): void {
  const readable = new Readable({
    read() {
      this.push(Buffer.from(content))
      this.push(null)
    },
  })
  vi.spyOn(process, "stdin", "get").mockReturnValue(readable as unknown as typeof process.stdin)
}

describe("runCommand", () => {
  const originalFetch = globalThis.fetch
  const originalGithubToken = process.env.GITHUB_TOKEN
  const originalGhToken = process.env.GH_TOKEN

  beforeEach(() => {
    vi.clearAllMocks()
    createGithubClientMock.mockImplementation((transport) => ({
      query: (query: string, variables?: unknown) =>
        transport.execute(query, variables as Record<string, unknown>),
    }))
    executeTaskMock.mockResolvedValue({ ok: true })
    process.env.GITHUB_TOKEN = "token-123"
    process.env.GH_TOKEN = undefined
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.GITHUB_TOKEN = originalGithubToken
    process.env.GH_TOKEN = originalGhToken
    vi.restoreAllMocks()
  })

  it("prints usage and exits when no args are passed", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await runCommand([])

    expect(code).toBe(1)
    expect(stdout).toHaveBeenCalledWith(
      "Usage: ghx run <task> --input '<json>' | --input - [--check-gh-preflight]\n",
    )
  })

  it("throws for missing input flag", async () => {
    await expect(runCommand(["repo.view"])).rejects.toThrow("Missing --input JSON")
  })

  it("treats --input followed by another flag as missing input", async () => {
    await expect(runCommand(["repo.view", "--input", "--check-gh-preflight"])).rejects.toThrow(
      "Missing --input JSON",
    )
  })

  it("throws usage error for blank task names", async () => {
    await expect(runCommand(["   ", "--input", "{}"])).rejects.toThrow("Usage: ghx run")
  })

  it("throws for invalid input JSON", async () => {
    await expect(runCommand(["repo.view", "--input", "not-json"])).rejects.toThrow(
      "Invalid JSON for --input",
    )
  })

  it("throws when input JSON is not an object", async () => {
    await expect(runCommand(["repo.view", "--input", "[1,2,3]"])).rejects.toThrow(
      "--input must be a JSON object",
    )
  })

  it("throws when both GitHub token env vars are missing", async () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    await expect(runCommand(["repo.view", "--input", "{}"])).rejects.toThrow(
      "Missing GITHUB_TOKEN or GH_TOKEN",
    )
  })

  it("executes task and prints JSON result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { repository: { id: "r1" } } }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.query("query { repository { id } }", { owner: "a", name: "b" })
      return { ok: true, route: "graphql" }
    })

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const code = await runCommand(["repo.view", "--input", '{"owner":"a","name":"b"}'])

    expect(code).toBe(0)
    expect(createGithubClientMock).toHaveBeenCalledTimes(1)
    expect(executeTaskMock).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledWith('{"ok":true,"route":"graphql"}\n')
  })

  it("defaults to skipping gh preflight in executeTask deps", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { repository: { id: "r1" } } }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockResolvedValue({ ok: true })

    await runCommand(["repo.view", "--input", '{"owner":"a","name":"b"}'])

    expect(executeTaskMock).toHaveBeenCalledTimes(1)
    expect(executeTaskMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        skipGhPreflight: true,
      }),
    )
  })

  it("passes skipGhPreflight=false when --check-gh-preflight is provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { repository: { id: "r1" } } }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockResolvedValue({ ok: true })

    await runCommand(["repo.view", "--input", '{"owner":"a","name":"b"}', "--check-gh-preflight"])

    expect(executeTaskMock).toHaveBeenCalledTimes(1)
    expect(executeTaskMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        skipGhPreflight: false,
      }),
    )
  })

  it("accepts inline --input JSON syntax", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { repository: { id: "r1" } } }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockResolvedValue({ ok: true })

    await runCommand(["repo.view", '--input={"owner":"a","name":"b"}'])

    expect(executeTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "repo.view",
        input: { owner: "a", name: "b" },
      }),
      expect.any(Object),
    )
  })

  it("propagates non-ok GraphQL HTTP responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.query("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"])).rejects.toThrow("forbidden")
  })

  it("propagates GraphQL errors array responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: "query failed" }] }),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.query("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"])).rejects.toThrow("query failed")
  })

  it("throws when GraphQL response omits data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.query("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"])).rejects.toThrow(
      "response missing data",
    )
  })

  describe("stdin input (--input -)", () => {
    it("reads JSON from stdin when --input - is passed", async () => {
      mockStdin('{"owner":"a","name":"b"}')
      executeTaskMock.mockResolvedValue({ ok: true })

      const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
      const code = await runCommand(["repo.view", "--input", "-"])

      expect(code).toBe(0)
      expect(executeTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "repo.view",
          input: { owner: "a", name: "b" },
        }),
        expect.any(Object),
      )
      expect(stdout).toHaveBeenCalledWith('{"ok":true}\n')
    })

    it("throws for invalid JSON from stdin", async () => {
      mockStdin("not-json")

      await expect(runCommand(["repo.view", "--input", "-"])).rejects.toThrow(
        "Invalid JSON for --input",
      )
    })

    it("throws when stdin JSON is not an object", async () => {
      mockStdin("[1,2,3]")

      await expect(runCommand(["repo.view", "--input", "-"])).rejects.toThrow(
        "--input must be a JSON object",
      )
    })

    it("respects --check-gh-preflight with stdin input", async () => {
      mockStdin('{"owner":"a","name":"b"}')
      executeTaskMock.mockResolvedValue({ ok: true })

      vi.spyOn(process.stdout, "write").mockImplementation(() => true)
      await runCommand(["repo.view", "--input", "-", "--check-gh-preflight"])

      expect(executeTaskMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skipGhPreflight: false,
        }),
      )
    })
  })
})

describe("readStdin", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reads data from stdin stream", async () => {
    mockStdin("test data")

    const result = await readStdin()

    expect(result).toBe("test data")
  })

  it("concatenates multiple chunks from stdin", async () => {
    const readable = new Readable({
      read() {
        this.push("chunk1")
        this.push("chunk2")
        this.push("chunk3")
        this.push(null)
      },
    })
    vi.spyOn(process, "stdin", "get").mockReturnValue(readable as unknown as typeof process.stdin)

    const result = await readStdin()

    expect(result).toBe("chunk1chunk2chunk3")
  })

  it("rejects when stdin stream times out", async () => {
    const readable = new Readable({
      read() {
        // Never send data or end
      },
    })
    vi.spyOn(process, "stdin", "get").mockReturnValue(readable as unknown as typeof process.stdin)

    await expect(readStdin(100)).rejects.toThrow("Timed out reading from stdin")
  })

  it("rejects when stdin stream emits error", async () => {
    const readable = new Readable({
      read() {
        // Trigger error after a short delay
        setTimeout(() => {
          this.destroy(new Error("Stream error"))
        }, 10)
      },
    })
    vi.spyOn(process, "stdin", "get").mockReturnValue(readable as unknown as typeof process.stdin)

    await expect(readStdin()).rejects.toThrow("Stream error")
  })

  it("clears timeout when stream ends normally", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout")
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

    mockStdin("data")

    await readStdin()

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it("clears timeout when stream errors", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

    const readable = new Readable({
      read() {
        setTimeout(() => {
          this.destroy(new Error("Stream error"))
        }, 10)
      },
    })
    vi.spyOn(process, "stdin", "get").mockReturnValue(readable as unknown as typeof process.stdin)

    try {
      await readStdin()
    } catch {
      // Ignore error
    }

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
