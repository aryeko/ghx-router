import { mkdir, readFile, writeFile } from "node:fs/promises"
import { readManifest, updateManifest, writeManifest } from "@profiler/store/run-manifest.js"
import type { RunManifest } from "@profiler/store/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)

const sampleManifest: RunManifest = {
  runId: "run-001",
  startedAt: "2026-02-27T00:00:00Z",
  modes: ["agent_direct"],
  scenarioIds: ["sc-001"],
  repetitions: 3,
  totalRows: 9,
  outputJsonlPath: "/tmp/results.jsonl",
  metadata: { version: "1.0" },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
})

describe("writeManifest", () => {
  it("creates directory and writes formatted JSON", async () => {
    await writeManifest("/tmp/runs/manifest.json", sampleManifest)
    expect(mockMkdir).toHaveBeenCalledWith("/tmp/runs", { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/tmp/runs/manifest.json",
      `${JSON.stringify(sampleManifest, null, 2)}\n`,
      "utf-8",
    )
  })
})

describe("readManifest", () => {
  it("reads and validates manifest with Zod", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(sampleManifest))
    const result = await readManifest("/tmp/runs/manifest.json")
    expect(result).toEqual(sampleManifest)
    expect(mockReadFile).toHaveBeenCalledWith("/tmp/runs/manifest.json", "utf-8")
  })

  it("throws on invalid data", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ runId: 123 }))
    await expect(readManifest("/tmp/runs/manifest.json")).rejects.toThrow()
  })
})

describe("updateManifest", () => {
  it("merges updates immutably", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(sampleManifest))
    const updated = await updateManifest("/tmp/runs/manifest.json", {
      completedAt: "2026-02-27T01:00:00Z",
      totalRows: 12,
    })
    expect(updated.completedAt).toBe("2026-02-27T01:00:00Z")
    expect(updated.totalRows).toBe(12)
    expect(updated.runId).toBe("run-001")
    // Original should not be mutated
    expect(sampleManifest.totalRows).toBe(9)
    expect(mockWriteFile).toHaveBeenCalled()
  })
})
