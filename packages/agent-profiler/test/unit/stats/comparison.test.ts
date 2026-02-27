import { cohensD, compareGroups, permutationTest } from "@profiler/stats/comparison.js"
import { describe, expect, it } from "vitest"

describe("cohensD", () => {
  it("returns d=0 and magnitude negligible for identical groups", () => {
    const group = [5, 5, 5, 5, 5]
    const result = cohensD(group, group)
    expect(result.d).toBe(0)
    expect(result.magnitude).toBe("negligible")
  })

  it("returns expected magnitude for known difference", () => {
    // Large effect: groups separated by several stddevs
    const groupA = [10, 11, 12, 13, 14]
    const groupB = [1, 2, 3, 4, 5]
    const result = cohensD(groupA, groupB)
    expect(result.magnitude).toBe("large")
    expect(result.d).toBeGreaterThan(0)
  })

  it("returns d=0 when pooled stddev is zero", () => {
    const result = cohensD([3, 3, 3], [3, 3, 3])
    expect(result.d).toBe(0)
    expect(result.magnitude).toBe("negligible")
  })
})

describe("permutationTest", () => {
  it("returns high pValue for identical groups", () => {
    const group = [5, 5, 5, 5, 5]
    const result = permutationTest(group, group, {
      seed: 42,
      permutations: 1000,
    })
    expect(result.pValue).toBeGreaterThan(0.5)
  })

  it("returns low pValue for clearly different groups", () => {
    const groupA = [100, 101, 102, 103, 104]
    const groupB = [1, 2, 3, 4, 5]
    const result = permutationTest(groupA, groupB, {
      seed: 42,
      permutations: 1000,
    })
    expect(result.pValue).toBeLessThan(0.1)
  })

  it("is deterministic with same seed", () => {
    const a = [1, 2, 3, 4, 5]
    const b = [6, 7, 8, 9, 10]
    const r1 = permutationTest(a, b, { seed: 77, permutations: 500 })
    const r2 = permutationTest(a, b, { seed: 77, permutations: 500 })
    expect(r1.pValue).toBe(r2.pValue)
    expect(r1.observedDifference).toBe(r2.observedDifference)
  })
})

describe("compareGroups", () => {
  it("returns correctly shaped ComparisonResult", () => {
    const result = compareGroups(
      "ghx",
      [10, 12, 11, 13, 10],
      "agent_direct",
      [20, 22, 21, 23, 20],
      "total_tokens",
      {
        bootstrapOptions: { seed: 42, resamples: 500 },
        permutationOptions: { seed: 42, permutations: 500 },
      },
    )

    expect(result.modeA).toBe("ghx")
    expect(result.modeB).toBe("agent_direct")
    expect(result.metric).toBe("total_tokens")
    expect(typeof result.reductionPct).toBe("number")
    expect(result.ci95).toHaveLength(2)
    expect(typeof result.ci95[0]).toBe("number")
    expect(typeof result.ci95[1]).toBe("number")
    expect(typeof result.effectSize).toBe("number")
    expect(["negligible", "small", "medium", "large"]).toContain(result.effectMagnitude)
    expect(typeof result.pValue).toBe("number")
  })
})
