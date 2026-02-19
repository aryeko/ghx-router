import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  accessMock,
  rmMock,
  loadFixtureManifestMock,
  cleanupSeededFixturesMock,
  cleanupAllFixturesMock,
  applyFixtureAppAuthIfConfiguredMock,
  mintFixtureAppTokenMock,
  seedFixtureManifestMock,
} = vi.hoisted(() => ({
  accessMock: vi.fn(),
  rmMock: vi.fn(),
  loadFixtureManifestMock: vi.fn(),
  cleanupSeededFixturesMock: vi.fn(),
  cleanupAllFixturesMock: vi.fn(),
  applyFixtureAppAuthIfConfiguredMock: vi.fn(),
  mintFixtureAppTokenMock: vi.fn(),
  seedFixtureManifestMock: vi.fn(),
}))

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")
  return {
    ...actual,
    access: accessMock,
    rm: rmMock,
  }
})

vi.mock("@bench/fixture/manifest.js", () => ({
  loadFixtureManifest: loadFixtureManifestMock,
}))

vi.mock("@bench/fixture/cleanup.js", () => ({
  cleanupSeededFixtures: cleanupSeededFixturesMock,
  cleanupAllFixtures: cleanupAllFixturesMock,
}))

vi.mock("@bench/fixture/app-auth.js", () => ({
  applyFixtureAppAuthIfConfigured: applyFixtureAppAuthIfConfiguredMock,
  mintFixtureAppToken: mintFixtureAppTokenMock,
}))

vi.mock("@bench/fixture/seed.js", () => ({
  seedFixtureManifest: seedFixtureManifestMock,
}))

describe("fixtures CLI", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    accessMock.mockResolvedValue(undefined)
    rmMock.mockResolvedValue(undefined)
    loadFixtureManifestMock.mockResolvedValue({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {},
    })
    cleanupSeededFixturesMock.mockResolvedValue({ closedIssues: 3 })
    cleanupAllFixturesMock.mockResolvedValue({
      closedIssues: 5,
      closedPrs: 2,
      deletedBranches: 3,
      deletedLabels: 1,
      deletedProjects: 0,
    })
    applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(() => undefined)
    mintFixtureAppTokenMock.mockResolvedValue("ghs_fake_reviewer_token")
    seedFixtureManifestMock.mockResolvedValue({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {},
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BENCH_FIXTURE_REPO
    delete process.env.BENCH_FIXTURE_MANIFEST
    delete process.env.BENCH_FIXTURE_SEED_ID
  })

  it("parses seed command flags", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")
    const parsed = parseArgs([
      "seed",
      "--repo",
      "aryeko/ghx-bench-fixtures",
      "--out",
      "fixtures/latest.json",
      "--seed-id",
      "nightly",
    ])

    expect(parsed).toEqual({
      command: "seed",
      repo: "aryeko/ghx-bench-fixtures",
      outFile: "fixtures/latest.json",
      seedId: "nightly",
      all: false,
    })
  })

  it("supports inline flag values and default status command", async () => {
    process.env.BENCH_FIXTURE_REPO = "org/from-env"
    const { parseArgs } = await import("../../src/cli/fixtures.js")
    const parsed = parseArgs(["status", "--out=fixtures/inline.json", "--seed-id=adhoc"])

    expect(parsed.command).toBe("status")
    expect(parsed.repo).toBe("org/from-env")
    expect(parsed.outFile).toBe("fixtures/inline.json")
    expect(parsed.seedId).toBe("adhoc")
  })

  it("uses env defaults when command flags are omitted", async () => {
    process.env.BENCH_FIXTURE_REPO = "org/repo"
    process.env.BENCH_FIXTURE_MANIFEST = "fixtures/env.json"
    process.env.BENCH_FIXTURE_SEED_ID = "seed-from-env"

    const { parseArgs } = await import("../../src/cli/fixtures.js")
    const parsed = parseArgs([])
    expect(parsed).toEqual({
      command: "status",
      repo: "org/repo",
      outFile: "fixtures/env.json",
      seedId: "seed-from-env",
      all: false,
    })
  })

  it("supports pnpm forwarded args with separator", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")
    const parsed = parseArgs(["--", "seed", "--seed-id", "nightly"])
    expect(parsed.command).toBe("seed")
    expect(parsed.seedId).toBe("nightly")
  })

  it("rejects unsupported command", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")
    expect(() => parseArgs(["unknown"])).toThrow("Unsupported fixtures command")
  })

  it("rejects invalid repo flag values", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")

    expect(() => parseArgs(["status", "--repo", "invalid-repo-format"])).toThrow(
      "Invalid --repo value",
    )
  })

  it("falls back to default when out file value is empty", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")

    const parsed = parseArgs(["status", "--out", ""])
    expect(parsed.outFile).toBe("fixtures/latest.json")
  })

  it("rejects invalid seed id values", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")

    expect(() => parseArgs(["seed", "--seed-id", "contains space"])).toThrow(
      "Invalid --seed-id value",
    )
  })

  it("runs seed command and logs seeded manifest path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const { main } = await import("../../src/cli/fixtures.js")
    await expect(
      main(["seed", "--repo", "aryeko/ghx-bench-fixtures", "--out", "fixtures/latest.json"]),
    ).resolves.toBeUndefined()

    expect(seedFixtureManifestMock).toHaveBeenCalledWith(
      {
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "fixtures/latest.json",
        seedId: "default",
      },
      "ghs_fake_reviewer_token",
    )
    expect(logSpy).toHaveBeenCalledWith(
      "Seeded fixtures for aryeko/ghx-bench-fixtures -> fixtures/latest.json",
    )
  })

  it("runs status command with auth unchanged and checks manifest", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const { main } = await import("../../src/cli/fixtures.js")
    await expect(main(["status", "--out", "fixtures/latest.json"])).resolves.toBeUndefined()

    expect(applyFixtureAppAuthIfConfiguredMock).not.toHaveBeenCalled()
    expect(accessMock).toHaveBeenCalledWith("fixtures/latest.json")
    expect(loadFixtureManifestMock).toHaveBeenCalledWith("fixtures/latest.json")
    expect(logSpy).toHaveBeenCalledWith(
      "Fixture manifest OK: repo=aryeko/ghx-bench-fixtures version=1 path=fixtures/latest.json",
    )
  })

  it("runs cleanup command, removes manifest, and restores auth", async () => {
    const restoreAuth = vi.fn()
    applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(restoreAuth)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const { main } = await import("../../src/cli/fixtures.js")
    await expect(main(["cleanup", "--out", "fixtures/latest.json"])).resolves.toBeUndefined()

    expect(loadFixtureManifestMock).toHaveBeenCalledWith("fixtures/latest.json")
    expect(cleanupSeededFixturesMock).toHaveBeenCalled()
    expect(rmMock).toHaveBeenCalledWith("fixtures/latest.json", { force: true })
    expect(logSpy).toHaveBeenCalledWith("Closed 3 seeded issue(s) in aryeko/ghx-bench-fixtures")
    expect(logSpy).toHaveBeenCalledWith("Removed fixture manifest: fixtures/latest.json")
    expect(restoreAuth).toHaveBeenCalledOnce()
  })

  it("propagates error when seed command throws", async () => {
    seedFixtureManifestMock.mockRejectedValue(new Error("seed failed"))

    const { main } = await import("../../src/cli/fixtures.js")
    await expect(main(["seed"])).rejects.toThrow("seed failed")
  })

  it("parses --all flag with cleanup command", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")
    const parsed = parseArgs(["cleanup", "--all", "--repo", "aryeko/ghx-bench-fixtures"])

    expect(parsed.command).toBe("cleanup")
    expect(parsed.all).toBe(true)
  })

  it("rejects --all flag with non-cleanup commands", async () => {
    const { parseArgs } = await import("../../src/cli/fixtures.js")

    expect(() => parseArgs(["seed", "--all"])).toThrow(
      "--all flag is only valid with the cleanup command",
    )
    expect(() => parseArgs(["status", "--all"])).toThrow(
      "--all flag is only valid with the cleanup command",
    )
  })

  it("runs cleanup --all calling cleanupAllFixtures instead of manifest-based cleanup", async () => {
    const restoreAuth = vi.fn()
    applyFixtureAppAuthIfConfiguredMock.mockResolvedValue(restoreAuth)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const { main } = await import("../../src/cli/fixtures.js")
    await expect(
      main(["cleanup", "--all", "--repo", "aryeko/ghx-bench-fixtures"]),
    ).resolves.toBeUndefined()

    expect(cleanupAllFixturesMock).toHaveBeenCalledWith("aryeko/ghx-bench-fixtures")
    expect(cleanupSeededFixturesMock).not.toHaveBeenCalled()
    expect(loadFixtureManifestMock).not.toHaveBeenCalled()
    expect(rmMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith(
      "Cleaned all benchmark fixtures from aryeko/ghx-bench-fixtures: 5 issues, 2 PRs, 3 branches, 1 labels, 0 projects",
    )
    expect(restoreAuth).toHaveBeenCalledOnce()
  })

  it("logs and exits when invoked directly and main rejects", async () => {
    const previousArgv1 = process.argv[1]
    process.argv[1] = fileURLToPath(new URL("../../src/cli/fixtures.ts", import.meta.url))
    accessMock.mockRejectedValue(new Error("manifest missing"))

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never)

    try {
      await import("../../src/cli/fixtures.js")
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      if (previousArgv1 === undefined) {
        process.argv.splice(1, 1)
      } else {
        process.argv[1] = previousArgv1
      }
    }

    expect(errorSpy).toHaveBeenCalledWith("manifest missing")
    expect(exitSpy).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenNthCalledWith(1, 1)
  })
})
