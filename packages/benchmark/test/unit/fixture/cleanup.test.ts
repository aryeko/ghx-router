import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { cleanupAllFixtures, cleanupSeededFixtures } from "@bench/fixture/cleanup.js"

describe("fixture cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("closes open seeded issues by bench labels", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ number: 12 }]),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      })

    const result = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: {
          seed_id: "local",
        },
      },
    })

    expect(result.closedIssues).toBe(1)
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      "gh",
      [
        "issue",
        "list",
        "--repo",
        "aryeko/ghx-bench-fixtures",
        "--state",
        "open",
        "--label",
        "bench-fixture",
        "--label",
        "bench-seed:local",
        "--limit",
        "200",
        "--json",
        "number",
      ],
      { encoding: "utf8" },
    )
  })

  it("uses default seed label when metadata seed id is missing or invalid", async () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify([{ number: 15 }]),
      stderr: "",
    })

    await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: [],
      },
    })

    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["bench-seed:default"]),
      { encoding: "utf8" },
    )
  })

  it("ignores non-array issue responses and malformed issue rows", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({ items: [{ number: 1 }] }),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([null, { number: "not-number" }, { number: 7 }]),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      })

    const first = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    const second = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    expect(first.closedIssues).toBe(0)
    expect(second.closedIssues).toBe(1)
  })

  it("throws helpful fallback error when gh command fails without stderr", async () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
    })

    await expect(
      cleanupSeededFixtures({
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {
          metadata: {
            seed_id: "local",
          },
        },
      }),
    ).rejects.toThrow("gh command failed: gh issue list --repo aryeko/ghx-bench-fixtures")
  })

  it("closes seeded PRs and deletes seed branches", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "" }
      }
      const joined = args.join(" ")

      if (joined.includes("issue list")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }
      if (joined.includes("pr list") && joined.includes("bench-seed:local")) {
        return {
          status: 0,
          stdout: JSON.stringify([{ number: 20 }]),
          stderr: "",
        }
      }
      if (joined.includes("pr close 20")) {
        return { status: 0, stdout: "", stderr: "" }
      }
      if (joined.includes("--method DELETE") && joined.includes("bench-seed-local")) {
        return { status: 0, stdout: "", stderr: "" }
      }
      if (joined.includes("--method DELETE") && joined.includes("bench-review-seed-local")) {
        return { status: 0, stdout: "", stderr: "" }
      }
      return { status: 0, stdout: "", stderr: "" }
    })

    const result = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    expect(result.closedIssues).toBe(0)
    expect(result.closedPrs).toBe(1)
    expect(result.deletedBranches).toBe(2)
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "gh",
      ["pr", "close", "20", "--repo", "aryeko/ghx-bench-fixtures", "--delete-branch"],
      { encoding: "utf8" },
    )
  })

  it("handles branch deletion failures gracefully", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "" }
      }
      const joined = args.join(" ")

      if (joined.includes("issue list")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }
      if (joined.includes("pr list")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }
      if (joined.includes("--method DELETE")) {
        return { status: 1, stdout: "", stderr: "not found" }
      }
      return { status: 0, stdout: "", stderr: "" }
    })

    const result = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    expect(result.closedPrs).toBe(0)
    expect(result.deletedBranches).toBe(0)
  })
})

describe("cleanupAllFixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("closes PRs with --delete-branch, closes issues, deletes branches/labels/projects", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ number: 5 }, { number: 6 }]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ number: 10 }]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          { ref: "refs/heads/bench-seed-abc123" },
          { ref: "refs/heads/main" },
          { ref: "refs/heads/bench-review-seed-def456" },
        ]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          { name: "bench-seed:local" },
          { name: "bench-fixture" },
          { name: "bench-seed:nightly" },
          { name: "bug" },
        ]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({
          projects: [
            { title: "GHX Bench Fixtures (local)", number: 1 },
            { title: "My Project", number: 2 },
          ],
        }),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({
      closedPrs: 2,
      closedIssues: 1,
      deletedBranches: 2,
      deletedLabels: 2,
      deletedProjects: 1,
    })

    expect(spawnSyncMock).toHaveBeenCalledWith(
      "gh",
      ["pr", "close", "5", "--repo", "aryeko/ghx-bench-fixtures", "--delete-branch"],
      { encoding: "utf8" },
    )
  })

  it("handles empty results when no resources exist", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({
      closedPrs: 0,
      closedIssues: 0,
      deletedBranches: 0,
      deletedLabels: 0,
      deletedProjects: 0,
    })
  })

  it("continues on individual deletion failures and warns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ ref: "refs/heads/bench-seed-abc" }]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "not found" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ name: "bench-seed:broken" }]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "not found" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(0)
    expect(result.deletedLabels).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: failed to delete branch ref refs/heads/bench-seed-abc",
    )
    expect(warnSpy).toHaveBeenCalledWith("Warning: failed to delete label bench-seed:broken")
    warnSpy.mockRestore()
  })

  it("skips bench-fixture label itself when deleting labels", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ name: "bench-fixture" }, { name: "bench-seed:local" }]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedLabels).toBe(1)
    const deleteArgs = spawnSyncMock.mock.calls.map((call: unknown[]) => call[1] as string[])
    const labelDeleteCalls = deleteArgs.filter(
      (args: string[]) => args[0] === "label" && args[1] === "delete",
    )
    expect(labelDeleteCalls).toHaveLength(1)
    expect(labelDeleteCalls[0]).toContain("bench-seed:local")
  })

  it("handles invalid JSON in label list response", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "not valid json", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedLabels).toBe(0)
    expect(result.deletedBranches).toBe(0)
    expect(result.deletedProjects).toBe(0)
  })

  it("handles invalid JSON in project list response", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "invalid project json", stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedProjects).toBe(0)
  })

  it("handles null label output gracefully", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedLabels).toBe(0)
  })

  it("handles project list as direct array instead of wrapper object", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          { title: "GHX Bench Fixtures (nightly)", number: 42 },
          { title: "Other Project", number: 99 },
        ]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedProjects).toBe(1)
  })

  it("skips projects with missing number when deleting", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({
          projects: [
            { title: "GHX Bench Fixtures (test)", number: 55 },
            { title: "GHX Bench Fixtures (invalid)" },
          ],
        }),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedProjects).toBe(1)
  })

  it("handles project deletion failure with warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({
          projects: [{ title: "GHX Bench Fixtures (fail)", number: 99 }],
        }),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "permission denied" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedProjects).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: failed to delete project GHX Bench Fixtures (fail)",
    )
    warnSpy.mockRestore()
  })

  it("handles branch list with null items in response", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          null,
          { ref: "refs/heads/bench-seed-test" },
          { ref: 123 },
          { other: "field" },
        ]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(1)
  })

  it("filters out non-matching branch refs correctly", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([
          { ref: "refs/heads/main" },
          { ref: "refs/heads/feature" },
          { ref: "refs/heads/bench-seed-abc" },
          { ref: "refs/heads/bench-review-seed-xyz" },
          { ref: "refs/heads/develop" },
        ]),
        stderr: "",
      })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(2)
  })
})
