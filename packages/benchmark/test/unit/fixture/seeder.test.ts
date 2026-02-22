import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { seedFixtureManifest } from "@bench/fixture/seeder.js"

describe("fixture seed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires repo, outFile, and seedId options", async () => {
    await expect(seedFixtureManifest({} as never)).rejects.toThrow()
  })

  it("validates repo format", async () => {
    await expect(
      seedFixtureManifest({
        repo: "invalid",
        outFile: "/tmp/test.json",
        seedId: "test",
      } as never),
    ).rejects.toThrow("invalid repo format")
  })

  it("validates outFile is provided", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "",
        seedId: "test",
      } as never),
    ).rejects.toThrow("outFile must be a non-empty path")
  })

  it("validates seedId is provided", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "",
      } as never),
    ).rejects.toThrow("seedId must be a non-empty string")
  })
})
