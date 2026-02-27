import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  FixtureManifestSchema,
  loadFixtureManifest,
  writeFixtureManifest,
} from "@eval/fixture/manifest.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const validManifest = {
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
      metadata: {},
    },
  },
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = join(tmpdir(), "manifest-test-" + Math.random().toString(36).slice(2))
  await mkdir(tmpDir, { recursive: true })
})

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
})

describe("FixtureManifestSchema", () => {
  it("parses a valid manifest", () => {
    const result = FixtureManifestSchema.parse(validManifest)
    expect(result.seedId).toBe("default")
    expect(result.fixtures["pr_with_mixed_threads"]?.number).toBe(42)
    expect(result.repo).toBe("aryeko/ghx-bench-fixtures")
    expect(result.createdAt).toBe("2026-02-27T12:00:00Z")
  })

  it("applies metadata default when omitted", () => {
    const m = {
      ...validManifest,
      fixtures: {
        x: { type: "t", number: 1, repo: "o/r" },
      },
    }
    const result = FixtureManifestSchema.parse(m)
    expect(result.fixtures["x"]?.metadata).toEqual({})
  })

  it("parses fixture with optional branch and labels", () => {
    const m = {
      ...validManifest,
      fixtures: {
        issue_001: {
          type: "issue",
          number: 10,
          repo: "aryeko/ghx-bench-fixtures",
        },
      },
    }
    const result = FixtureManifestSchema.parse(m)
    expect(result.fixtures["issue_001"]?.branch).toBeUndefined()
    expect(result.fixtures["issue_001"]?.labels).toBeUndefined()
  })

  it("rejects manifest missing required seedId", () => {
    const m = { ...validManifest, seedId: undefined }
    expect(() => FixtureManifestSchema.parse(m)).toThrow()
  })

  it("rejects manifest missing required repo", () => {
    const m = { ...validManifest, repo: undefined }
    expect(() => FixtureManifestSchema.parse(m)).toThrow()
  })

  it("rejects fixture missing required number", () => {
    const m = {
      ...validManifest,
      fixtures: { x: { type: "t", repo: "o/r" } },
    }
    expect(() => FixtureManifestSchema.parse(m)).toThrow()
  })

  it("parses metadata with arbitrary values", () => {
    const m = {
      ...validManifest,
      fixtures: {
        x: {
          type: "pr",
          number: 5,
          repo: "o/r",
          metadata: { originalSha: "abc123", count: 3 },
        },
      },
    }
    const result = FixtureManifestSchema.parse(m)
    expect(result.fixtures["x"]?.metadata["originalSha"]).toBe("abc123")
    expect(result.fixtures["x"]?.metadata["count"]).toBe(3)
  })
})

describe("loadFixtureManifest", () => {
  it("loads and parses a manifest file", async () => {
    const path = join(tmpDir, "manifest.json")
    await writeFile(path, JSON.stringify(validManifest))
    const manifest = await loadFixtureManifest(path)
    expect(manifest.seedId).toBe("default")
    expect(manifest.fixtures["pr_with_mixed_threads"]?.number).toBe(42)
  })

  it("throws when file not found", async () => {
    await expect(loadFixtureManifest(join(tmpDir, "nonexistent.json"))).rejects.toThrow()
  })

  it("throws when JSON is invalid", async () => {
    const path = join(tmpDir, "bad.json")
    await writeFile(path, "{ not valid json")
    await expect(loadFixtureManifest(path)).rejects.toThrow()
  })

  it("throws when manifest schema is invalid", async () => {
    const path = join(tmpDir, "invalid-schema.json")
    await writeFile(path, JSON.stringify({ seedId: "x" })) // missing fields
    await expect(loadFixtureManifest(path)).rejects.toThrow()
  })
})

describe("writeFixtureManifest", () => {
  it("writes manifest to file and can be round-tripped", async () => {
    const path = join(tmpDir, "out.json")
    const manifest = FixtureManifestSchema.parse(validManifest)
    await writeFixtureManifest(path, manifest)
    const loaded = await loadFixtureManifest(path)
    expect(loaded.seedId).toBe(manifest.seedId)
    expect(loaded.repo).toBe(manifest.repo)
    expect(loaded.createdAt).toBe(manifest.createdAt)
    expect(loaded.fixtures["pr_with_mixed_threads"]?.number).toBe(42)
  })

  it("writes valid JSON (pretty-printed)", async () => {
    const path = join(tmpDir, "pretty.json")
    const manifest = FixtureManifestSchema.parse(validManifest)
    await writeFixtureManifest(path, manifest)
    const raw = await import("node:fs/promises").then((fs) => fs.readFile(path, "utf-8"))
    // Pretty-printed: should have newlines
    expect(raw).toContain("\n")
    const parsed = JSON.parse(raw)
    expect(parsed.seedId).toBe("default")
  })
})
