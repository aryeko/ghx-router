import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const applyFixtureAppAuthIfConfiguredMock = vi.hoisted(() => vi.fn())
const mintFixtureAppTokenMock = vi.hoisted(() => vi.fn())
const seedFixtureManifestMock = vi.hoisted(() => vi.fn())
const loadFixtureManifestMock = vi.hoisted(() => vi.fn())
const cleanupSeededFixturesMock = vi.hoisted(() => vi.fn())
const cleanupAllFixturesMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())
const rmMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/app-auth.js", () => ({
  applyFixtureAppAuthIfConfigured: applyFixtureAppAuthIfConfiguredMock,
  mintFixtureAppToken: mintFixtureAppTokenMock,
}))
vi.mock("@bench/fixture/seeder.js", () => ({
  seedFixtureManifest: seedFixtureManifestMock,
}))
vi.mock("@bench/fixture/manifest.js", () => ({
  loadFixtureManifest: loadFixtureManifestMock,
}))
vi.mock("@bench/fixture/cleanup.js", () => ({
  cleanupSeededFixtures: cleanupSeededFixturesMock,
}))
vi.mock("@bench/fixture/cleanup-all.js", () => ({
  cleanupAllFixtures: cleanupAllFixturesMock,
}))
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, access: accessMock, rm: rmMock }
})

import { main, parseArgs } from "@bench/cli/fixture-command.js"

describe("fixture-command", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    // Default: applyFixtureAppAuth returns a no-op restore function
    applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(() => {})
    delete process.env.BENCH_FIXTURE_REPO
    delete process.env.BENCH_FIXTURE_MANIFEST
    delete process.env.BENCH_FIXTURE_SEED_ID
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("parseArgs", () => {
    it("uses defaults: command=status, default repo/outFile/seedId", () => {
      const result = parseArgs([])
      expect(result.command).toBe("status")
      expect(result.repo).toBe("aryeko/ghx-bench-fixtures")
      expect(result.outFile).toBe("fixtures/latest.json")
      expect(result.seedId).toBe("default")
      expect(result.all).toBe(false)
    })

    it("parses seed command with --repo, --out, --seed-id flags", () => {
      const result = parseArgs([
        "seed",
        "--repo",
        "owner/repo",
        "--out",
        "out/manifest.json",
        "--seed-id",
        "my-seed",
      ])
      expect(result.command).toBe("seed")
      expect(result.repo).toBe("owner/repo")
      expect(result.outFile).toBe("out/manifest.json")
      expect(result.seedId).toBe("my-seed")
    })

    it("parses cleanup with --all flag", () => {
      const result = parseArgs(["cleanup", "--all"])
      expect(result.command).toBe("cleanup")
      expect(result.all).toBe(true)
    })

    it("throws for unsupported command", () => {
      expect(() => parseArgs(["unknown-cmd"])).toThrow("Unsupported fixtures command: unknown-cmd")
    })

    it("throws for invalid --repo format (no slash)", () => {
      expect(() => parseArgs(["status", "--repo", "invalid-no-slash"])).toThrow("Invalid --repo")
    })

    it("throws for invalid --out with null byte", () => {
      expect(() => parseArgs(["status", "--out", "path\0withNull"])).toThrow("Invalid --out")
    })

    it("throws for invalid --seed-id", () => {
      // @invalid starts with a non-alphanumeric char, failing the regex
      expect(() => parseArgs(["seed", "--seed-id=@invalid!"])).toThrow("Invalid --seed-id")
    })

    it("throws if --all used with non-cleanup command", () => {
      expect(() => parseArgs(["seed", "--all"])).toThrow(
        "--all flag is only valid with the cleanup command",
      )
    })
  })

  describe("main", () => {
    it("seed: calls mintFixtureAppToken + seedFixtureManifest and logs result", async () => {
      mintFixtureAppTokenMock.mockResolvedValue("token-123")
      seedFixtureManifestMock.mockResolvedValue({
        repo: { full_name: "owner/repo" },
        version: "1",
      })

      await main(["seed", "--repo", "owner/repo", "--out", "out.json"])

      expect(mintFixtureAppTokenMock).toHaveBeenCalled()
      expect(seedFixtureManifestMock).toHaveBeenCalledWith(
        expect.objectContaining({ repo: "owner/repo", outFile: "out.json" }),
        "token-123",
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Seeded fixtures"))
    })

    it("status: calls access + loadFixtureManifest and logs manifest info", async () => {
      accessMock.mockResolvedValue(undefined)
      loadFixtureManifestMock.mockResolvedValue({
        repo: { full_name: "owner/repo" },
        version: "2",
      })

      await main(["status", "--out", "fixtures/latest.json"])

      expect(accessMock).toHaveBeenCalledWith("fixtures/latest.json")
      expect(loadFixtureManifestMock).toHaveBeenCalledWith("fixtures/latest.json")
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Fixture manifest OK"))
    })

    it("cleanup with manifest: calls cleanupSeededFixtures + rm", async () => {
      const restoreMock = vi.fn()
      applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(restoreMock)
      loadFixtureManifestMock.mockResolvedValue({
        repo: { full_name: "owner/repo" },
        version: "1",
      })
      cleanupSeededFixturesMock.mockResolvedValue({ closedIssues: 2 })
      rmMock.mockResolvedValue(undefined)

      await main(["cleanup", "--out", "fixtures/latest.json"])

      expect(cleanupSeededFixturesMock).toHaveBeenCalled()
      expect(rmMock).toHaveBeenCalledWith("fixtures/latest.json", { force: true })
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Closed"))
      expect(restoreMock).toHaveBeenCalled()
    })

    it("cleanup --all: calls cleanupAllFixtures and logs summary", async () => {
      const restoreMock = vi.fn()
      applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(restoreMock)
      cleanupAllFixturesMock.mockResolvedValue({
        closedIssues: 3,
        closedPrs: 1,
        deletedBranches: 2,
        deletedLabels: 1,
        deletedProjects: 0,
      })

      await main(["cleanup", "--all", "--repo", "owner/repo"])

      expect(cleanupAllFixturesMock).toHaveBeenCalledWith("owner/repo")
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned all benchmark fixtures"),
      )
      expect(restoreMock).toHaveBeenCalled()
    })

    it("calls restoreFixtureAuth in finally even when main throws", async () => {
      const restoreMock = vi.fn()
      applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(restoreMock)
      loadFixtureManifestMock.mockRejectedValue(new Error("manifest load failed"))

      await expect(main(["cleanup", "--out", "fixtures/latest.json"])).rejects.toThrow(
        "manifest load failed",
      )

      expect(restoreMock).toHaveBeenCalled()
    })
  })
})
