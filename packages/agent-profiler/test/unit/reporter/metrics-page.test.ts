import { generateMetricsPage } from "@profiler/reporter/metrics-page.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateMetricsPage", () => {
  it("contains H1 heading", () => {
    const result = generateMetricsPage([])
    expect(result).toContain("# Metrics Detail")
  })

  it("contains mode headers", () => {
    const rows = [makeProfileRow({ mode: "alpha" }), makeProfileRow({ mode: "beta" })]
    const result = generateMetricsPage(rows)
    expect(result).toContain("## Mode: alpha")
    expect(result).toContain("## Mode: beta")
  })

  it("contains p50 and p90 stat labels", () => {
    const rows = [makeProfileRow()]
    const result = generateMetricsPage(rows)
    expect(result).toContain("| p50 |")
    expect(result).toContain("| p90 |")
  })

  it("renders wall time stats for a mode", () => {
    const rows = [
      makeProfileRow({ mode: "m1", timing: { wallMs: 1000, segments: [] } }),
      makeProfileRow({ mode: "m1", timing: { wallMs: 2000, segments: [] } }),
    ]
    const result = generateMetricsPage(rows)
    expect(result).toContain("### Wall Time (ms)")
    // p50 of [1000, 2000] = 1500
    expect(result).toContain("1500.00")
  })

  it("renders cost stats with 4 decimal places", () => {
    const rows = [
      makeProfileRow({
        cost: { totalUsd: 0.0123, inputUsd: 0.005, outputUsd: 0.005, reasoningUsd: 0.002 },
      }),
    ]
    const result = generateMetricsPage(rows)
    expect(result).toContain("0.0123")
  })

  it("renders all four metric sections", () => {
    const rows = [makeProfileRow()]
    const result = generateMetricsPage(rows)
    expect(result).toContain("### Wall Time (ms)")
    expect(result).toContain("### Total Tokens")
    expect(result).toContain("### Total Tool Calls")
    expect(result).toContain("### Cost (USD)")
  })
})
