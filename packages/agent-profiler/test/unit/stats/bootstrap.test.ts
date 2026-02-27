import { bootstrapCI, bootstrapReductionCI } from "@profiler/stats/bootstrap.js"
import { describe, expect, it } from "vitest"

describe("bootstrapCI", () => {
  it("returns interval containing point estimate", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = bootstrapCI(values, { seed: 123, resamples: 1000 })
    expect(result.lower).toBeLessThanOrEqual(result.pointEstimate)
    expect(result.upper).toBeGreaterThanOrEqual(result.pointEstimate)
  })

  it("produces deterministic results with same seed", () => {
    const values = [10, 20, 30, 40, 50]
    const a = bootstrapCI(values, { seed: 99, resamples: 500 })
    const b = bootstrapCI(values, { seed: 99, resamples: 500 })
    expect(a.lower).toBe(b.lower)
    expect(a.upper).toBe(b.upper)
    expect(a.pointEstimate).toBe(b.pointEstimate)
  })

  it("returns degenerate interval for empty array", () => {
    const result = bootstrapCI([])
    expect(result.lower).toBe(0)
    expect(result.upper).toBe(0)
    expect(result.pointEstimate).toBe(0)
  })

  it("returns point estimate for both bounds on single element", () => {
    const result = bootstrapCI([42])
    expect(result.lower).toBe(42)
    expect(result.upper).toBe(42)
    expect(result.pointEstimate).toBe(42)
  })
})

describe("bootstrapReductionCI", () => {
  it("produces reasonable reduction range for known inputs", () => {
    // modeA is consistently lower than modeB => positive reduction
    const modeA = [10, 12, 11, 13, 10]
    const modeB = [20, 22, 21, 23, 20]
    const result = bootstrapReductionCI(modeA, modeB, {
      seed: 42,
      resamples: 1000,
    })
    // reduction should be around 45-55%
    expect(result.pointEstimate).toBeGreaterThan(30)
    expect(result.pointEstimate).toBeLessThan(70)
    expect(result.lower).toBeLessThanOrEqual(result.pointEstimate)
    expect(result.upper).toBeGreaterThanOrEqual(result.pointEstimate)
  })
})
