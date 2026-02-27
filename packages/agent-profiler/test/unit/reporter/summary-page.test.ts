import { generateSummaryPage } from "@profiler/reporter/summary-page.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateSummaryPage", () => {
  it("contains the run ID", () => {
    const rows = [makeProfileRow()]
    const result = generateSummaryPage(rows, "run_abc")
    expect(result).toContain("run_abc")
  })

  it("contains mode names", () => {
    const rows = [makeProfileRow({ mode: "mode_a" }), makeProfileRow({ mode: "mode_b" })]
    const result = generateSummaryPage(rows, "run_1")
    expect(result).toContain("mode_a")
    expect(result).toContain("mode_b")
  })

  it("calculates success rate per mode", () => {
    const rows = [
      makeProfileRow({ mode: "fast", success: true }),
      makeProfileRow({ mode: "fast", success: false }),
      makeProfileRow({ mode: "slow", success: true }),
    ]
    const result = generateSummaryPage(rows, "run_1")
    expect(result).toContain("50.0%")
    expect(result).toContain("100.0%")
  })

  it("contains H1 heading", () => {
    const result = generateSummaryPage([], "run_1")
    expect(result).toContain("# Profile Run Summary")
  })

  it("contains navigation links", () => {
    const result = generateSummaryPage([], "run_1")
    expect(result).toContain("[Metrics Detail](./metrics.md)")
    expect(result).toContain("[Session Analysis](./analysis.md)")
    expect(result).toContain("[Mode Comparison](./comparison.md)")
  })

  it("lists scenarios", () => {
    const rows = [makeProfileRow({ scenarioId: "s1" }), makeProfileRow({ scenarioId: "s2" })]
    const result = generateSummaryPage(rows, "run_1")
    expect(result).toContain("s1, s2")
  })
})
