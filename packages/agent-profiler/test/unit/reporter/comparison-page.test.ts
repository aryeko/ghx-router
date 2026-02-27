import { generateComparisonPage } from "@profiler/reporter/comparison-page.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateComparisonPage", () => {
  it("contains H1 heading", () => {
    const result = generateComparisonPage([])
    expect(result).toContain("# Mode Comparison")
  })

  it("shows single mode message when only one mode", () => {
    const rows = [makeProfileRow({ mode: "only_one" })]
    const result = generateComparisonPage(rows)
    expect(result).toContain("Single mode -- no comparison available.")
  })

  it("shows single mode message for empty rows", () => {
    const result = generateComparisonPage([])
    expect(result).toContain("Single mode -- no comparison available.")
  })

  it("renders comparison table for two modes", () => {
    const rows = [
      makeProfileRow({ mode: "fast", timing: { wallMs: 1000, segments: [] } }),
      makeProfileRow({ mode: "fast", timing: { wallMs: 1100, segments: [] } }),
      makeProfileRow({ mode: "slow", timing: { wallMs: 2000, segments: [] } }),
      makeProfileRow({ mode: "slow", timing: { wallMs: 2200, segments: [] } }),
    ]
    const result = generateComparisonPage(rows)
    expect(result).toContain("## fast vs slow")
    expect(result).toContain("| Reduction |")
    expect(result).toContain("| Effect Size |")
    expect(result).toContain("| p-value |")
  })

  it("renders heatmap section", () => {
    const rows = [
      makeProfileRow({ mode: "a", timing: { wallMs: 500, segments: [] } }),
      makeProfileRow({ mode: "b", timing: { wallMs: 1000, segments: [] } }),
    ]
    const result = generateComparisonPage(rows)
    expect(result).toContain("### Reduction Heatmap")
  })

  it("renders all mode pairs for three modes", () => {
    const rows = [
      makeProfileRow({ mode: "x", timing: { wallMs: 100, segments: [] } }),
      makeProfileRow({ mode: "y", timing: { wallMs: 200, segments: [] } }),
      makeProfileRow({ mode: "z", timing: { wallMs: 300, segments: [] } }),
    ]
    const result = generateComparisonPage(rows)
    expect(result).toContain("## x vs y")
    expect(result).toContain("## x vs z")
    expect(result).toContain("## y vs z")
  })
})
