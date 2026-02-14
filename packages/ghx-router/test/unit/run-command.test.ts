import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createGithubClientMock = vi.fn()
const executeTaskMock = vi.fn()

vi.mock("../../src/gql/client.js", () => ({
  createGithubClient: (...args: unknown[]) => createGithubClientMock(...args)
}))

vi.mock("../../src/core/routing/engine.js", () => ({
  executeTask: (...args: unknown[]) => executeTaskMock(...args)
}))

import { runCommand } from "../../src/cli/commands/run.js"

describe("runCommand", () => {
  const originalFetch = globalThis.fetch
  const originalGithubToken = process.env.GITHUB_TOKEN
  const originalGhToken = process.env.GH_TOKEN

  beforeEach(() => {
    vi.clearAllMocks()
    createGithubClientMock.mockImplementation((client) => client)
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
    expect(stdout).toHaveBeenCalledWith("Usage: ghx run <task> --input '<json>'\n")
  })

  it("throws for missing input flag", async () => {
    await expect(runCommand(["repo.view"]))
      .rejects.toThrow("Missing --input JSON")
  })

  it("throws for invalid input JSON", async () => {
    await expect(runCommand(["repo.view", "--input", "not-json"]))
      .rejects.toThrow("Invalid JSON for --input")
  })

  it("throws when input JSON is not an object", async () => {
    await expect(runCommand(["repo.view", "--input", "[1,2,3]"]))
      .rejects.toThrow("--input must be a JSON object")
  })

  it("throws when both GitHub token env vars are missing", async () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    await expect(runCommand(["repo.view", "--input", "{}"]))
      .rejects.toThrow("Missing GITHUB_TOKEN or GH_TOKEN")
  })

  it("executes task and prints JSON result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { repository: { id: "r1" } } })
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.execute("query { repository { id } }", { owner: "a", name: "b" })
      return { ok: true, route: "graphql" }
    })

    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const code = await runCommand(["repo.view", "--input", '{"owner":"a","name":"b"}'])

    expect(code).toBe(0)
    expect(createGithubClientMock).toHaveBeenCalledTimes(1)
    expect(executeTaskMock).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledWith('{"ok":true,"route":"graphql"}\n')
  })

  it("propagates non-ok GraphQL HTTP responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" })
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.execute("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"]))
      .rejects.toThrow("forbidden")
  })

  it("propagates GraphQL errors array responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: "query failed" }] })
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.execute("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"]))
      .rejects.toThrow("query failed")
  })

  it("throws when GraphQL response omits data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({})
    }))
    vi.stubGlobal("fetch", fetchMock)

    executeTaskMock.mockImplementation(async (_request, context) => {
      await context.githubClient.execute("query { viewer { login } }")
      return { ok: true }
    })

    await expect(runCommand(["repo.view", "--input", "{}"]))
      .rejects.toThrow("response missing data")
  })
})
