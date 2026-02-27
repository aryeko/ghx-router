import * as childProcess from "node:child_process"
import { createIssueSeeder } from "@eval/fixture/seeders/issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

/**
 * Configure the mocked `execFile` to invoke its callback with successive
 * results. Each entry in `results` corresponds to one `execFile` call.
 * The callback is always the last argument (matching `promisify` convention).
 */
function mockExecFileResults(
  results: readonly { readonly stdout: string; readonly stderr: string }[],
) {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error("unexpected execFile call"), "", "")
    } else {
      callback(null, result.stdout, result.stderr)
    }
    return {} as ReturnType<typeof childProcess.execFile>
  })
}

describe("createIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue'", () => {
    const seeder = createIssueSeeder()
    expect(seeder.type).toBe("issue")
  })

  it("creates an issue and returns a FixtureResource", async () => {
    const issueList = [{ number: 42, title: "[bench-fixture] open_issue" }]

    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "open_issue",
      labels: ["bench-fixture", "eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 42,
      repo: "acme/sandbox",
      labels: ["bench-fixture", "eval"],
      metadata: {},
    })
  })

  it("calls gh issue create with expected arguments", async () => {
    const issueList = [{ number: 7, title: "[bench-fixture] labeled_issue" }]

    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createIssueSeeder()
    await seeder.seed({
      repo: "acme/sandbox",
      name: "labeled_issue",
      labels: ["bench-fixture"],
    })

    const calls = mockedExecFile.mock.calls
    expect(calls).toHaveLength(2)

    const createCall = calls[0] as unknown[]
    const listCall = calls[1] as unknown[]

    // First call: gh issue create
    expect(createCall[0]).toBe("gh")
    expect(createCall[1]).toEqual(
      expect.arrayContaining([
        "issue",
        "create",
        "--repo",
        "acme/sandbox",
        "--title",
        "[bench-fixture] labeled_issue",
        "--label",
        "bench-fixture",
      ]),
    )

    // Second call: gh issue list
    expect(listCall[0]).toBe("gh")
    expect(listCall[1]).toEqual(
      expect.arrayContaining([
        "issue",
        "list",
        "--repo",
        "acme/sandbox",
        "--label",
        "bench-fixture",
        "--json",
        "number,title",
      ]),
    )
  })

  it("throws when issue cannot be found after creation", async () => {
    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: "[]", stderr: "" },
    ])

    const seeder = createIssueSeeder()

    await expect(
      seeder.seed({
        repo: "acme/sandbox",
        name: "ghost_issue",
        labels: ["bench-fixture"],
      }),
    ).rejects.toThrow(/could not find.*ghost_issue/i)
  })
})
