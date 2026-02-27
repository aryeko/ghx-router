import { afterEach, describe, expect, it, vi } from "vitest"

// Mock manifest module before importing manager
vi.mock("@eval/fixture/manifest.js", () => ({
  loadFixtureManifest: vi.fn(),
  writeFixtureManifest: vi.fn(),
}))

import { FixtureManager } from "@eval/fixture/manager.js"
import type { FixtureManifest } from "@eval/fixture/manifest.js"
import { loadFixtureManifest } from "@eval/fixture/manifest.js"

const mockLoadManifest = vi.mocked(loadFixtureManifest)

const validManifest: FixtureManifest = {
  seedId: "default",
  createdAt: "2026-02-27T12:00:00Z",
  repo: "aryeko/ghx-bench-fixtures",
  fixtures: {
    pr_with_mixed_threads: {
      type: "pr_with_mixed_threads",
      number: 42,
      repo: "aryeko/ghx-bench-fixtures",
      branch: "bench-fixture/pr-mixed-threads-42",
      labels: ["bench-fixture"],
      metadata: { originalSha: "abc123def456" },
    },
    issue_for_triage: {
      type: "issue",
      number: 7,
      repo: "aryeko/ghx-bench-fixtures",
      metadata: {},
    },
  },
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("FixtureManager.status()", () => {
  it("returns empty ok/missing when manifest fails to load", async () => {
    mockLoadManifest.mockRejectedValue(new Error("ENOENT: no such file"))
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const status = await manager.status()
    expect(status.ok).toEqual([])
    expect(status.missing).toEqual([])
  })

  it("marks fixture as ok when gh check succeeds", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    // Spy on private runGh: pr_with_mixed_threads has type "pr_with_mixed_threads" (not === "pr"),
    // so both fixtures use the issue view command
    const runGhSpy = vi
      .spyOn(manager as unknown as { runGh: (args: string[]) => Promise<string> }, "runGh")
      .mockResolvedValue(JSON.stringify({ number: 42 }))

    const status = await manager.status()
    expect(runGhSpy).toHaveBeenCalledTimes(2)
    expect(status.ok).toContain("pr_with_mixed_threads")
    expect(status.ok).toContain("issue_for_triage")
    expect(status.missing).toHaveLength(0)
  })

  it("marks fixture as missing when gh check throws", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    ).mockRejectedValue(new Error("not found"))

    const status = await manager.status()
    expect(status.missing).toContain("pr_with_mixed_threads")
    expect(status.missing).toContain("issue_for_triage")
    expect(status.ok).toHaveLength(0)
  })

  it("handles partial ok/missing correctly", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    )
    // First fixture (pr) succeeds, second (issue) fails
    runGhSpy
      .mockResolvedValueOnce(JSON.stringify({ number: 42 }))
      .mockRejectedValueOnce(new Error("not found"))

    const status = await manager.status()
    expect(status.ok).toContain("pr_with_mixed_threads")
    expect(status.missing).toContain("issue_for_triage")
  })
})

describe("FixtureManager.reset()", () => {
  it("throws when fixture type not in manifest", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    await expect(manager.reset(["nonexistent_fixture"])).rejects.toThrow(
      'Fixture type "nonexistent_fixture" not found in manifest',
    )
  })

  it("skips reset for fixture without branch", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    )
    // issue_for_triage has no branch — should not call runGh
    await manager.reset(["issue_for_triage"])
    expect(runGhSpy).not.toHaveBeenCalled()
  })

  it("force-pushes branch when originalSha is present", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi
      .spyOn(manager as unknown as { runGh: (args: string[]) => Promise<string> }, "runGh")
      // Force-push call
      .mockResolvedValueOnce("")
      // Poll verification call — returns matching SHA
      .mockResolvedValueOnce(JSON.stringify({ object: { sha: "abc123def456" } }))

    await manager.reset(["pr_with_mixed_threads"])
    // Should have called force-push + at least one poll
    expect(runGhSpy).toHaveBeenCalledTimes(2)
    // First call should be PATCH for force-push
    expect(runGhSpy).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining(["api", "--method", "PATCH"]),
    )
  })

  it("retries force-push on transient error and succeeds", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    )
    // First force-push attempt fails, second succeeds, then poll succeeds
    runGhSpy
      .mockRejectedValueOnce(new Error("transient error"))
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce(JSON.stringify({ object: { sha: "abc123def456" } }))

    await manager.reset(["pr_with_mixed_threads"])
    // 2 force-push calls + 1 poll = 3
    expect(runGhSpy).toHaveBeenCalledTimes(3)
  })

  it("throws after 3 failed force-push attempts", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    ).mockRejectedValue(new Error("persistent error"))

    await expect(manager.reset(["pr_with_mixed_threads"])).rejects.toThrow("persistent error")
  })

  it("throws when polling never confirms the SHA", async () => {
    mockLoadManifest.mockResolvedValue(validManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    vi.spyOn(manager as unknown as { runGh: (args: string[]) => Promise<string> }, "runGh")
      // Force-push succeeds
      .mockResolvedValueOnce("")
      // All 5 polls return wrong SHA
      .mockResolvedValue(JSON.stringify({ object: { sha: "different-sha" } }))

    await expect(manager.reset(["pr_with_mixed_threads"])).rejects.toThrow(
      'Fixture reset for branch "bench-fixture/pr-mixed-threads-42" could not be verified after polling',
    )
  })
})

describe("FixtureManager.seed()", () => {
  it("throws not implemented", async () => {
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    await expect(manager.seed(["scenario-001"])).rejects.toThrow("not yet implemented")
  })

  it("throws not implemented even for empty array", async () => {
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    await expect(manager.seed([])).rejects.toThrow("not yet implemented")
  })
})

const cleanupManifest: FixtureManifest = {
  seedId: "cleanup-test",
  createdAt: "2026-02-27T12:00:00Z",
  repo: "aryeko/ghx-bench-fixtures",
  fixtures: {
    my_pr: {
      type: "pr",
      number: 42,
      repo: "aryeko/ghx-bench-fixtures",
      metadata: {},
    },
    my_issue: {
      type: "issue",
      number: 7,
      repo: "aryeko/ghx-bench-fixtures",
      metadata: {},
    },
  },
}

describe("FixtureManager.cleanup()", () => {
  it("throws for invalid repo format (no slash)", async () => {
    const manager = new FixtureManager({
      repo: "invalid-repo-no-slash",
      manifest: "fixtures/latest.json",
    })
    await expect(manager.cleanup()).rejects.toThrow("Invalid repo format")
  })

  it("closes labeled PRs and issues", async () => {
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    )
    // PR list returns one PR, issue list returns one issue
    runGhSpy
      .mockResolvedValueOnce(JSON.stringify([{ number: 10 }])) // pr list
      .mockResolvedValueOnce(JSON.stringify([{ number: 5 }])) // issue list
      .mockResolvedValueOnce("") // pr close 10
      .mockResolvedValueOnce("") // issue close 5

    await manager.cleanup({ all: true })

    // Should have called list for pr, list for issue, then close for each
    expect(runGhSpy).toHaveBeenCalledTimes(4)
    expect(runGhSpy).toHaveBeenNthCalledWith(3, expect.arrayContaining(["pr", "close", "10"]))
    expect(runGhSpy).toHaveBeenNthCalledWith(4, expect.arrayContaining(["issue", "close", "5"]))
  })

  it("handles empty PR and issue lists gracefully", async () => {
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    )
    // Both lists return empty
    runGhSpy.mockResolvedValueOnce(JSON.stringify([])).mockResolvedValueOnce(JSON.stringify([]))

    await expect(manager.cleanup({ all: true })).resolves.toBeUndefined()
    // Only the two list calls — no close calls
    expect(runGhSpy).toHaveBeenCalledTimes(2)
  })

  it("handles list errors gracefully (returns empty)", async () => {
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    vi.spyOn(
      manager as unknown as { runGh: (args: string[]) => Promise<string> },
      "runGh",
    ).mockRejectedValue(new Error("gh auth error"))

    // listLabeledResources catches errors and returns [] — cleanup should succeed
    await expect(manager.cleanup({ all: true })).resolves.toBeUndefined()
  })

  it("cleanup without --all closes resources from manifest", async () => {
    mockLoadManifest.mockResolvedValue(cleanupManifest)
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })
    const runGhSpy = vi
      .spyOn(manager as unknown as { runGh: (args: string[]) => Promise<string> }, "runGh")
      .mockResolvedValue("")

    await manager.cleanup()

    // Should close the PR (number 42) and issue (number 7) from the manifest
    expect(runGhSpy).toHaveBeenCalledTimes(2)
    expect(runGhSpy).toHaveBeenCalledWith(expect.arrayContaining(["pr", "close", "42"]))
    expect(runGhSpy).toHaveBeenCalledWith(expect.arrayContaining(["issue", "close", "7"]))
  })

  it("cleanup without --all throws when manifest cannot be loaded", async () => {
    mockLoadManifest.mockRejectedValue(new Error("ENOENT: no such file"))
    const manager = new FixtureManager({
      repo: "aryeko/ghx-bench-fixtures",
      manifest: "fixtures/latest.json",
    })

    await expect(manager.cleanup()).rejects.toThrow()
  })
})
