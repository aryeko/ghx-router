import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { cleanupAllFixtures } from "@bench/fixture/cleanup-all.js"

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
      { encoding: "utf8", timeout: 30_000 },
    )
  })

  it("handles empty results when no resources exist", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
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
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedLabels).toBe(0)
  })

  it("handles project list as direct array instead of wrapper object", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" })
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

  it("returns empty list when PR/issue list stdout is empty string", async () => {
    // empty stdout → output.length === 0 → returns []
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // PR list: empty stdout
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // issue list: empty stdout
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // refs: null
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // label list: null
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.closedPrs).toBe(0)
    expect(result.closedIssues).toBe(0)
  })

  it("returns empty list when PR list JSON is a non-array object", async () => {
    // non-array parsed → !Array.isArray(parsed) → returns []
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: '{"count": 0}', stderr: "" }) // PR list: object
      .mockReturnValueOnce({ status: 0, stdout: '{"count": 0}', stderr: "" }) // issue list: object
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.closedPrs).toBe(0)
    expect(result.closedIssues).toBe(0)
  })

  it("filters non-object items and non-numeric number fields in list", async () => {
    // primitive items → typeof item !== "object" → null
    // {number: "five"} → typeof value !== "number" → null
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([1, "str", null, { number: "five" }, { number: 3 }]),
        stderr: "",
      }) // 1. PR list → only {number:3} is valid
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // 2. PR close 3
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // 3. issue list
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // 4. refs: null
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // 5. label list: null
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" }) // 7. project list

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.closedPrs).toBe(1)
  })

  it("returns 0 deleted branches when tryRunGhJson returns a valid array", async () => {
    // refs returns empty array → no matching branch prefixes → return 0
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // PR list
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // issue list
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // refs: empty array
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // label list: null
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(0)
  })

  it("returns 0 deleted branches when raw refs JSON is invalid", async () => {
    // tryRunGhJson returns null, raw response has invalid JSON → catch → return 0
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // PR list
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // issue list
      .mockReturnValueOnce({ status: 0, stdout: "not-valid-json", stderr: "" }) // refs: invalid JSON
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // label list: null
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(0)
  })

  it("returns 0 deleted branches when raw refs parses to a non-array", async () => {
    // tryRunGhJson returns null, raw response parses to non-array → !Array.isArray → return 0
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // PR list
      .mockReturnValueOnce({ status: 0, stdout: "[]", stderr: "" }) // issue list
      .mockReturnValueOnce({ status: 0, stdout: '{"refs": []}', stderr: "" }) // refs: object not array
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "" }) // label list: null
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify({ projects: [] }), stderr: "" })

    const result = await cleanupAllFixtures("aryeko/ghx-bench-fixtures")

    expect(result.deletedBranches).toBe(0)
  })
})
