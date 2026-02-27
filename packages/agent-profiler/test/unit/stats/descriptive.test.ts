import { computeDescriptive } from "@profiler/stats/descriptive.js"
import { describe, expect, it } from "vitest"

describe("computeDescriptive", () => {
  it("returns all zeros for empty array", () => {
    const result = computeDescriptive([])
    expect(result).toEqual({
      count: 0,
      mean: 0,
      median: 0,
      p90: 0,
      p95: 0,
      min: 0,
      max: 0,
      iqr: 0,
      cv: 0,
      stddev: 0,
    })
  })

  it("returns value as all percentiles for single element, stddev/iqr/cv = 0", () => {
    const result = computeDescriptive([42])
    expect(result.count).toBe(1)
    expect(result.mean).toBe(42)
    expect(result.median).toBe(42)
    expect(result.p90).toBe(42)
    expect(result.p95).toBe(42)
    expect(result.min).toBe(42)
    expect(result.max).toBe(42)
    expect(result.stddev).toBe(0)
    expect(result.iqr).toBe(0)
    expect(result.cv).toBe(0)
  })

  it("computes correct stats for [1,2,3,4,5]", () => {
    const result = computeDescriptive([1, 2, 3, 4, 5])
    expect(result.count).toBe(5)
    expect(result.mean).toBe(3)
    expect(result.median).toBe(3)
    expect(result.min).toBe(1)
    expect(result.max).toBe(5)
    // stddev of [1,2,3,4,5] with sample variance = sqrt(10/4) = sqrt(2.5)
    expect(result.stddev).toBeCloseTo(Math.sqrt(2.5), 10)
  })

  it("returns cv=0 and iqr=0 for identical values", () => {
    const result = computeDescriptive([7, 7, 7, 7])
    expect(result.cv).toBe(0)
    expect(result.iqr).toBe(0)
    expect(result.stddev).toBe(0)
    expect(result.mean).toBe(7)
    expect(result.median).toBe(7)
  })

  it("does not mutate the input array", () => {
    const input = [5, 3, 1, 4, 2]
    const copy = [...input]
    computeDescriptive(input)
    expect(input).toEqual(copy)
  })

  it("reports correct count", () => {
    const result = computeDescriptive([10, 20, 30])
    expect(result.count).toBe(3)
  })
})
