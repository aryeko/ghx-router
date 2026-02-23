import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { cleanupSeededFixtures } from "@bench/fixture/cleanup.js"

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
      { encoding: "utf8", timeout: 30_000 },
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
      { encoding: "utf8", timeout: 30_000 },
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
      { encoding: "utf8", timeout: 30_000 },
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
