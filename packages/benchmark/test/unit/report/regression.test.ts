import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { BenchmarkSummary, HistoryEntry, ModeSummary } from "@bench/domain/types.js"
import {
  detectRegressions,
  formatRegressionWarnings,
  loadHistory,
} from "@bench/report/regression.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const createModeSummary = (overrides?: Partial<ModeSummary>): ModeSummary => ({
  mode: "ghx",
  modelSignature: "test/model/default",
  runs: 10,
  successRate: 95,
  outputValidityRate: 98,
  runnerFailureRate: 1,
  timeoutStallRate: 0,
  retryRate: 2,
  medianLatencyMs: 1000,
  medianLatencyMsWall: 1000,
  medianTokensTotal: 5000,
  medianTokensActive: 4000,
  medianToolCalls: 5,
  p90LatencyMs: 1200,
  p95LatencyMs: 1400,
  iqrLatencyMs: 300,
  cvLatency: 0.15,
  p90TokensActive: 4500,
  p95TokensActive: 4800,
  medianCostUsd: 0.05,
  ...(overrides ?? {}),
})

const createSummary = (
  modes?: Partial<Record<"agent_direct" | "mcp" | "ghx", Partial<ModeSummary>>>,
): BenchmarkSummary => {
  const modesRecord = modes ?? {}
  return {
    generatedAt: new Date().toISOString(),
    modes: {
      agent_direct: createModeSummary({
        mode: "agent_direct",
        ...(modesRecord.agent_direct ?? {}),
      }),
      ghx: createModeSummary({
        mode: "ghx",
        ...(modesRecord.ghx ?? {}),
      }),
      ...(modesRecord.mcp && {
        mcp: createModeSummary({ mode: "mcp", ...(modesRecord.mcp ?? {}) }),
      }),
    },
    profiling: {},
    delta: null,
    gate: {
      profile: "verify_pr",
      passed: true,
      reliability: null,
      efficiency: null,
      checks: [],
    },
  }
}

const createHistoryEntry = (overrides?: Partial<HistoryEntry>): HistoryEntry => ({
  timestamp: new Date().toISOString(),
  commit: "abc123",
  branch: "main",
  profile: "verify_pr",
  modes: {
    agent_direct: createModeSummary({ mode: "agent_direct" }),
    ghx: createModeSummary({ mode: "ghx" }),
  },
  gate_passed: true,
  ...(overrides ?? {}),
})

describe("regression", () => {
  let tmpDir: string

  beforeEach(async () => {
    const baseDir = tmpdir()
    tmpDir = join(baseDir, `regression-test-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe("loadHistory", () => {
    it("returns empty array for non-existent file", async () => {
      const filePath = join(tmpDir, "non-existent.jsonl")
      const entries = await loadHistory(filePath)
      expect(entries).toEqual([])
    })

    it("loads history entries from JSONL file", async () => {
      const filePath = join(tmpDir, "history.jsonl")
      const entry1 = createHistoryEntry({ timestamp: "2024-01-01T00:00:00Z" })
      const entry2 = createHistoryEntry({ timestamp: "2024-01-02T00:00:00Z" })

      const jsonl = `${JSON.stringify(entry1)}\n${JSON.stringify(entry2)}\n`
      await writeFile(filePath, jsonl, "utf8")

      const entries = await loadHistory(filePath)
      expect(entries).toHaveLength(2)
      expect(entries[0]?.timestamp).toBe("2024-01-01T00:00:00Z")
      expect(entries[1]?.timestamp).toBe("2024-01-02T00:00:00Z")
    })

    it("handles empty JSONL file", async () => {
      const filePath = join(tmpDir, "empty.jsonl")
      await writeFile(filePath, "", "utf8")

      const entries = await loadHistory(filePath)
      expect(entries).toEqual([])
    })

    it("handles JSONL file with blank lines", async () => {
      const filePath = join(tmpDir, "blank.jsonl")
      const entry = createHistoryEntry()
      const jsonl = `\n${JSON.stringify(entry)}\n\n`
      await writeFile(filePath, jsonl, "utf8")

      const entries = await loadHistory(filePath)
      expect(entries).toHaveLength(1)
    })
  })

  describe("detectRegressions", () => {
    it("returns empty warnings for empty history", () => {
      const current = createSummary()
      const warnings = detectRegressions(current, [])
      expect(warnings).toEqual([])
    })

    it("returns empty warnings when no modes in current summary", () => {
      const current: BenchmarkSummary = {
        generatedAt: new Date().toISOString(),
        modes: {},
        profiling: {},
        delta: null,
        gate: {
          profile: "verify_pr",
          passed: true,
          reliability: null,
          efficiency: null,
          checks: [],
        },
      }
      const warnings = detectRegressions(current, [])
      expect(warnings).toEqual([])
    })

    it("detects success rate regression", () => {
      const previous = createHistoryEntry({
        modes: {
          ghx: createModeSummary({
            mode: "ghx",
            successRate: 98,
          }),
          agent_direct: createModeSummary({ mode: "agent_direct" }),
        },
      })

      const current = createSummary({
        ghx: {
          successRate: 85,
        },
      })

      const warnings = detectRegressions(current, [previous])
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.metric === "success_rate_pct")).toBe(true)
    })

    it("detects latency regression", () => {
      const previous = createHistoryEntry({
        modes: {
          ghx: createModeSummary({
            mode: "ghx",
            medianLatencyMs: 800,
            medianLatencyMsWall: 800,
          }),
          agent_direct: createModeSummary({ mode: "agent_direct" }),
        },
      })

      const current = createSummary({
        ghx: {
          medianLatencyMs: 1500,
          medianLatencyMsWall: 1500,
        },
      })

      const warnings = detectRegressions(current, [previous])
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.metric === "median_latency_ms")).toBe(true)
    })

    it("ignores minor variations below threshold", () => {
      const previous = createHistoryEntry({
        modes: {
          ghx: createModeSummary({
            mode: "ghx",
            successRate: 95,
          }),
          agent_direct: createModeSummary({ mode: "agent_direct" }),
        },
      })

      const current = createSummary({
        ghx: {
          successRate: 94,
        },
      })

      const warnings = detectRegressions(current, [previous])
      expect(warnings).toEqual([])
    })
  })

  describe("formatRegressionWarnings", () => {
    it("formats warnings as bulleted list", () => {
      const warnings: import("@bench/report/regression.js").RegressionWarning[] = [
        {
          metric: "success_rate_pct",
          mode: "ghx",
          current: 90,
          recentAverage: 95,
          thresholdPct: -5,
          deltaPct: -5,
        },
      ]
      const formatted = formatRegressionWarnings(warnings)
      expect(formatted).toContain("success_rate_pct")
      expect(formatted).toContain("ghx")
    })

    it("returns empty string for no warnings", () => {
      const formatted = formatRegressionWarnings([])
      expect(formatted).toBe("")
    })

    it("includes header for regression warnings", () => {
      const warnings: import("@bench/report/regression.js").RegressionWarning[] = [
        {
          metric: "median_latency_ms",
          mode: "ghx",
          current: 1500,
          recentAverage: 1000,
          thresholdPct: 15,
          deltaPct: 50,
        },
      ]
      const formatted = formatRegressionWarnings(warnings)
      expect(formatted).toContain("Regression Warnings")
      expect(formatted).toContain("median_latency_ms")
    })
  })
})
