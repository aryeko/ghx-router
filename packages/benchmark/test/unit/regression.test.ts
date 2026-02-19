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
    deltaVsAgentDirect: null,
    gateV2: {
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
        deltaVsAgentDirect: null,
        gateV2: {
          profile: "verify_pr",
          passed: true,
          reliability: null,
          efficiency: null,
          checks: [],
        },
      }
      const history = [createHistoryEntry()]
      const warnings = detectRegressions(current, history)
      expect(warnings).toEqual([])
    })

    it("detects latency regression >15%", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1000 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { medianLatencyMs: 1200 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.metric).toBe("median_latency_ms")
      expect(warnings[0]?.mode).toBe("ghx")
      expect(warnings[0]?.current).toBe(1200)
      expect(warnings[0]?.recentAverage).toBe(1000)
      expect(warnings[0]?.deltaPct).toBeCloseTo(20, 0)
    })

    it("does not flag latency increase <=15%", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1000 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { medianLatencyMs: 1150 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings.filter((w) => w.metric === "median_latency_ms")).toEqual([])
    })

    it("detects success rate drop >5%", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", successRate: 95 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { successRate: 89 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.metric).toBe("success_rate_pct")
      expect(warnings[0]?.mode).toBe("ghx")
      expect(warnings[0]?.current).toBe(89)
      expect(warnings[0]?.recentAverage).toBe(95)
      expect(warnings[0]?.deltaPct).toBeCloseTo(-6, 0)
    })

    it("does not flag success rate drop <=5%", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", successRate: 95 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { successRate: 91 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings.filter((w) => w.metric === "success_rate_pct")).toEqual([])
    })

    it("averages across multiple recent entries", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1000 }),
          },
        }),
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1050 }),
          },
        }),
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 950 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { medianLatencyMs: 1200 },
      })

      const warnings = detectRegressions(current, history, 3)
      expect(warnings).toHaveLength(1)
      const expected = (1000 + 1050 + 950) / 3
      expect(warnings[0]?.recentAverage).toBeCloseTo(expected, 0)
    })

    it("uses only available recent entries if fewer than requested", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1000 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { medianLatencyMs: 1200 },
      })

      const warnings = detectRegressions(current, history, 10)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.recentAverage).toBe(1000)
    })

    it("checks multiple modes independently", () => {
      const history = [
        createHistoryEntry({
          modes: {
            agent_direct: createModeSummary({ mode: "agent_direct", medianLatencyMs: 1000 }),
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 800 }),
            mcp: createModeSummary({ mode: "mcp", medianLatencyMs: 900 }),
          },
        }),
      ]
      const current = createSummary({
        agent_direct: { medianLatencyMs: 1050 },
        ghx: { medianLatencyMs: 1000 },
        mcp: { medianLatencyMs: 900 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.mode).toBe("ghx")
    })

    it("ignores modes not in history", () => {
      const history = [
        createHistoryEntry({
          modes: {
            ghx: createModeSummary({ mode: "ghx", medianLatencyMs: 1000 }),
          },
        }),
      ]
      const current = createSummary({
        ghx: { medianLatencyMs: 1200 },
        mcp: { medianLatencyMs: 900 },
      })

      const warnings = detectRegressions(current, history)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.mode).toBe("ghx")
    })
  })

  describe("formatRegressionWarnings", () => {
    it("returns empty string for no warnings", () => {
      const formatted = formatRegressionWarnings([])
      expect(formatted).toBe("")
    })

    it("formats single warning as markdown", () => {
      const warnings = [
        {
          metric: "median_latency_ms",
          mode: "ghx" as const,
          current: 1200,
          recentAverage: 1000,
          thresholdPct: 15,
          deltaPct: 20,
        },
      ]

      const formatted = formatRegressionWarnings(warnings)
      expect(formatted).toContain("## Regression Warnings")
      expect(formatted).toContain("median_latency_ms (ghx)")
      expect(formatted).toContain("Current: 1200.00")
      expect(formatted).toContain("Recent Avg: 1000.00")
      expect(formatted).toContain("Change: 20.00%")
      expect(formatted).toContain("threshold: 15.00%")
    })

    it("formats multiple warnings as markdown", () => {
      const warnings = [
        {
          metric: "median_latency_ms",
          mode: "ghx" as const,
          current: 1200,
          recentAverage: 1000,
          thresholdPct: 15,
          deltaPct: 20,
        },
        {
          metric: "success_rate_pct",
          mode: "ghx" as const,
          current: 89,
          recentAverage: 95,
          thresholdPct: -5,
          deltaPct: -6,
        },
      ]

      const formatted = formatRegressionWarnings(warnings)
      expect(formatted).toContain("## Regression Warnings")
      expect(formatted).toContain("median_latency_ms")
      expect(formatted).toContain("success_rate_pct")
    })
  })
})
