import { generateAnalysisPage } from "@profiler/reporter/analysis-page.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateAnalysisPage", () => {
  it("contains H1 heading", () => {
    const result = generateAnalysisPage([], [])
    expect(result).toContain("# Session Analysis")
  })

  it("shows empty message when no analysis results", () => {
    const result = generateAnalysisPage([makeProfileRow()], [])
    expect(result).toContain("No session analysis data available.")
  })

  it("renders analyzer names", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_001",
        scenarioId: "s1",
        mode: "mode_a",
        model: "test-model",
        results: {
          "tool-usage": {
            analyzer: "tool-usage",
            findings: {
              totalCalls: { type: "number", value: 10, unit: "calls" },
            },
            summary: "Analyzed tool usage patterns",
          },
        },
      },
    ]
    const result = generateAnalysisPage([], bundles)
    expect(result).toContain("### tool-usage")
    expect(result).toContain("Analyzed tool usage patterns")
  })

  it("renders number findings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_001",
        scenarioId: "s1",
        mode: "mode_a",
        model: "test-model",
        results: {
          "cost-analyzer": {
            analyzer: "cost-analyzer",
            findings: {
              totalCost: { type: "number", value: 0.05, unit: "USD" },
            },
            summary: "Cost analysis complete",
          },
        },
      },
    ]
    const result = generateAnalysisPage([], bundles)
    expect(result).toContain("0.05 USD")
  })

  it("renders ratio findings as percentages", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_002",
        scenarioId: "s1",
        mode: "mode_a",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              successRate: { type: "ratio", value: 0.85, label: "success rate" },
            },
            summary: "Efficiency analysis",
          },
        },
      },
    ]
    const result = generateAnalysisPage([], bundles)
    expect(result).toContain("85.0%")
    expect(result).toContain("success rate")
  })

  it("renders session metadata", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_xyz",
        scenarioId: "scenario_alpha",
        mode: "turbo",
        model: "gpt-5",
        results: {},
      },
    ]
    const result = generateAnalysisPage([], bundles)
    expect(result).toContain("ses_xyz")
    expect(result).toContain("scenario_alpha")
    expect(result).toContain("turbo")
    expect(result).toContain("gpt-5")
  })
})
