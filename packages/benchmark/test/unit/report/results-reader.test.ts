import { findRepoRoot, findResultsJsonl, loadResultsMap } from "@bench/report/results-reader.js"
import { describe, expect, it, vi } from "vitest"

const readdirMock = vi.hoisted(() => vi.fn())
const statMock = vi.hoisted(() => vi.fn())
const readJsonlFileMock = vi.hoisted(() => vi.fn())

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    readdir: readdirMock,
    stat: statMock,
  }
})

vi.mock("@bench/util/jsonl.js", () => ({ readJsonlFile: readJsonlFileMock }))

describe("findRepoRoot", () => {
  it("returns directory when packages/benchmark/results exists", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => true })

    const result = await findRepoRoot("/repo/root/some/subdir")

    expect(result).toBe("/repo/root/some/subdir")
  })

  it("walks up parent dirs until packages/benchmark/results found", async () => {
    // First call: /a/b/c — stat throws (not found)
    statMock.mockRejectedValueOnce(new Error("ENOENT"))
    // Second call: /a/b — stat throws (not found)
    statMock.mockRejectedValueOnce(new Error("ENOENT"))
    // Third call: /a — returns directory
    statMock.mockResolvedValueOnce({ isDirectory: () => true })

    const result = await findRepoRoot("/a/b/c")

    expect(result).toBe("/a")
  })

  it("returns null when packages/benchmark/results not found in any ancestor", async () => {
    // stat always throws to simulate filesystem root where dirname returns same
    statMock.mockRejectedValue(new Error("ENOENT"))

    const result = await findRepoRoot("/nonexistent")

    expect(result).toBeNull()
  })

  it("returns null when stat returns non-directory", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => false })
    statMock.mockRejectedValue(new Error("ENOENT"))

    const result = await findRepoRoot("/some/path")

    expect(result).toBeNull()
  })
})

describe("findResultsJsonl", () => {
  it("returns matching files filtered by benchRunTs prefix and -suite.jsonl suffix", async () => {
    // stat: find repo root — match at first level
    statMock.mockResolvedValueOnce({ isDirectory: () => true })
    // readdir: list results dir
    readdirMock.mockResolvedValueOnce([
      "2026-01-01T00-00-00-000Z-agent_direct-suite.jsonl",
      "2026-01-01T00-00-00-000Z-ghx-suite.jsonl",
      "2026-01-01T00-00-00-001Z-agent_direct-suite.jsonl",
      "other-file.jsonl",
    ])

    const result = await findResultsJsonl("/repo/runs/2026-01-01T00-00-00-000Z")

    expect(result).toHaveLength(2)
    expect(result[0]).toContain("2026-01-01T00-00-00-000Z-agent_direct-suite.jsonl")
    expect(result[1]).toContain("2026-01-01T00-00-00-000Z-ghx-suite.jsonl")
  })

  it("returns empty array when repo root not found", async () => {
    statMock.mockRejectedValue(new Error("ENOENT"))

    const result = await findResultsJsonl("/nonexistent/runs/2026-01-01T00-00-00-000Z")

    expect(result).toEqual([])
  })

  it("returns empty array when results dir readdir throws", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => true })
    readdirMock.mockRejectedValueOnce(new Error("ENOENT"))

    const result = await findResultsJsonl("/repo/runs/2026-01-01T00-00-00-000Z")

    expect(result).toEqual([])
  })

  it("returns empty array when benchRunTs is empty string", async () => {
    const result = await findResultsJsonl("/repo/runs/")

    expect(result).toEqual([])
  })
})

describe("loadResultsMap", () => {
  it("builds correct map from JSONL rows keyed by scenario_id::iteration", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => true })
    readdirMock.mockResolvedValueOnce(["2026-01-01T00-00-00-000Z-agent_direct-suite.jsonl"])
    readJsonlFileMock.mockResolvedValueOnce([
      {
        scenario_id: "sc-001",
        iteration: 1,
        success: true,
        output_valid: true,
        cost: 0.0123,
        latency_ms_wall: 5000,
        internal_retry_count: 0,
        external_retry_count: 0,
        error: null,
      },
      {
        scenario_id: "sc-001",
        iteration: 2,
        success: false,
        output_valid: false,
        cost: 0.0456,
        latency_ms_wall: 7000,
        internal_retry_count: 1,
        external_retry_count: 0,
        error: { type: "timeout", message: "timed out" },
      },
    ])

    const result = await loadResultsMap("/repo/runs/2026-01-01T00-00-00-000Z")

    expect(result.size).toBe(2)
    expect(result.get("sc-001::1")).toMatchObject({ scenario_id: "sc-001", iteration: 1 })
    expect(result.get("sc-001::2")).toMatchObject({ scenario_id: "sc-001", iteration: 2 })
  })

  it("skips JSONL files that throw on read", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => true })
    readdirMock.mockResolvedValueOnce([
      "2026-01-01T00-00-00-000Z-agent_direct-suite.jsonl",
      "2026-01-01T00-00-00-000Z-ghx-suite.jsonl",
    ])
    readJsonlFileMock.mockRejectedValueOnce(new Error("ENOENT")).mockResolvedValueOnce([
      {
        scenario_id: "sc-002",
        iteration: 1,
        success: true,
        output_valid: true,
        cost: 0.01,
        latency_ms_wall: 3000,
        internal_retry_count: 0,
        external_retry_count: 0,
        error: null,
      },
    ])

    const result = await loadResultsMap("/repo/runs/2026-01-01T00-00-00-000Z")

    expect(result.size).toBe(1)
    expect(result.get("sc-002::1")).toMatchObject({ scenario_id: "sc-002" })
  })

  it("returns empty map when no JSONL files found", async () => {
    statMock.mockRejectedValue(new Error("ENOENT"))

    const result = await loadResultsMap("/runs/2026-01-01T00-00-00-000Z")

    expect(result.size).toBe(0)
  })

  it("later rows overwrite earlier rows for the same key", async () => {
    statMock.mockResolvedValueOnce({ isDirectory: () => true })
    readdirMock.mockResolvedValueOnce(["2026-01-01T00-00-00-000Z-agent_direct-suite.jsonl"])
    readJsonlFileMock.mockResolvedValueOnce([
      { scenario_id: "sc-001", iteration: 1, success: false, output_valid: false, cost: 0.01 },
      { scenario_id: "sc-001", iteration: 1, success: true, output_valid: true, cost: 0.02 },
    ])

    const result = await loadResultsMap("/repo/runs/2026-01-01T00-00-00-000Z")

    expect(result.size).toBe(1)
    expect(result.get("sc-001::1")).toMatchObject({ success: true, cost: 0.02 })
  })
})
