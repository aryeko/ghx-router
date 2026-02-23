import { describe, expect, it } from "vitest"
import type { BenchmarkSummary } from "../../../src/domain/types.js"
import { toJson, toMarkdown } from "../../../src/report/formatter.js"

const mockSummary: BenchmarkSummary = {
  generatedAt: "2025-02-22T12:00:00Z",
  modes: {
    agent_direct: {
      mode: "agent_direct",
      modelSignature: "gpt-4o",
      runs: 10,
      successRate: 0.95,
      outputValidityRate: 0.9,
      runnerFailureRate: 0.01,
      timeoutStallRate: 0.02,
      retryRate: 0.03,
      medianLatencyMs: 2500,
      medianLatencyMsWall: 2500,
      medianTokensTotal: 5000,
      medianTokensActive: 3000,
      medianToolCalls: 2,
      p90LatencyMs: 3000,
      p95LatencyMs: 3500,
      iqrLatencyMs: 500,
      cvLatency: 0.15,
      p90TokensActive: 3500,
      p95TokensActive: 4000,
      medianCostUsd: 0.05,
    },
    ghx: {
      mode: "ghx",
      modelSignature: "gpt-4o",
      runs: 10,
      successRate: 0.95,
      outputValidityRate: 0.9,
      runnerFailureRate: 0.01,
      timeoutStallRate: 0.02,
      retryRate: 0.03,
      medianLatencyMs: 2000,
      medianLatencyMsWall: 2000,
      medianTokensTotal: 4000,
      medianTokensActive: 2400,
      medianToolCalls: 1.8,
      p90LatencyMs: 2500,
      p95LatencyMs: 3000,
      iqrLatencyMs: 400,
      cvLatency: 0.12,
      p90TokensActive: 2800,
      p95TokensActive: 3200,
      medianCostUsd: 0.04,
    },
  },
  profiling: {
    agent_direct: {
      runsWithProfiling: 5,
      medianAssistantTotalMs: 1000,
      medianAssistantReasoningMs: 500,
      medianAssistantBetweenReasoningAndToolMs: 100,
      medianToolTotalMs: 1000,
      medianToolBashMs: 800,
      medianAssistantPostToolMs: 200,
    },
    ghx: {
      runsWithProfiling: 5,
      medianAssistantTotalMs: 900,
      medianAssistantReasoningMs: 450,
      medianAssistantBetweenReasoningAndToolMs: 90,
      medianToolTotalMs: 950,
      medianToolBashMs: 750,
      medianAssistantPostToolMs: 180,
    },
  },
  delta: {
    tokensReductionPct: 10,
    tokensActiveReductionPct: 15,
    latencyReductionPct: 20,
    toolCallReductionPct: 10,
    successRateDeltaPct: 0,
    outputValidityRatePct: 90,
    costReductionPct: 20,
    tokensActiveReductionCI: [10, 20],
    latencyReductionCI: [15, 25],
  },
  gate: {
    profile: "verify_pr",
    passed: true,
    reliability: {
      successRateDeltaPct: 0,
      outputValidityRatePct: 90,
      runnerFailureRatePct: 1,
      timeoutStallRatePct: 2,
      retryRatePct: 3,
    },
    efficiency: {
      minSamplesPerScenarioPerMode: 5,
      eligibleScenarioCount: 15,
      totalScenarioCount: 20,
      coveragePct: 75,
      tokensComparableScenarioCount: 15,
      tokensActiveReductionPct: 15,
      latencyReductionPct: 20,
      toolCallReductionPct: 10,
      scenarioWinRateTokensActivePct: 80,
    },
    checks: [
      {
        name: "Active Token Reduction",
        passed: true,
        value: 15,
        threshold: 10,
        operator: ">=",
      },
    ],
  },
}

describe("report/formatter", () => {
  describe("toMarkdown", () => {
    it("generates markdown output", () => {
      const markdown = toMarkdown(mockSummary)
      expect(typeof markdown).toBe("string")
      expect(markdown.length).toBeGreaterThan(0)
    })

    it("includes benchmark validation summary header", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("# Benchmark Validation Summary")
    })

    it("includes generated timestamp", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("Generated: 2025-02-22T12:00:00Z")
    })

    it("includes mode metrics table", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("## Mode Metrics")
      expect(markdown).toContain("| Mode |")
      expect(markdown).toContain("agent_direct")
      expect(markdown).toContain("ghx")
    })

    it("includes profiling snapshot section", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("## Profiling Snapshot")
    })

    it("includes gate section", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("## Gate")
    })

    it("displays gate status", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("PASS")
    })

    it("includes delta section when delta exists", () => {
      const markdown = toMarkdown(mockSummary)
      expect(markdown).toContain("### Delta vs Agent Direct")
      expect(markdown).toContain("cost reduction")
    })

    it("handles missing delta gracefully", () => {
      const summaryNoDelta: BenchmarkSummary = {
        ...mockSummary,
        delta: null,
      }
      const markdown = toMarkdown(summaryNoDelta)
      expect(markdown).toBeDefined()
      expect(typeof markdown).toBe("string")
    })
  })

  describe("toJson", () => {
    it("generates valid JSON output", () => {
      const json = toJson(mockSummary)
      expect(typeof json).toBe("string")
      const parsed = JSON.parse(json)
      expect(parsed).toBeDefined()
    })

    it("includes all summary fields", () => {
      const json = toJson(mockSummary)
      const parsed = JSON.parse(json)
      expect(parsed).toHaveProperty("generatedAt")
      expect(parsed).toHaveProperty("modes")
      expect(parsed).toHaveProperty("profiling")
      expect(parsed).toHaveProperty("delta")
      expect(parsed).toHaveProperty("gate")
    })

    it("preserves data types", () => {
      const json = toJson(mockSummary)
      const parsed = JSON.parse(json)
      expect(typeof parsed.generatedAt).toBe("string")
      expect(typeof parsed.modes).toBe("object")
      expect(parsed.gate.passed).toBe(true)
    })

    it("formats with proper indentation", () => {
      const json = toJson(mockSummary)
      expect(json).toContain("\n")
      expect(json.startsWith("{")).toBe(true)
      expect(json.endsWith("}")).toBe(true)
    })
  })
})
